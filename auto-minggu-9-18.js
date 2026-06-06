const { execSync } = require('child_process');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const configPath = path.join(__dirname, 'config.json');
const appConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const activeProfileName = appConfig.activeProfile || 'Cikgu Akmal';
const activeProfile = appConfig.profiles?.[activeProfileName] || appConfig;
const searchName = (activeProfile.teacherName || activeProfile.login?.username || 'akmal').toLowerCase();

const CONFIG = {
  url: 'https://asiemodel.net/#login',
  baseUrl: 'https://asiemodel.net/model/',
  username: activeProfile.login?.username || '',
  password: activeProfile.login?.password || '',
};

console.log(`[PROFILE] Aktif: ${activeProfileName} | Carian: "${searchName}"`);

async function runEndorsement() {
  console.log('Memulakan proses penghantaran pengesahan...');
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  page.on('dialog', async d => {
    console.log('   [Dialog] ' + d.message().substring(0, 100));
    await d.accept().catch(() => {});
  });

  console.log('1. Login...');
  await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(2000);
  await page.locator('input[name="username"]').fill(CONFIG.username);
  await page.locator('input[name="password"]').fill(CONFIG.password);
  await page.locator('input[name="submit"][value="Login"]').click();
  await page.waitForURL('**/main.php**', { timeout: 30000 });
  await sleep(3000);

  console.log('2. Navigate to Senarai Rekod...');
  await page.locator('a:has-text("eRPH")').first().click();
  await sleep(2000);
  await page.locator('a:has-text("Rekod")').first().hover();
  await sleep(1000);
  await page.locator('a:has-text("Buka Rekod"), a[href*="listmiw"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await sleep(3000);

  console.log('3. Filter Nama: ' + searchName + ' + Cari...');
  const userVal = await page.locator('#select_user').evaluate(el => {
    const o = Array.from(el.options).find(o => o.text.toLowerCase().includes(searchName));
    return o ? o.value : null;
  });
  if (userVal) {
    await page.locator('#select_user').selectOption(userVal);
    await sleep(1000);
  }
  await page.locator('input[name="filter"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await sleep(5000);

  // Bulan yang merangkumi Minggu 8 hingga 18
  const months = ['Mar', 'Apr', 'May', 'Jun'];
  let totalSubmitted = 0;

  for (const month of months) {
    console.log(`\n4. Memproses bulan: ${month}...`);
    
    // Klik tab bulan
    const monthLink = page.locator(`a:has-text("${month}")`).first();
    if (await monthLink.count() > 0) {
      await monthLink.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await sleep(5000);
    } else {
      console.log(`   Tab ${month} tidak dijumpai, skip.`);
      continue;
    }

    // Cari semua link "Hantar Untuk Pengesahan" atau "Hantar"
    const records = await page.evaluate(() => {
      const trs = document.querySelectorAll('table tr');
      const results = [];
      trs.forEach((row, i) => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return;
        const subject = (cells[2]?.textContent.trim() || '');
        const hantarLink = Array.from(row.querySelectorAll('a')).find(a => {
          const t = a.textContent.trim().toLowerCase();
          return t.includes('hantar') && t.includes('pengesahan') || t === 'hantar';
        });
        if (!hantarLink) return;
        const onclick = hantarLink.getAttribute('onclick') || '';
        const miwMatch = onclick.match(/miw_id=(\d+)/);
        results.push({ row: i, subject: subject.substring(0, 40), miwId: miwMatch ? miwMatch[1] : null });
      });
      return results;
    });

    console.log(`   Dijumpai ${records.length} rekod belum sah untuk ${month}.`);

    for (const rec of records) {
      if (!rec.miwId) continue;
      console.log(`   Menghantar: ${rec.subject} (ID: ${rec.miwId})`);

      const popupUrl = `${CONFIG.baseUrl}rph.php?action=submitForEndorsement&miw_id=${rec.miwId}`;
      const popupPage = await ctx.newPage();
      
      popupPage.on('dialog', async d => {
        console.log('      [Popup Dialog] ' + d.message().substring(0, 100));
        await d.accept().catch(() => {});
      });

      await popupPage.goto(popupUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(3000);

      // 1. Pilih semua checkbox dahulu
      const checkboxes = await popupPage.locator('input[type="checkbox"]').all();
      for (const cb of checkboxes) {
        if (!(await cb.isChecked())) {
          await cb.check();
          await sleep(200);
        }
      }
      console.log(`      ✓ Ditanda ${checkboxes.length} checkbox`);

      // 2. Klik butang "Sahkan Penghantaran"
      const sahkanBtn = popupPage.locator('input[value="Sahkan Penghantaran"], button:has-text("Sahkan Penghantaran")').first();
      if (await sahkanBtn.count() > 0) {
        await sahkanBtn.click();
        await sleep(4000); // Tunggu proses simpan
        console.log('      ✓ Berjaya dihantar!');
        totalSubmitted++;
      } else {
        console.log('      ⚠ Butang "Sahkan Penghantaran" tidak dijumpai.');
      }

      await popupPage.close().catch(() => {});
      await sleep(1000);
    }
  }

  console.log(`\n=== SELESAI: ${totalSubmitted} rekod berjaya dihantar untuk pengesahan ===`);
  await page.screenshot({ path: 'data/final-endorsement-status.png', fullPage: true });
  await sleep(3000);
  await browser.close();
}

async function main() {
  console.log('=========================================================');
  console.log('  AUTOMASI RPH MINGGU 8 HINGGA 18 + HANTAR PENGESAHAN');
  console.log('=========================================================\n');

  console.log('>>> LANGKAH 1: Menjana dan Isi RPH (Minggu 9 - 18)');
  console.log('Proses ini mungkin mengambil masa 10-20 minit. Sila jangan tutup tetingkap browser.\n');
  
  try {
    // Jalankan index.js untuk minggu 8 hingga 18
    // timeout: 0 bermaksud tiada had masa, biarkan ia selesai
    execSync('node index.js 8 18 all', { stdio: 'inherit', timeout: 0 });
  } catch (error) {
    console.log('\n[Nota]: Proses penjanaan RPH selesai atau terganggu. Melanjutkan ke langkah pengesahan...');
  }

  console.log('\n>>> LANGKAH 2: Hantar Semua RPH Untuk Pengesahan');
  await runEndorsement();

  console.log('\n=========================================================');
  console.log('  SEMUA PROSES SELESAI! Sila semak CIDS untuk pengesahan.');
  console.log('=========================================================');
}

main().catch(e => {
  console.error('Fatal Error:', e.message);
  process.exit(1);
});
