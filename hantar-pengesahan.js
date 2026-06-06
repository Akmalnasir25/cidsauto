const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // 1. Login
  console.log('1. Login...');
  await page.goto('https://asiemodel.net/#login', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(2000);
  await page.locator('input[name="username"]').fill('CIDSGURU30770');
  await page.locator('input[name="password"]').fill('Ikam@l2521');
  await page.locator('input[name="submit"][value="Login"]').click();
  await page.waitForURL('**/main.php**', { timeout: 30000 });
  await sleep(3000);
  console.log('   Logged in');

  // 2. Navigate
  console.log('2. Navigate to list...');
  await page.locator('a:has-text("eRPH")').first().click();
  await sleep(2000);
  await page.locator('a:has-text("Rekod")').first().hover();
  await sleep(1000);
  await page.locator('a:has-text("Buka Rekod"), a[href*="listmiw"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await sleep(3000);

  // 3. Select Akmal + Cari + Mar
  console.log('3. Filter Akmal + Cari + Mar...');
  const userVal = await page.locator('#select_user').evaluate(el => {
    const o = Array.from(el.options).find(o => o.text.toLowerCase().includes('akmal'));
    return o ? o.value : null;
  });
  if (userVal) {
    await page.locator('#select_user').selectOption(userVal);
    await sleep(1000);
  }
  await page.locator('input[name="filter"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await sleep(5000);
  await page.locator('a:has-text("Mar")').first().click().catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await sleep(8000);
  
  console.log('   URL after Mar: ' + page.url());
  await page.screenshot({ path: 'data/after-mar-hantar.png', fullPage: true });

  // 4. Get Minggu 8 MIW IDs
  const miwRecords = await page.evaluate(() => {
    const trs = document.querySelectorAll('table tbody tr');
    const results = [];
    trs.forEach((row, i) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;
      const subject = (cells[2]?.textContent.trim() || '');
      const hantarLink = Array.from(row.querySelectorAll('a')).find(a => a.textContent.trim() === 'Hantar Untuk Pengesahan');
      
      // Debug info
      if (subject.includes('M8') || subject.includes('M7')) {
        console.log('Found row ' + i + ': subject="' + subject.substring(0,40) + '", hasHantar=' + !!hantarLink);
      }
      
      if (!hantarLink || !subject.includes('M8')) return;
      const onclick = hantarLink.getAttribute('onclick') || '';
      const miwMatch = onclick.match(/miw_id=(\d+)/);
      results.push({ row: i, subject: subject.substring(0, 40), miwId: miwMatch ? miwMatch[1] : null });
    });
    return results;
  });

  console.log('4. Minggu 8 records to submit: ' + miwRecords.length);
  miwRecords.forEach(r => console.log('   ' + r.subject));

  // 5. Submit each record via popup
  let successCount = 0;
  for (const rec of miwRecords) {
    console.log('\n5.' + (successCount + 1) + ' Submitting: ' + rec.subject);

    const popupUrl = 'https://asiemodel.net/model/rph.php?action=submitForEndorsement&miw_id=' + rec.miwId;
    const popupPage = await ctx.newPage();

    popupPage.on('dialog', async d => {
      console.log('   Dialog: ' + d.message().substring(0, 100));
      await d.accept().catch(() => {});
    });

    await popupPage.goto(popupUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000);

    // Tick ALL checkboxes first (Pilih Semua)
    console.log('   Tick all checkboxes...');
    const checkboxes = await popupPage.locator('input[type="checkbox"]').all();
    for (const cb of checkboxes) {
      if (!(await cb.isChecked())) {
        await cb.check();
        await sleep(200);
      }
    }
    console.log('   Ticked ' + checkboxes.length + ' checkboxes');

    await popupPage.screenshot({ path: 'data/popup-' + rec.miwId + '-ticked.png', fullPage: true });

    // Then click "Sahkan Penghantaran"
    const sahkanBtn = popupPage.locator('input[value="Sahkan Penghantaran"], button:has-text("Sahkan Penghantaran")').first();
    if (await sahkanBtn.count() > 0) {
      await sahkanBtn.click();
      await sleep(5000);
      console.log('   Clicked "Sahkan Penghantaran"!');
      successCount++;
    } else {
      console.log('   No "Sahkan Penghantaran" button found');
      const btns = await popupPage.evaluate(() => {
        return Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')).map(b => (b.value || b.textContent).trim().substring(0, 40)).filter(t => t);
      });
      console.log('   Available buttons: ' + btns.join(' | '));
    }

    await popupPage.screenshot({ path: 'data/popup-' + rec.miwId + '-done.png', fullPage: true });
    await sleep(2000);
    await popupPage.close().catch(() => {});
    await sleep(1000);
  }

  console.log('\n=== Summary: ' + successCount + '/' + miwRecords.length + ' RPH submitted for pengesahan ===');
  await page.screenshot({ path: 'data/final-status.png', fullPage: true });
  await sleep(3000);
  await browser.close();
})().catch(e => console.error('Error: ' + e.message));
