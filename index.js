const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Load config.json if exists
let appConfig = { activeProfile: 'Akmal', profiles: {} };
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  appConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} else {
  console.log('Warning: config.json not found, using defaults');
}

// Allow environment variable override for deployment
const ACTIVE_PROFILE = process.env.ACTIVE_PROFILE || appConfig.activeProfile || 'Akmal';
const PROFILE_DATA = appConfig.profiles?.[ACTIVE_PROFILE] || appConfig;
const RPT_FILE = process.env.RPT_FILE || PROFILE_DATA.rptFile || 'rpt-data.json';
const TEAM_NAME = process.env.TEACHER_NAME || PROFILE_DATA.teacherName || 'akmal';
const USERNAME = process.env.CIDS_USERNAME || PROFILE_DATA.login?.username || '';
const PASSWORD = process.env.CIDS_PASSWORD || PROFILE_DATA.login?.password || '';

const rptDataPath = path.join(__dirname, 'data', RPT_FILE);
const rptData = fs.existsSync(rptDataPath) 
  ? JSON.parse(fs.readFileSync(rptDataPath, 'utf-8')) 
  : {};

// For backward compatibility with existing code references
const activeProfileName = ACTIVE_PROFILE;
const activeProfile = PROFILE_DATA;

const CLASS_SCHEDULE = activeProfile.schedule || {};
const MIW_GROUPS = activeProfile.groups || [];
const TEACHER_NAME = TEAM_NAME; // Already set above

const CONFIG = {
  url: 'https://asiemodel.net/#login',
  baseUrl: 'https://asiemodel.net/model/',
  username: USERNAME,
  password: PASSWORD,
  headless: process.env.HEADLESS === 'true' || process.env.NODE_ENV === 'production',
  slowMo: 300,
  timeout: 60000,
  teacherName: TEAM_NAME,
  rptFile: RPT_FILE,
  groups: MIW_GROUPS,
  schedule: CLASS_SCHEDULE,
  profileName: ACTIVE_PROFILE
};

console.log(`[PROFILE] Menggunakan profil: ${activeProfileName}`);
console.log(`[RPT] Memuat data dari: ${RPT_FILE}`);

const SUBJECT_MAP = {
  'PJ4': { cls: 'cg_primary-year4-pjpk', nama: 'PJ Tahun 4' },
  'PJ5': { cls: 'cg_primary-year5-pjpk', nama: 'PJ Tahun 5' },
  'PJ6': { cls: 'cg_primary-year6-subject__pendidikan_jasmani_dan_pendidikan_kesihatan_semakan', nama: 'PJ Tahun 6' },
  'RBT5': { cls: 'cg_primary-year5-design_technology', nama: 'RBT Tahun 5' },
  'RBT6': { cls: 'cg_primary-year6-subject__reka_bentuk_dan_teknologi_semakan', nama: 'RBT Tahun 6' },
  'MAT6': { cls: 'cg_primary-year6-subject__matematik_semakan', nama: 'Matematik Tahun 6' },
};

function addDaysToDate(dateStr, daysToAdd) {
  const parts = dateStr.split('/');
  const d = new Date(parts[2], parts[1] - 1, parts[0]);
  d.setDate(d.getDate() + daysToAdd);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

const CUTI_MINGGU = [1, 6, 39, 40, 41, 42];
const MINGGU_TARIKH = rptData.minggu_tarikh || {};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\d{1,2}\.\d{2}\.\d{4}/g, '')
    .replace(/\d{4}\/\d{2}\/\d{2}/g, '')
    .replace(/Kump\s*[A-Z]:\s*\S+/gi, '')
    .replace(/\d{1,2}\s+Kump\s+[A-Z]\s*:\s*\d{1,2}\.\d{2}\.\d{4}/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*[-–]\s*/, '')
    .replace(/\s*[-–]\s*$/, '')
    .trim();
}

function kodRekod(subject, tahun, minggu) {
  const kod = subject;
  const th = { 4: 'T4', 5: 'T5', 6: 'T6' }[tahun] || 'T' + tahun;
  return kod + th + 'M' + minggu;
}

function getRptWeek(rptKey, minggu) {
  const key = String(minggu);
  return rptData[rptKey] && rptData[rptKey][key] ? rptData[rptKey][key] : null;
}

function tarihToDDMMYYYY(ddmmyyyy) {
  const parts = ddmmyyyy.split('/');
  if (parts.length === 3) {
    return parts[0] + '-' + parts[1] + '-' + parts[2];
  }
  return ddmmyyyy;
}

async function login(page) {
  console.log('Logging in...');
  await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(2000);

  try {
    // Check current URL before attempting login
    console.log('Current URL before login:', page.url());
    
    // Take screenshot for debugging (optional)
    // await page.screenshot({ path: 'debug-login-page.png' });
    
    await page.locator('input[name="username"]').fill(CONFIG.username);
    console.log('Username filled');
    
    await page.locator('input[name="password"]').fill(CONFIG.password);
    console.log('Password filled');
    
    await sleep(500);
    
    await page.locator('input[name="submit"][value="Login"]').click();
    console.log('Login button clicked');
    
    await page.waitForURL('**/main.php**', { timeout: 60000 });
    console.log('Logged in. URL: ' + page.url());
  } catch (e) {
    console.log('Login error or already logged in. URL: ' + page.url());
    console.log('Error details:', e.message);
    
    // Re-throw to fail the automation
    throw e;
  }
}

async function createNewRecord(page, rekodName, clsValue) {
  console.log('Creating record: ' + rekodName);
  await page.goto(CONFIG.baseUrl + 'record.php?action=newmiw', { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(3000);

  await page.locator('input[name="miw_name"]').fill(rekodName);
  await page.locator('select[name="cls"]').selectOption(clsValue);

  const checkbox = page.locator('input[name="formatPembelajaran"]');
  if (await checkbox.isChecked()) {
    await checkbox.uncheck();
  }
  await sleep(500);

  await page.locator('input[name="submit"][value="Cipta Rekod"]').click();
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  await sleep(5000);
  console.log('Record created. URL: ' + page.url());
}

async function setTarikhAndMinggu(page, tarikhDari, tarikhHingga, minggu) {
  console.log('  Setting dates: ' + tarikhDari + ' - ' + tarikhHingga + ', week ' + minggu);

  const dateFrom = page.locator('#datetimepicker');
  await dateFrom.clear();
  await dateFrom.fill(tarihToDDMMYYYY(tarikhDari));
  await sleep(500);

  const dateTo = page.locator('#datetimepicker2');
  await dateTo.clear();
  await dateTo.fill(tarihToDDMMYYYY(tarikhHingga));
  await sleep(500);

  await page.locator('#miw_week_start').selectOption(String(minggu));
  await sleep(300);
  await page.locator('#miw_week_end').selectOption(String(minggu));
  await sleep(500);
}

async function selectDropdownBySearch(page, selectId, searchText) {
  const selectEl = page.locator('#' + selectId);
  const options = await selectEl.evaluate(el => [...el.options].map(o => ({ text: o.text.trim(), value: o.value })));

  let bestMatch = null;
  let bestScore = 0;
  const searchLower = searchText.toLowerCase();

  for (const opt of options) {
    if (!opt.value) continue;
    const optLower = opt.text.toLowerCase();
    let score = 0;

    if (optLower === searchLower) score = 100;
    else if (optLower.includes(searchLower)) score = 80;
    else {
      const words = searchLower.split(/\s+/).filter(w => w.length > 2);
      for (const word of words) {
        if (optLower.includes(word)) score += 10;
      }
    }

    if (score > bestScore) { bestScore = score; bestMatch = opt; }
  }

  if (bestMatch && bestScore >= 10) {
    console.log('    Selected [' + selectId + ']: ' + bestMatch.text.substring(0, 60) + ' (score: ' + bestScore + ')');
    await selectEl.selectOption(bestMatch.value);
    await sleep(1000);
    return true;
  }

  console.log('    No match found for [' + selectId + ']: "' + searchText.substring(0, 60) + '" (best: ' + bestScore + ')');
  return false;
}

async function fillMIWFormData(page, rptWeek) {
  if (!rptWeek) return;

  if (rptWeek.bidang) {
    await selectDropdownBySearch(page, 'select_Learning_Area', rptWeek.bidang);
    await sleep(2000);
  }

  try {
    const tajukCount = await page.locator('#select_Tajuk').count();
    if (tajukCount > 0) {
      const tajukOptions = await page.locator('#select_Tajuk').evaluate(el => [...el.options].map(o => o.text.trim()).filter(t => t));
      if (tajukOptions.length > 0 && rptWeek.tajuk) {
        await selectDropdownBySearch(page, 'select_Tajuk', rptWeek.tajuk);
        await sleep(2000);
      }
    }
  } catch (e) {
    console.log('    Skipping Tajuk selection');
  }

  try {
    const skCount = await page.locator('#select_standard_kandungan').count();
    if (skCount > 0) {
      const skOptions = await page.locator('#select_standard_kandungan').evaluate(el => [...el.options].map(o => o.text.trim()).filter(t => t));
      if (skOptions.length > 0 && rptWeek.standard_kandungan) {
        await selectDropdownBySearch(page, 'select_standard_kandungan', rptWeek.standard_kandungan.substring(0, 100));
        await sleep(2000);
      }
    }
  } catch (e) {}

  try {
    const spCount = await page.locator('#select_standard_pembelajaran').count();
    if (spCount > 0) {
      const spOptions = await page.locator('#select_standard_pembelajaran').evaluate(el => [...el.options].map(o => o.text.trim()).filter(t => t));
      if (spOptions.length > 0) {
        const spText = Array.isArray(rptWeek.standard_pembelajaran) ? rptWeek.standard_pembelajaran[0] : rptWeek.standard_pembelajaran;
        if (spText) {
          await selectDropdownBySearch(page, 'select_standard_pembelajaran', spText.substring(0, 100));
          await sleep(2000);
        }
      }
    }
  } catch (e) {}
}

async function clickSimpan(page) {
  await page.locator('input[type="submit"][value="Simpan"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  await sleep(3000);
}

async function fillProfilPelajar(page) {
  console.log('  Filling Profil Pelajar...');
  await page.goto(CONFIG.baseUrl + 'set9.php?action=media9', { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(3000);
  await page.locator('#select_inspro_student_ability_level').selectOption('3509');
  await sleep(500);
  await page.locator('#select_TypMed').selectOption('616');
  await sleep(500);
  await clickSimpan(page);
  console.log('  Profil Pelajar saved');
}

async function fillKemahiran(page) {
  console.log('  Filling Kemahiran...');
  await page.goto(CONFIG.baseUrl + 'set9.php?action=developingskills&v=9.0', { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(3000);
  await page.locator('#select_devski_creativity').selectOption('2437');
  await sleep(300);
  await page.locator('#select_devski_critical_thinking').selectOption('2443');
  await sleep(300);
  await page.locator('#select_methods_technique_activities').selectOption('225');
  await sleep(500);
  await clickSimpan(page);
  console.log('  Kemahiran saved');
}

async function fillKarakter(page) {
  console.log('  Filling Karakter...');
  await page.goto(CONFIG.baseUrl + 'set9.php?action=buildingcharacter&v=9.0', { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(3000);
  await page.locator('#select_buicha_curiosity').selectOption('2605');
  await sleep(300);
  try {
    const nilaiOptions = await page.locator('#select_inculcate_value_sekolahku_sejahtera').evaluate(el => [...el.options].map(o => o.text.trim() + '=' + o.value).filter(t => !t.startsWith('=')));
    if (nilaiOptions.length > 0) {
      await page.locator('#select_inculcate_value_sekolahku_sejahtera').selectOption('2871');
      await sleep(300);
    }
  } catch (e) {}
  await clickSimpan(page);
  console.log('  Karakter saved');
}

function generateRPHContent(rptWeek, subject, sessionInfo) {
  const tajuk = cleanText(rptWeek.tajuk) || 'Aktiviti Berkaitan Mata Pelajaran';
  const sk = cleanText(rptWeek.standard_kandungan) || 'Standard Kandungan';
  const sp = cleanText(rptWeek.standard_pembelajaran) || 'Standard Pembelajaran';
  const spPreview = sp.length > 150 ? sp.substring(0, 150) + '...' : sp;
  const masaStr = sessionInfo ? `<p><strong>Masa:</strong> ${sessionInfo.start} - ${sessionInfo.end}</p>` : '';

  if (subject === 'PJ') {
    return {
      langkah1: masaStr + '<p><strong>Set Induksi (5 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Murid dipimpin melakukan regangan dinamik dan statik secara terkawal di kawasan yang selamat.</li>'
        + '<li>Guru menunjukkan demonstrasi ringkas atau video berkaitan kemahiran <strong>"' + tajuk + '"</strong> untuk menarik minat murid.</li>'
        + '<li>Guru bertanya soalan provokasi:<br>'
        + '"Mengapa teknik ini penting dalam situasi sebenar?"<br>'
        + '"Apakah yang perlu diberi perhatian semasa melakukan kemahiran ini?"<br>'
        + '"Siapa pernah melihat atau melakukan kemahiran ini sebelum ini?"</li>'
        + '<li>Guru menyatakan objektif pembelajaran dan menekankan aspek keselamatan.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Melakukan regangan dengan tertib dan mengikut arahan guru.</li>'
        + '<li>Memerhati demonstrasi / video dengan teliti.</li>'
        + '<li>Menjawab soalan provokasi berdasarkan pengetahuan sedia ada.</li>'
        + '<li>Menyatakan pendapat dan membuat tekaan mengenai tujuan pembelajaran.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Wisel, kon, LCD / tablet (jika video), gelanggang / padang yang selamat.<br>'
        + '<strong>EMK:</strong> Kesihatan dan gaya hidup sihat, keselamatan diri.',

      langkah2: '<p><strong>Langkah 1: Penguasaan Kemahiran Asas (15 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Guru memberikan demonstrasi penuh kemahiran <strong>"' + tajuk + '"</strong> secara berperingkat dengan menerangkan setiap fasa lakuan.</li>'
        + '<li>Murid diminta melakukan latihan secara berperingkat:</li>'
        + '<ul>'
        + '<li><strong>Fasa 1:</strong> Latihan tanpa alat / tanpa halangan (fokus pada postur dan teknik).</li>'
        + '<li><strong>Fasa 2:</strong> Latihan dengan alat / bantuan (contoh: bola, tali, palang).</li>'
        + '<li><strong>Fasa 3:</strong> Latihan dalam pergerakan (bergerak / berlari mengikut situasi).</li>'
        + '</ul>'
        + '<li>Guru memantau setiap murid dan memberikan teguran serta-merta untuk membetulkan kesilapan lakuan.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Memerhati demonstrasi guru dan mengulang semula setiap fasa lakuan.</li>'
        + '<li>Menjalankan latihan secara individu mengikut arahan dan isyarat guru.</li>'
        + '<li>Saling memerhati rakan dan memberi maklum balas tentang postur / lakuan yang betul.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Peralatan berkaitan (bola, tali, kon, palang, tilam), wisel.<br>'
        + '<strong>PAK21:</strong> Think-Pair-Share — murid memerhati pasangan, memberi maklum balas, dan memperbaiki lakuan bersama.<br>'
        + '<strong>Pembelajaran Terbeza:</strong> Murid lemah mendapat bimbingan fizikal langsung dari guru (hand-on guidance); murid mahir mencuba variasi yang lebih sukar.',

      langkah3: '<p><strong>Langkah 2: Aplikasi dalam Permainan / Situasi (15 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Guru membahagikan murid kepada kumpulan kecil (4-6 orang) untuk menjalankan laluan kemahiran (skill circuit) atau permainan kecil yang berkaitan <strong>"' + tajuk + '"</strong>.</li>'
        + '<li>Setiap kumpulan diberi peranan bergilir-gilir: pemain, pemerhati, pengadil, pencatat markah.</li>'
        + '<li>Guru menerapkan peraturan permainan dan menekankan semangat kesukanan (fair play).</li>'
        + '<li>Guru bersoal jawab: "Apakah yang berlaku jika teknik ini tidak dilakukan dengan betul?" dan "Bagaimana pasukan anda boleh meningkatkan strategi?"</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Menjalankan aktiviti laluan kemahiran / permainan kecil mengikut peraturan yang ditetapkan.</li>'
        + '<li>Mengambil giliran dalam setiap peranan (pemain, pengadil, pemerhati).</li>'
        + '<li>Berbincang strategi pasukan dan memberi sokongan kepada rakan sekumpulan.</li>'
        + '<li>Menjawab soalan KBAT guru dengan memberikan justifikasi berdasarkan pemerhatian.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Peralatan laluan kemahiran, borang pemarkahan ringkas, wisel, jam randik.<br>'
        + '<strong>PAK21:</strong> Pembelajaran kolaboratif (kumpulan kecil), peranan bergilir.<br>'
        + '<strong>KBAT:</strong> Menganalisis punca kesilapan dan mencadangkan penambahbaikan teknik.',

      langkah4: '<p><strong>Langkah 3: Persembahan & Penilaian Rakan Sebaya (10 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Guru memilih 2-3 kumpulan untuk mempersembahkan lakuan kemahiran <strong>"' + tajuk + '"</strong> di hadapan kelas.</li>'
        + '<li>Kumpulan lain menilai persembahan berdasarkan kriteria yang ditetapkan guru (ketepatan teknik, kelancaran, keselamatan).</li>'
        + '<li>Guru memberi komen membina selepas setiap persembahan dan mengukuhkan lakuan yang betul.</li>'
        + '<li>Guru membetulkan sebarang salah tanggapan atau kesilapan yang kerap dilakukan.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Mempersembahkan kemahiran di hadapan kelas dengan keyakinan.</li>'
        + '<li>Memerhati persembahan kumpulan lain dan memberi penilaian membina.</li>'
        + '<li>Menerima maklum balas dengan terbuka dan mencatat penambahbaikan yang perlu dilakukan.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Rubrik penilaian ringkas, peralatan persembahan.<br>'
        + '<strong>PAK21:</strong> Gallery Walk / pembentangan kumpulan, penilaian rakan sebaya.<br>'
        + '<strong>KBAT:</strong> Menilai kecekapan teknik dan membandingkan lakuan yang betul dengan yang salah.',

      penutup: '<p><strong>Penutup (5 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Murid dipimpin melakukan aktiviti penyejukan (cooling down) dan regangan statik untuk mengelakkan kecederaan.</li>'
        + '<li>Guru bersama murid membuat rumusan tentang kemahiran <strong>"' + tajuk + '"</strong> dan kepentingannya dalam kehidupan harian serta kesihatan jangka panjang.</li>'
        + '<li>Guru mengemukakan 2-3 soalan lisan untuk menguji pemahaman konsep yang dipelajari.</li>'
        + '<li>Guru memberi pujian atas usaha dan kerjasama yang ditunjukkan.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Melakukan regangan penyejukan dengan tertib.</li>'
        + '<li>Menyatakan perkara yang dipelajari dan kemahiran yang dikuasai hari ini.</li>'
        + '<li>Membantu mengemas peralatan dan memastikan kawasan aktiviti bersih dan selamat.</li>'
        + '<li>Menjawab soalan lisan guru.</li>'
        + '</ol>'
        + '<p><strong>Pentaksiran:</strong> Pemerhatian lakuan, soal jawab, penilaian rakan sebaya, senarai semak kemahiran.<br>'
        + '<strong>Nilai Murni:</strong> Kerjasama, disiplin, keyakinan diri, semangat kesukanan, keselamatan diri.<br>'
        + '<strong>BBM:</strong> Wisel, peralatan regangan.',

      refleksi: '<p><strong>Pentaksiran & Refleksi:</strong></p>'
        + '<ul>'
        + '<li>Bilangan murid yang menguasai objektif: ___ / ___ murid.</li>'
        + '<li>Bilangan murid yang belum menguasai: ___ murid (Nama: _______________).</li>'
        + '<li>Tindakan susulan: Murid yang belum menguasai akan diberi bimbingan tambahan (intervention) pada waktu rehat / kelas pemulihan dengan fokus kepada lakuan asas.</li>'
        + '<li>Murid yang telah menguasai akan diberi aktiviti pengayaan (variasi kemahiran yang lebih mencabar).</li>'
        + '<li>Nilai Murni Yang Ditekankan: Kerjasama, disiplin, keyakinan diri, semangat kesukanan, keselamatan diri.</li>'
        + '<li>Catatan guru: _________________________________________________.</li>'
        + '</ul>'
    };
  }

  if (subject === 'MAT') {
    return {
      langkah1: masaStr + '<p><strong>Set Induksi (5 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Memaparkan gambar atau situasi harian yang melibatkan konsep <strong>"' + tajuk + '"</strong> (contoh: harga barang, sukatan air, ukuran panjang, atau pola nombor).</li>'
        + '<li>Guru bertanya soalan provokasi:<br>'
        + '"Apakah yang kamu perhatikan pada gambar ini?"<br>'
        + '"Bagaimana kita boleh selesaikan masalah ini dalam kehidupan seharian?"<br>'
        + '"Cuba teka jawapan — bagaimana kamu dapat jawapan itu?"</li>'
        + '<li>Memberi peluang kepada 2–3 murid untuk menjawab secara spontan.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Memerhati gambar / situasi dengan teliti.</li>'
        + '<li>Menjawab soalan berdasarkan pemerhatian dan pengetahuan sedia ada.</li>'
        + '<li>Membuat anggaran jawapan awal.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Slaid, gambar, LCD, kad soalan.<br>'
        + '<strong>EMK:</strong> Kreativiti dan inovasi, nilai dan amalan.',

      langkah2: '<p><strong>Langkah 1: Penerokaan Konsep (15 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Menggunakan pendekatan <strong>CPA (Concrete-Pictorial-Abstract)</strong>: bermula dengan bahan konkrit, diikuti lukisan/gambaran, dan akhirnya simbol abstrak.</li>'
        + '<li>Memaparkan contoh langkah demi langkah tentang <strong>"' + tajuk + '"</strong> serta menjelaskan <strong>"' + sk.substring(0, 80) + '"</strong>.</li>'
        + '<li>Menggunakan bahan manipulatif (contoh: bongkah, rod Cuisenaire, jam analog, syiling) untuk membantu pemahaman.</li>'
        + '<li>Menyediakan 2–3 contoh di papan putih dan membimbing murid menyelesaikan bersama.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Mengendalikan bahan manipulatif mengikut arahan guru.</li>'
        + '<li>Menyatakan proses dan konsep yang dipelajari secara lisan.</li>'
        + '<li>Menyalin contoh yang ditunjukkan guru di dalam buku tulis.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Bahan manipulatif (bongkah, kad, jam), papan putih, marker.<br>'
        + '<strong>PAK21:</strong> Think-Pair-Share — murid berfikir secara individu, berbincang dengan pasangan, dan berkongsi penemuan dengan kelas.<br>'
        + '<strong>Pembelajaran Terbeza:</strong> Murid lemah dibimbing langkah demi langkah dengan bahan konkrit; murid mahir diminta menyelesaikan variasi soalan.',

      langkah3: '<p><strong>Langkah 2: Latihan Berperingkat / Lembaran Kerja (20 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Mengedarkan lembaran kerja mengikut aras keupayaan murid:</li>'
        + '<ul>'
        + '<li><strong>Kumpulan A (sederhana/lemah):</strong> Soalan mudah dengan panduan langkah (contoh: 5 soalan asas).</li>'
        + '<li><strong>Kumpulan B (sederhana/mahir):</strong> Soalan aplikasi dan sedikit KBAT.</li>'
        + '<li><strong>Kumpulan C (mahir):</strong> Soalan mencabar termasuk soalan HOTS (Higher Order Thinking).</li>'
        + '</ul>'
        + '<li>Berjalan dan memantau setiap kumpulan, memberi intervensi segera kepada murid yang keliru.</li>'
        + '<li>Murid yang cepat selesai diminta membantu rakan yang memerlukan.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Menyelesaikan lembaran kerja secara individu atau berpasangan.</li>'
        + '<li>Menunjukkan jalan kerja yang lengkap dan tersusun di dalam buku tulis.</li>'
        + '<li>Memerikan kesilapan sendiri dan membetulkannya.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Lembaran kerja mengikut aras, buku tulis, pensel.<br>'
        + '<strong>EMK:</strong> Kreativiti dan inovasi.<br>'
        + '<strong>KBAT:</strong> "Mengapa kaedah ini berkesan?" / "Adakah terdapat cara lain untuk selesaikan?"',

      langkah4: '<p><strong>Langkah 3: Permainan Matematik / Persembahan (15 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Membahagikan murid kepada kumpulan kecil (4–5 orang).</li>'
        + '<li>Mengadakan permainan matematik (contoh: "Siapa Pantas?", "Math Relay", atau "Board Quiz") dengan soalan berkaitan <strong>"' + tajuk + '"</strong>.</li>'
        + '<li>Setiap kumpulan diberi masa yang sama untuk menjawab soalan pada papan mini dan menunjukkan jawapan.</li>'
        + '<li>Murid yang menjawab betul menerima markah; kumpulan yang paling banyak markah menerima pujian.</li>'
        + '<li>Meminta 2–3 murid membentangkan cara penyelesaian mereka di kelas dan menerangkan logik jawapan.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Berbincang dalam kumpulan untuk menyelesaikan soalan secara pantas.</li>'
        + '<li>Menulis jawapan pada papan mini dan menyerahkannya kepada guru.</li>'
        + '<li>Membentangkan strategi penyelesaian di hadapan kelas.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Papan mini, marker, kad soalan, jam randik.<br>'
        + '<strong>PAK21:</strong> Pembelajaran kolaboratif, pembelajaran berbeza (Round Robin).<br>'
        + '<strong>KBAT:</strong> Murid menjelaskan mengapa strategi mereka berkesan.',
        
      penutup: '<p><strong>Penutup (5 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Membuat rumusan tentang konsep / formula utama <strong>"' + tajuk + '"</strong>.</li>'
        + '<li>Mengemukakan 2–3 soalan lisan atau "Exit Ticket" untuk penilaian akhir sebelum kelas tamat.</li>'
        + '<li>Memberi pujian kepada murid yang menunjukkan usaha dan penambahbaikan.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Menjawab soalan guru secara lisan.</li>'
        + '<li>Menyatakan perkara yang dipelajari pada hari ini dan apa yang masih keliru.</li>'
        + '</ol>'
        + '<p><strong>Pentaksiran:</strong> Pemerhatian, soal jawab, semakan lembaran kerja, Exit Ticket.<br>'
        + '<strong>Nilai Murni:</strong> Kerjasama, keyakinan diri, ketelitian, tanggungjawab.<br>'
        + '<strong>BBM:</strong> Kad soalan, slaid.',
          
      refleksi: '<p><strong>Pentaksiran & Refleksi:</strong></p>'
        + '<ul>'
        + '<li>Bilangan murid yang menguasai objektif: ___ / ___ murid.</li>'
        + '<li>Bilangan murid yang belum menguasai: ___ murid (Nama: _______________).</li>'
        + '<li>Tindakan susulan: Murid yang belum menguasai akan diberi latihan pemulihan yang difokuskan pada langkah asas / penggunaan bahan manipulatif.</li>'
        + '<li>Murid yang telah menguasai akan diberi aktiviti pengayaan (soalan KBAT).</li>'
        + '<li>Nilai Murni Yang Ditekankan: Kerjasama, keyakinan diri, ketelitian, tanggungjawab.</li>'
        + '<li>Catatan guru: _________________________________________________.</li>'
        + '</ul>'
    };
  }

  if (subject === 'RBT') {
    return {
      langkah1: masaStr + '<p><strong>Set Induksi (5 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Guru mempamerkan contoh produk siap, simulasi video, atau prototaip berkaitan <strong>"' + tajuk + '"</strong>.</li>'
        + '<li>Guru mengajukan soalan KBAT:<br>'
        + '"Apakah masalah yang cuba diselesaikan oleh reka bentuk ini?"<br>'
        + '"Bahan apakah yang paling sesuai dan selamat digunakan?"<br>'
        + '"Bagaimanakah kita boleh menambahbaik reka bentuk ini?"</li>'
        + '<li>Memberi peluang kepada 2-3 murid untuk menjawab secara spontan.</li>'
        + '<li>Guru menyatakan objektif pembelajaran dan kriteria kejayaan reka bentuk hari ini.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Memerhati contoh produk / simulasi dengan teliti.</li>'
        + '<li>Menjawab soalan KBAT berdasarkan pemerhatian dan pengalaman harian.</li>'
        + '<li>Meneka fungsi dan kelebihan bahan yang digunakan dalam reka bentuk.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Contoh produk siap, video simulasi, LCD, sampel bahan.<br>'
        + '<strong>EMK:</strong> Kreativiti dan inovasi, sains dan teknologi, keusahawanan.',

      langkah2: '<p><strong>Langkah 1: Penerokaan & Lakaran Idea (15 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Murid dibahagikan kepada kumpulan kecil (4-5 orang) untuk menjalankan aktiviti penerokaan bahan dan alat berdasarkan <strong>"' + sk.substring(0, 80) + '"</strong>.</li>'
        + '<li>Guru menerangkan proses reka bentuk secara ringkas: (a) Mengenal pasti masalah, (b) Menjana idea (brainstorming), (c) Membuat lakaran pelan / litar / prototaip awal.</li>'
        + '<li>Guru membimbing murid menggunakan teknik lakaran yang betul (garisan, anotasi, dimensi ringkas).</li>'
        + '<li>Guru memantau setiap kumpulan dan memastikan semua murid terlibat aktif.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Meneroka ciri-ciri bahan dan alat yang disediakan.</li>'
        + '<li>Menjana idea secara kumpulan dan memilih idea terbaik.</li>'
        + '<li>Membuat lakaran pelan / litar / prototaip awal dengan anotasi yang jelas.</li>'
        + '<li>Membentangkan lakaran awal kepada guru untuk mendapat maklum balas.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Kertas lakaran (grid), pensel, pembaris, pemadam, contoh lakaran.<br>'
        + '<strong>PAK21:</strong> Pembelajaran kolaboratif, brainstorming, konsensus kumpulan.<br>'
        + '<strong>Pembelajaran Terbeza:</strong> Murid lemah diberi templat lakaran yang dipermudah; murid mahir dikehendaki melakar dengan anotasi fungsi dan dimensi yang lebih terperinci.',

      langkah3: '<p><strong>Langkah 2: Pembinaan & Ujian Prototaip (20 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Guru menekankan prosedur keselamatan bengkel / makmal yang ketat sebelum aktiviti bermula.</li>'
        + '<li>Murid membina prototaip / simulasi berdasarkan lakaran yang telah dipersetujui.</li>'
        + '<li>Guru memantau setiap kumpulan, memastikan penggunaan alat yang betul dan memberi bimbingan segera jika terdapat kesilapan teknik.</li>'
        + '<li>Murid menjalankan ujian fungsi ke atas prototaip mereka dan merekodkan keputusan (berjaya / gagal / perlu penambahbaikan).</li>'
        + '<li>Jika prototaip gagal, guru membimbing murid menganalisis punca kegagalan dan mencadangkan penambahbaikan serta-merta.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Membina prototaip mengikut lakaran dengan mematuhi langkah keselamatan.</li>'
        + '<li>Bekerjasama dalam kumpulan untuk menyelesaikan masalah pembinaan.</li>'
        + '<li>Menjalankan ujian fungsi dan merekodkan pemerhatian / keputusan ujian.</li>'
        + '<li>Menganalisis punca kegagalan (jika ada) dan mencadangkan penambahbaikan.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Bahan pembinaan (kadbod, kayu, wayar, komponen litar), alat (gunting, pemotong, playar), borang ujian fungsi.<br>'
        + '<strong>EMK:</strong> Keselamatan, tanggungjawab alam sekitar (penggunaan bahan kitar semula).<br>'
        + '<strong>KBAT:</strong> Menganalisis punca kegagalan dan mencipta solusi penambahbaikan.',

      langkah4: '<p><strong>Langkah 3: Pembentangan & Penambahbaikan (10 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Setiap kumpulan membentangkan prototaip mereka, menjelaskan fungsi, bahan yang digunakan, dan keputusan ujian.</li>'
        + '<li>Guru menggalakkan kumpulan lain memberi soalan dan maklum balas membina (peer review) berdasarkan kriteria yang ditetapkan.</li>'
        + '<li>Guru membuat rumusan tentang ciri-ciri reka bentuk yang baik, berkesan, dan selamat.</li>'
        + '<li>Guru memberi pujian kepada kumpulan yang menunjukkan kreativiti dan kerjasama yang cemerlang.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Membentangkan prototaip dengan yakin, menerangkan fungsi dan keputusan ujian.</li>'
        + '<li>Menjawab soalan dan menerima maklum balas daripada rakan dan guru.</li>'
        + '<li>Mencatat penambahbaikan yang perlu dilakukan pada prototaip mereka.</li>'
        + '<li>Memberi maklum balas membina kepada kumpulan lain.</li>'
        + '</ol>'
        + '<p><strong>BBM:</strong> Prototaip, slaid pembentangan (jika ada), rubrik penilaian rakan sebaya.<br>'
        + '<strong>PAK21:</strong> Pembentangan kumpulan, penilaian rakan sebaya (peer review).<br>'
        + '<strong>KBAT:</strong> Menilai keberkesanan reka bentuk dan mempertahankan idea dengan hujah yang kukuh.',

      penutup: '<p><strong>Penutup (5 minit)</strong></p>'
        + '<p><strong>Aktiviti Guru:</strong></p><ol>'
        + '<li>Guru meminta murid membuat refleksi kendiri: "Apa yang saya pelajari hari ini?" dan "Apakah yang akan saya ubah jika saya buat semula?"</li>'
        + '<li>Guru menekankan kepentingan proses reka bentuk yang berulang (iteratif) untuk mencapai hasil yang terbaik.</li>'
        + '<li>Guru memberi pujian kepada murid yang menunjukkan usaha, kreativiti, dan kerjasama yang cemerlang.</li>'
        + '</ol>'
        + '<p><strong>Aktiviti Murid:</strong></p><ol>'
        + '<li>Menyatakan perkara yang dipelajari dan cabaran yang dihadapi.</li>'
        + '<li>Bertanggungjawab mengemas kawasan kerja, membersihkan alat, dan menyimpan bahan dengan selamat mengikut prosedur.</li>'
        + '<li>Menjawab soalan refleksi guru.</li>'
        + '</ol>'
        + '<p><strong>Pentaksiran:</strong> Pemerhatian, semakan lakaran, keputusan ujian prototaip, penilaian rakan sebaya.<br>'
        + '<strong>Nilai Murni:</strong> Kerjasama, kreativiti, ketelitian, tanggungjawab, menghargai sumbangan rakan.<br>'
        + '<strong>BBM:</strong> Borang refleksi, peralatan pembersihan.',

      refleksi: '<p><strong>Pentaksiran & Refleksi:</strong></p>'
        + '<ul>'
        + '<li>Bilangan murid yang menguasai objektif: ___ / ___ murid.</li>'
        + '<li>Bilangan murid yang belum menguasai: ___ murid (Nama: _______________).</li>'
        + '<li>Tindakan susulan: Murid yang belum menguasai akan dibimbing semula tentang langkah keselamatan / asas lakaran pada sesi seterusnya.</li>'
        + '<li>Murid yang telah menguasai akan diberi aktiviti pengayaan (menambah ciri canggih pada prototaip).</li>'
        + '<li>Nilai Murni Yang Ditekankan: Kerjasama, kreativiti, ketelitian, tanggungjawab, menghargai sumbangan rakan.</li>'
        + '<li>Catatan guru: _________________________________________________.</li>'
        + '</ul>'
    };
  }

  return {
    langkah1: masaStr + '<p><strong>Set Induksi (5 minit):</strong></p><ol><li>Guru mempamerkan bahan / situasi harian yang berkaitan dengan <strong>"' + tajuk + '"</strong>.</li><li>Guru mengajukan soalan pemangkin untuk mengaitkan dengan pengetahuan sedia ada.</li><li>Murid membuat pemerhatian dan membuat anggaran awal.</li><li>Guru menyatakan objektif pembelajaran dengan jelas.</li></ol>',
    langkah2: '<p><strong>Langkah 1: Penerokaan Konsep (15 minit)</strong></p><ol><li>Murid menjalankan aktiviti penerokaan menggunakan bahan manipulatif atau bahan bantu mengajar.</li><li>Guru membimbing murid melalui demonstrasi dan contoh langkah demi langkah.</li><li><strong>Pembelajaran Terbeza:</strong> Murid yang lemah diberi bimbingan langkah demi langkah, murid yang mahir diberi soalan yang lebih mencabar.</li><li><strong>PAk-21:</strong> Murid berfikir secara individu, berbincang dengan pasangan, dan berkongsi penemuan.</li></ol>',
    langkah3: '<p><strong>Langkah 2: Latihan Berperingkat (15 minit)</strong></p><ol><li>Murid menjalankan aktiviti latihan secara berperingkat: soalan asas, aplikasi, dan KBAT.</li><li>Murid yang cepat selesai diberi aktiviti pengayaan, manakala murid yang memerlukan bantuan mendapat intervensi langsung dari guru.</li><li><strong>KBAT:</strong> Guru mengemukakan soalan aras tinggi untuk menguji kefahaman mendalam.</li></ol>',
    langkah4: '<p><strong>Langkah 3: Pembentangan & Refleksi (10 minit)</strong></p><ol><li>Beberapa murid dipilih untuk membentangkan cara penyelesaian mereka di papan putih.</li><li>Murid lain menilai kesahihan strategi yang dibentangkan.</li><li>Guru mengukuhkan konsep yang betul dan membetulkan salah tanggapan.</li></ol>',
    penutup: '<p><strong>Penutup (5 minit):</strong></p><ol><li>Murid membuat rumusan tentang konsep utama yang dipelajari hari ini.</li><li>Aktiviti "Exit Ticket": Murid menjawab satu soalan ringkas sebagai bukti pemahaman.</li><li>Guru memberikan teguran membina dan memuji usaha murid.</li></ol>',
    refleksi: '<p><strong>Refleksi & Impak:</strong></p><ul><li>Bilangan murid yang menguasai objektif: ___ / ___ murid.</li><li>Bilangan murid yang belum menguasai: ___ murid (Nama: _______________).</li><li>Tindakan susulan: Murid yang belum menguasai akan diberi latihan pemulihan yang difokuskan pada langkah asas.</li><li>Catatan guru: _________________________________________________.</li></ul>'
  };
}


async function fillRPHForm(page, rptWeek, className, subject, sessionInfo) {
  console.log('    Filling RPH form for ' + className + '...');
  const content = generateRPHContent(rptWeek, subject, sessionInfo);

  const fieldMap = [
    { name: 'rph[InsMLe][858][875]', content: content.langkah1, label: 'Set Induksi' },
    { name: 'rph[InsMLe][858][864]', content: content.langkah2, label: 'Aktiviti 1' },
    { name: 'rph[InsMLe][858][865]', content: content.langkah3, label: 'Aktiviti 2' },
    { name: 'rph[InsMLe][858][866]', content: content.langkah4, label: 'Aktiviti 3' },
    { name: 'rph[InsMLe][858][876]', content: content.penutup, label: 'Penutup' },
    { name: 'rph[impak]', content: content.refleksi, label: 'Refleksi/Impak' },
  ];

  for (const field of fieldMap) {
    try {
      const filled = await page.evaluate(({ name, text }) => {
        const ta = document.querySelector('textarea[name="' + name + '"]');
        if (!ta) return { ok: false, error: 'not found' };
        ta.value = text;
        try {
          const mceId = ta.id;
          if (mceId && window.tinymce) {
            const editor = window.tinymce.get(mceId);
            if (editor) { editor.setContent(text); editor.fire('change'); }
          }
        } catch {}
        return { ok: true };
      }, { name: field.name, text: field.content });
      console.log('    ' + field.label + ': ' + (filled.ok ? 'OK' : filled.error));
    } catch (e) {
      console.log('    ' + field.label + ' ERROR: ' + e.message);
    }
  }

  // FILL TIME FIELDS IF SESSION INFO AVAILABLE
  if (sessionInfo && sessionInfo.start && sessionInfo.end) {
    try {
      await page.evaluate(({ start, end }) => {
        const from = document.getElementById('timepicker1');
        const to = document.getElementById('timepicker2');
        if (from) from.value = start;
        if (to) to.value = end;
      }, { start: sessionInfo.start, end: sessionInfo.end });
      console.log('    Time fields: ' + sessionInfo.start + ' - ' + sessionInfo.end + ' OK');
    } catch (e) {
      console.log('    Time fields ERROR: ' + e.message);
    }
  }

  try {
    await page.locator('input[value="Simpan RPH"]').first().click();
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    console.log('    RPH SAVED for ' + className);
    await sleep(3000);
    return true;
  } catch (e) {
    console.log('    Simpan error: ' + e.message);
  }
  return false;
}

const CLASS_NAME_MAP = {
  '4I': '4 INOVATIF',
  '4S': '4 SPORTIF',
  '5A': '5 AFEKTIF',
  '5I': '5 INOVATIF',
  '5K': '5 KREATIF',
  '5P': '5 POSITIF',
  '6G': '6 GENERATIF',
  '6I': '6 INOVATIF',
  '6K': '6 KREATIF',
  'MAT6I': '6 INOVATIF',
};

async function ciptaRPH(page, className, rptWeek, tarikh, subject) {
  console.log('  Creating RPH for ' + className + '...');
  await page.goto(CONFIG.baseUrl + 'miw9.php?action=miw', { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(3000);

  const classOptions = await page.locator('#caller_learning_profiles').evaluate(el => [...el.options].map(o => o.text.trim() + '=' + o.value).filter(t => !t.startsWith('=') && !t.startsWith('Cipta') && !t.startsWith('Tambah')));

  let classValue = null;
  const targetName = (CLASS_NAME_MAP[className] || className).toLowerCase();

  // 1. Cari padanan TEPAT (exact match) dahulu
  for (const opt of classOptions) {
    const parts = opt.split('=');
    const optText = parts[0].toLowerCase();
    if (optText === targetName) {
      classValue = parts[1];
      break;
    }
  }

  // 2. Jika tiada padanan tepat, cari yang mengandungi nama kelas (fallback)
  if (!classValue) {
    for (const opt of classOptions) {
      const parts = opt.split('=');
      const optText = parts[0].toLowerCase();
      // Pastikan ia bukan kelas gabungan yang salah (contoh: cari '5k' tapi dapat '5 afektif & 5 kreatif')
      // Kita hanya accept jika perkataan target adalah standalone atau di hujung/awal
      if (optText === targetName || optText.includes(' ' + targetName) || optText.includes(targetName + ' ')) {
        classValue = parts[1];
        break;
      }
    }
  }

  // 3. Fallback terakhir: guna className asal
  if (!classValue) {
    for (const opt of classOptions) {
      const parts = opt.split('=');
      if (parts[0].toLowerCase().includes(className.toLowerCase())) {
        classValue = parts[1];
        break;
      }
    }
  }

  if (!classValue) {
    for (const opt of classOptions) {
      const parts = opt.split('=');
      if (parts[0].toLowerCase().includes(className.toLowerCase())) {
        classValue = parts[1];
        break;
      }
    }
  }

  if (classValue) {
    await page.locator('#caller_learning_profiles').selectOption(classValue);
    await sleep(3000);

    if (tarikh && tarikh.length >= 1) {
      const tarikhParts = tarikh[0].split('/');
      if (tarikhParts.length === 3) {
        const tarikhRPH = tarikhParts[0] + '-' + tarikhParts[1] + '-' + tarikhParts[2];
        const masaInfo = tarikh.length >= 4 ? ' (' + tarikh[2] + ' - ' + tarikh[3] + ')' : '';
        console.log('    Setting RPH date: ' + tarikhRPH + masaInfo);
        try {
          await page.locator('#rphdatetimepicker').fill(tarikhRPH);
          await sleep(500);
        } catch (e) {}
      }
    }

    const dialogHandler = async dialog => {
      console.log('    Dialog: ' + dialog.type() + ' - ' + dialog.message().substring(0, 100));
      await dialog.accept().catch(() => {});
    };
    page.on('dialog', dialogHandler);

    try {
      await page.locator('input[type="button"][value="Cipta RPH"]').click();
    } catch (e) {}
    await sleep(8000);

    const sessionInfo = tarikh && tarikh.length >= 4 ? { start: tarikh[2], end: tarikh[3] } : null;
    await fillRPHForm(page, rptWeek, className, subject, sessionInfo);
    console.log('    Final URL: ' + page.url());

    page.removeListener('dialog', dialogHandler);
  } else {
    console.log('    No class value found for ' + className);
  }
}

async function processWeek(page, group, minggu) {
  const rptWeek = getRptWeek(group.rptKey, minggu);
  const tarikh = MINGGU_TARIKH[String(minggu)];

  if (CUTI_MINGGU.includes(minggu)) return;
  if (!rptWeek || rptWeek.is_cuti || rptWeek.is_uasa) {
    console.log('Week ' + minggu + ' (' + group.subKey + '): No RPT data - skipping');
    return;
  }

  const rekodName = kodRekod(group.subject, group.tahun, minggu);
  const subMap = SUBJECT_MAP[group.subKey];

  console.log('\n=== Processing ' + rekodName + ' ===');

  try {
    await createNewRecord(page, rekodName, subMap.cls);

    if (tarikh) {
      await setTarikhAndMinggu(page, tarikh[0], tarikh[1], minggu);
    }

    await fillMIWFormData(page, rptWeek);
    await clickSimpan(page);

    await fillProfilPelajar(page);
    await fillKemahiran(page);
    await fillKarakter(page);

    for (const className of group.classSchedule) {
      const scheduleKey = className === 'MAT6I' ? 'MAT6I' : className;
      const slots = CLASS_SCHEDULE[scheduleKey] || [];
      
      for (const slot of slots) {
        let sessionTarikh = tarikh;
        if (tarikh && tarikh.length >= 1) {
          const sessionDate = addDaysToDate(tarikh[0], slot.day);
          sessionTarikh = [sessionDate, sessionDate, slot.start, slot.end];
        }
        await ciptaRPH(page, className, rptWeek, sessionTarikh, group.subject);
        await sleep(2000);
      }
    }

    console.log('Completed: ' + rekodName);
  } catch (e) {
    console.error('Error processing ' + rekodName + ': ' + e.message);
    try {
      await page.screenshot({ path: path.join(__dirname, 'data', 'error-' + rekodName + '.png'), fullPage: true });
    } catch {}
  }
}

async function main() {
  console.log('Starting CIDS Automation...');

  const startWeek = parseInt(process.argv[2] || '2');
  const endWeek = parseInt(process.argv[3] || '38');
  const targetGroup = process.argv[4] || 'all';

  console.log('Weeks: ' + startWeek + ' to ' + endWeek);
  console.log('Group: ' + targetGroup);

   const launchOptions = {
     headless: CONFIG.headless,
     slowMo: CONFIG.slowMo,
     channel: 'chrome',
     args: [
       '--no-sandbox',
       '--disable-setuid-sandbox',
       '--disable-dev-shm-usage',
       '--disable-gpu'
     ]
   };

   const browser = await chromium.launch(launchOptions);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.timeout);

  try {
    await login(page);

    for (let minggu = startWeek; minggu <= endWeek; minggu++) {
      if (CUTI_MINGGU.includes(minggu)) continue;

      for (const group of MIW_GROUPS) {
        if (targetGroup !== 'all' && group.rptKey !== targetGroup) continue;
        await processWeek(page, group, minggu);
        await sleep(2000);
      }
    }

    console.log('\n=== Automation Complete ===');
  } catch (e) {
    console.error('Fatal error: ' + e.message);
    try {
      await page.screenshot({ path: path.join(__dirname, 'data', 'fatal-error.png'), fullPage: true });
    } catch {}
  } finally {
    await sleep(3000);
    await browser.close();
  }
}

main().catch(console.error);
