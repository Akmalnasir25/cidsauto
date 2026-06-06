const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  url: 'https://asiemodel.net/#login',
  baseUrl: 'https://asiemodel.net/model/',
  username: 'CIDSGURU30770',
  password: 'Ikam@l2521',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  console.log('1. Login...');
  await page.goto(CONFIG.url, { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(3000);
  await page.locator('input[name="username"]').fill(CONFIG.username);
  await page.locator('input[name="password"]').fill(CONFIG.password);
  await sleep(500);
  await page.locator('input[name="submit"][value="Login"]').click();
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await sleep(3000);

  console.log('2. Create fresh test record...');
  await page.goto(CONFIG.baseUrl + 'record.php?action=newmiw', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(3000);
  await page.locator('input[name="miw_name"]').fill('TEST_EXPLORER_W2');
  await page.locator('select[name="cls"]').selectOption('cg_primary-year6-subject__pendidikan_jasmani_dan_pendidikan_kesihatan_semakan');
  const cb = page.locator('input[name="formatPembelajaran"]');
  if (await cb.isChecked()) await cb.uncheck();
  await sleep(500);
  await page.locator('input[name="submit"][value="Cipta Rekod"]').click();
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await sleep(5000);
  console.log('   URL after create: ' + page.url());

  console.log('\n3. Learning Area dropdown:');
  const laOpts = await page.locator('#select_Learning_Area').evaluate(el => [...el.options].map(o => o.text.trim() + ' = ' + o.value).filter(t => !t.startsWith('=')));
  for (const opt of laOpts) console.log('  ' + opt);

  console.log('\n4. Selecting GIMNASTIK ASAS and checking Tajuk...');
  await page.locator('#select_Learning_Area').selectOption({ label: 'BIDANG KEMAHIRAN: GIMNASTIK ASAS' });
  await sleep(5000);

  const tajukAll = await page.locator('#select_Tajuk').evaluate(el => [...el.options].map(o => o.text.trim() + ' = ' + o.value));
  console.log('Tajuk raw (' + tajukAll.length + '):');
  for (const opt of tajukAll) console.log('  [' + opt + ']');

  if (tajukAll.length > 1) {
    const firstVal = tajukAll[1].split(' = ')[1];
    console.log('\n5. Selecting first tajuk: ' + tajukAll[1]);
    await page.locator('#select_Tajuk').selectOption(firstVal);
    await sleep(5000);

    const skAll = await page.locator('#select_standard_kandungan').evaluate(el => [...el.options].map(o => o.text.trim().substring(0, 120) + ' = ' + o.value));
    console.log('SK raw (' + skAll.length + '):');
    for (const opt of skAll) console.log('  [' + opt + ']');

    if (skAll.length > 1) {
      const skVal = skAll[1].split(' = ')[1];
      await page.locator('#select_standard_kandungan').selectOption(skVal);
      await sleep(5000);

      const spAll = await page.locator('#select_standard_pembelajaran').evaluate(el => [...el.options].map(o => o.text.trim().substring(0, 120) + ' = ' + o.value));
      console.log('\nSP raw (' + spAll.length + '):');
      for (const opt of spAll) console.log('  [' + opt + ']');
    }
  }

  console.log('\n6. Check Jadual Waktu for class names...');
  await page.goto(CONFIG.baseUrl + 'teachers9.php?action=waktumengajar', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(3000);
  await page.screenshot({ path: path.join(__dirname, 'data', 'jadual-waktu.png'), fullPage: true });
  const jHtml = await page.content();
  fs.writeFileSync(path.join(__dirname, 'data', 'jadual-waktu.html'), jHtml, 'utf-8');

  const tables = await page.locator('table:visible').all();
  console.log('Tables: ' + tables.length);
  for (let i = 0; i < tables.length; i++) {
    const text = await tables[i].textContent();
    const trimmed = text.trim().substring(0, 300);
    if (trimmed) console.log('Table ' + i + ': ' + trimmed);
  }

  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
