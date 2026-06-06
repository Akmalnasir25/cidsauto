const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ExcelJS = require('exceljs');
const multer = require('multer');
const upload = multer({ dest: __dirname + '/' });

const PORT = process.env.PORT || 3001;
let isRunning = false;
let currentLog = '';
let currentProcess = null;
let currentPort = PORT; // For tracking actual port

const CONFIG_PATH = path.join(__dirname, 'config.json');

// Helper: Load config with migration from old format
function loadConfig() {
  let config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  
  // Auto-migrate old format (no activeProfile key) to new multi-profile format
  if (!config.activeProfile && !config.profiles) {
    const migrated = {
      activeProfile: 'Cikgu Akmal',
      profiles: {
        'Cikgu Akmal': {
          login: config.login || { username: '', password: '' },
          teacherName: config.teacherName || '',
          rptFile: 'rpt-data.json',
          schedule: config.schedule || {},
          groups: config.groups || []
        }
      }
    };
    config = migrated;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('[MIGRATION] Old config auto-migrated to multi-profile format.');
  }
  
  return config;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getActiveProfile(config) {
  return config.profiles[config.activeProfile] || {};
}

function updateActiveProfile(config, profileData) {
  config.profiles[config.activeProfile] = {
    ...getActiveProfile(config),
    ...profileData
  };
}

const server = http.createServer((req, res) => {
  const url = req.url;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // === AUTOMATION ===
  if (url === '/api/start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (isRunning) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proses sedang berjalan' }));
        return;
      }

      const { startWeek, endWeek } = JSON.parse(body);
      const config = loadConfig();
      const activeProfile = config.activeProfile;
      currentLog = '';
      isRunning = true;

      const command = `node index.js ${startWeek} ${endWeek} all`;
      const startTime = new Date();

      currentLog += `=== RPH AUTOMATION STARTED ===\n`;
      currentLog += `Waktu: ${startTime.toLocaleString()}\n`;
      currentLog += `Profil Aktif: ${activeProfile}\n`;
      currentLog += `Minggu: ${startWeek} hingga ${endWeek}\n\n`;

      currentProcess = exec(command, (error, stdout, stderr) => {
        isRunning = false;
        currentProcess = null;
        const endTime = new Date();

        if (error) {
          currentLog += `\n=== ERROR ===\n${error.message}\n`;
        }

        currentLog += `\n=== PROCESS COMPLETED ===\n`;
        currentLog += `Waktu Selesai: ${endTime.toLocaleString()}\n`;
        currentLog += `Tempoh: ${((endTime - startTime) / 1000).toFixed(1)} saat\n`;
      });

      currentProcess.stdout.on('data', (data) => { currentLog += data; });
      currentProcess.stderr.on('data', (data) => { currentLog += `\n[ERROR] ${data}\n`; });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `Automation dimulakan (${activeProfile}) untuk minggu ${startWeek}-${endWeek}` }));
    });
  }

  else if (url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ isRunning, log: currentLog }));
  }

  else if (url === '/api/stop' && req.method === 'POST') {
    if (currentProcess) {
      currentProcess.kill('SIGTERM');
      currentLog += '\n=== PROSES DIHENTIKAN OLEH PENGGUNA ===\n';
    }
    isRunning = false;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Proses dihentikan' }));
  }

  // === PROFILE MANAGEMENT ===
  else if (url === '/api/profiles' && req.method === 'GET') {
    try {
      const config = loadConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        activeProfile: config.activeProfile,
        profiles: Object.keys(config.profiles)
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Gagal membaca profil' }));
    }
  }

  else if (url === '/api/profiles' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { name, copyFrom } = JSON.parse(body);
        if (!name || !name.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nama profil diperlukan' }));
          return;
        }
        
        const config = loadConfig();
        if (config.profiles[name.trim()]) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Profil "${name}" sudah wujud` }));
          return;
        }
        
        let newProfile;
        if (copyFrom && config.profiles[copyFrom]) {
          // Copy from existing profile
          newProfile = JSON.parse(JSON.stringify(config.profiles[copyFrom]));
          newProfile.rptFile = `rpt-data-${name.trim().replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        } else {
          // Blank profile
          newProfile = {
            login: { username: '', password: '' },
            teacherName: '',
            rptFile: `rpt-data-${name.trim().replace(/[^a-zA-Z0-9]/g, '_')}.json`,
            schedule: {},
            groups: []
          };
        }
        
        config.profiles[name.trim()] = newProfile;
        config.activeProfile = name.trim();
        saveConfig(config);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Profil "${name}" berjaya dicipta!` }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ralat: ' + e.message }));
      }
    });
  }

  else if (url.match(/^\/api\/profiles\/(.+)\/activate$/) && req.method === 'POST') {
    const profileName = decodeURIComponent(url.match(/^\/api\/profiles\/(.+)\/activate$/)[1]);
    try {
      const config = loadConfig();
      if (!config.profiles[profileName]) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Profil "${profileName}" tidak dijumpai` }));
        return;
      }
      config.activeProfile = profileName;
      saveConfig(config);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `Kini menggunakan profil "${profileName}"` }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ralat: ' + e.message }));
    }
  }

  else if (url.match(/^\/api\/profiles\/(.+)$/) && req.method === 'DELETE') {
    const profileName = decodeURIComponent(url.match(/^\/api\/profiles\/(.+)$/)[1]);
    try {
      const config = loadConfig();
      if (!config.profiles[profileName]) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Profil "${profileName}" tidak dijumpai` }));
        return;
      }
      const profileCount = Object.keys(config.profiles).length;
      if (profileCount <= 1) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Tidak boleh padam profil terakhir. Cipta profil lain dahulu.' }));
        return;
      }
      
      // Optionally delete profile's RPT file
      const profile = config.profiles[profileName];
      if (profile.rptFile) {
        const rptPath = path.join(__dirname, 'data', profile.rptFile);
        try { if (fs.existsSync(rptPath)) fs.unlinkSync(rptPath); } catch (e) {}
      }
      
      delete config.profiles[profileName];
      
      // If deleted profile was active, switch to first available
      if (config.activeProfile === profileName) {
        config.activeProfile = Object.keys(config.profiles)[0];
      }
      
      saveConfig(config);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `Profil "${profileName}" berjaya dipadam` }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ralat: ' + e.message }));
    }
  }

  // === CONFIG (Active Profile) ===
  else if (url === '/api/config' && req.method === 'GET') {
    try {
      const config = loadConfig();
      const active = getActiveProfile(config);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        activeProfile: config.activeProfile,
        profileNames: Object.keys(config.profiles),
        ...active
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Gagal membaca config' }));
    }
  }

  else if (url === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const newData = JSON.parse(body);
        const config = loadConfig();
        
        // Preserve multi-profile structure - only update active profile
        const allowed = ['login', 'teacherName', 'schedule', 'groups', 'taughtSubjects'];
        for (const key of allowed) {
          if (newData[key] !== undefined) {
            config.profiles[config.activeProfile][key] = newData[key];
          }
        }
        
        saveConfig(config);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Profil "${config.activeProfile}" berjaya dikemaskini!` }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Format tidak sah: ' + e.message }));
      }
    });
  }

  // === UPLOAD RPT (JSON) - save to profile-specific file ===
  else if (url === '/api/upload-rpt' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const config = loadConfig();
        const profile = getActiveProfile(config);
        const rptFile = profile.rptFile || 'rpt-data.json';
        const rptPath = path.join(__dirname, 'data', rptFile);
        
        const newRpt = JSON.parse(body);
        fs.writeFileSync(rptPath, JSON.stringify(newRpt, null, 2));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Data RPT untuk "${config.activeProfile}" berjaya disimpan ke ${rptFile}!` }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Fail RPT tidak sah: ' + e.message }));
      }
    });
  }

  // === UPLOAD JADUAL (Excel) - save to active profile ===
  else if (url === '/api/upload-jadual' && req.method === 'POST') {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(body);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        
        const worksheet = workbook.worksheets[0];
        const scheduleData = {};
        const subjectYears = {};
        
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= 1) return;
          
          const hari = row.getCell(1).value;
          const waktu = row.getCell(2).value;
          const subjek = row.getCell(3).value;
          const kelas = row.getCell(4).value;
          
          if (hari && subjek && kelas) {
            const kelasStr = kelas.toString().trim();
            if (!scheduleData[kelasStr]) scheduleData[kelasStr] = [];
            
            const dayMap = { 'Isnin': 0, 'Selasa': 1, 'Rabu': 2, 'Khamis': 3, 'Jumaat': 4 };
            const dayIndex = dayMap[hari.toString().trim()] || 0;
            
            const timeMatch = waktu.toString().match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
            if (timeMatch) {
              scheduleData[kelasStr].push({ day: dayIndex, start: timeMatch[1], end: timeMatch[2] });
            }
            
            // Extract subject + year for RPT upload suggestions
            const yearMatch = kelas.toString().match(/(\d)/);
            const year = yearMatch ? parseInt(yearMatch[1]) : null;
            const subjekStr = subjek.toString().trim();
            if (!subjectYears[subjekStr]) subjectYears[subjekStr] = new Set();
            if (year) subjectYears[subjekStr].add(year);
          }
        });
        
        const taughtSubjects = {};
        for (const [subj, years] of Object.entries(subjectYears)) {
          taughtSubjects[subj] = Array.from(years).sort((a, b) => a - b);
        }
        
        const config = loadConfig();
        config.profiles[config.activeProfile].schedule = scheduleData;
        config.profiles[config.activeProfile].taughtSubjects = taughtSubjects;
        saveConfig(config);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: `Jadual untuk "${config.activeProfile}" berjaya diproses!\n${Object.keys(scheduleData).length} kelas, ${Object.keys(taughtSubjects).length} subjek ditemui.`
        }));
      } catch (e) {
        console.error(e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gagal memproses fail Excel: ' + e.message }));
      }
    });
  }

  // === UPLOAD RPT (.docx) - profile-specific ===
  else if (url === '/api/upload-rpt-docx' && req.method === 'POST') {
    const subjects = ['pj4', 'pj5', 'pj6', 'mat6', 'rbt5', 'rbt6'];
    const fields = subjects.map(s => ({ name: s, maxCount: 1 }));
    
    upload.fields(fields)(req, res, (err) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ralat upload: ' + err.message }));
        return;
      }
      
      const processed = [];
      for (const sub of subjects) {
        if (req.files && req.files[sub] && req.files[sub][0]) {
          const oldPath = req.files[sub][0].path;
          const newPath = path.join(__dirname, `rpt_${sub}.docx`);
          fs.renameSync(oldPath, newPath);
          processed.push(sub);
        }
      }
      
      if (processed.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Tiada fail RPT yang dipilih.' }));
        return;
      }
      
      // Get active profile to determine output rpt file
      const config = loadConfig();
      const profile = getActiveProfile(config);
      const rptFile = profile.rptFile || 'rpt-data.json';
      
      // Write a marker file so extract_rpt.py knows which output file to use
      const markerPath = path.join(__dirname, '_active_rpt_file.txt');
      fs.writeFileSync(markerPath, rptFile);
      
       exec(`${pythonCmd} extract_rpt.py`, { cwd: __dirname }, (error, stdout, stderr) => {
        for (const sub of subjects) {
          const filePath = path.join(__dirname, `rpt_${sub}.docx`);
          try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
        }
        try { if (fs.existsSync(markerPath)) fs.unlinkSync(markerPath); } catch (e) {}
        
        if (error) {
          console.error('Python error:', stderr);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Gagal memproses RPT untuk "${config.activeProfile}". Pastikan Python dipasang.\n${stderr}` }));
          return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: `Berjaya memproses ${processed.length} subjek untuk profil "${config.activeProfile}"!\nDisimpan ke: ${rptFile}\n\n${stdout}`
        }));
      });
    });
  }

  else if (url === '/' || url === '/index.html') {
    fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading page');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  }

  else {
    const filePath = path.join(__dirname, 'public', req.url);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      res.writeHead(200);
      res.end(data);
    });
  }
});

function startServer(port) {
  server.listen(port, () => {
    currentPort = port;
    console.log(`\n╔═══════════════════════════════════════════╗`);
    console.log(`║   RPH AUTOMATION INTERFACE                ║`);
    console.log(`║   Server berjalan di:                     ║`);
    console.log(`║   http://localhost:${port}                  `);
    console.log(`╚═══════════════════════════════════════════╝\n`);
    console.log(`\nBuka browser dan pergi ke: http://localhost:${port}`);
  }).on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`Port ${port} sedang digunakan, cuba port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error(e);
     }
   });
 }

 startServer(PORT);
