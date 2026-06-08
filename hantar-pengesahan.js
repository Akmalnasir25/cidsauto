const { chromium } = require('playwright');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Mapping minggu ke bulan (2026 Malaysia - typical week dates)
const MINGGU_TARIKH = {
  1: '12/01/2026', 2: '19/01/2026', 3: '26/01/2026', 4: '02/02/2026',
  5: '09/02/2026', 6: '16/02/2026', 7: '23/02/2026', 8: '02/03/2026',
  9: '09/03/2026', 10: '16/03/2026', 11: '23/03/2026', 12: '30/03/2026',
  13: '06/04/2026', 14: '13/04/2026', 15: '20/04/2026', 16: '27/04/2026',
  17: '04/05/2026', 18: '11/05/2026', 19: '18/05/2026', 20: '25/05/2026',
  21: '01/06/2026', 22: '08/06/2026', 23: '15/06/2026', 24: '22/06/2026',
  25: '29/06/2026', 26: '06/07/2026', 27: '13/07/2026', 28: '20/07/2026',
  29: '27/07/2026', 30: '03/08/2026', 31: '10/08/2026', 32: '17/08/2026',
  33: '24/08/2026', 34: '31/08/2026', 35: '07/09/2026', 36: '14/09/2026',
  37: '21/09/2026', 38: '28/09/2026', 39: '05/10/2026', 40: '12/10/2026',
  41: '19/10/2026', 42: '26/10/2026'
};

// Read minggu argumen dari CLI (optional)
const targetWeeks = process.argv.slice(2).map(w => parseInt(w)).filter(w => !isNaN(w));
console.log('Minggu target: ' + (targetWeeks.length > 0 ? targetWeeks.join(', ') : 'SEMUA MINGGU'));

// Load rpt-data.json to get MINGGU_TARIKH from config
let configMingguTarikh = {};
try {
  const rptData = JSON.parse(fs.readFileSync('data/rpt-data.json', 'utf8'));
  configMingguTarikh = rptData.minggu_tarikh || {};
} catch (e) {
  console.log('Warning: Could not load rpt-data.json, using default MINGGU_TARIKH');
}

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

  // 3. Determine which month tab to click based on selected weeks
  const weeksToProcess = targetWeeks.length > 0 ? targetWeeks : Object.keys(configMingguTarikh).map(Number);
  const monthsNeeded = new Set();
  
  // Map month number to short name
  const monthNames = {
    1: 'Jan', 2: 'Feb', 3: 'Mac', 4: 'Apr', 5: 'Mei', 6: 'Jun',
    7: 'Jul', 8: 'Ogo', 9: 'Sep', 10: 'Okt', 11: 'Nov', 12: 'Dis'
  };

  weeksToProcess.forEach(week => {
    const dateStr = configMingguTarikh[week] || MINGGU_TARIKH[week];
    if (dateStr) {
      const parts = dateStr.split('/');
      if (parts.length >= 2) {
        const month = parseInt(parts[1]);
        if (monthNames[month]) monthsNeeded.add(monthNames[month]);
      }
    }
  });

  console.log('3. Filter Akmal + Click month tab(s): ' + [...monthsNeeded].join(', ') || 'SEMUA');
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

  // Collect miwRecords from each needed month
  let allMiwRecords = [];
  
  for (const monthName of monthsNeeded) {
    console.log('   Clicking month tab: ' + monthName + '...');
    await page.locator('a:has-text("' + monthName + '")').first().click().catch(() => console.log('   Tab ' + monthName + ' not found, skipping'));
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await sleep(5000);
    
    console.log('   URL after ' + monthName + ': ' + page.url());
    await page.screenshot({ path: 'data/after-' + monthName + '-hantar.png', fullPage: true });
  
    // Get MIW IDs from this month
    const monthRecords = await page.evaluate((weeks) => {
      const trs = document.querySelectorAll('table tbody tr');
      const results = [];
      trs.forEach((row, i) => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return;
        const subject = (cells[2]?.textContent.trim() || '');
        const hantarLink = Array.from(row.querySelectorAll('a')).find(a => a.textContent.trim() === 'Hantar Untuk Pengesahan');
        
        // Skip if no hantar link
        if (!hantarLink) return;
        
        // Filter by week if weeks provided
        if (weeks.length > 0) {
          const match = subject.match(/M(\d+)/);
          if (!match) return;
          const minggu = parseInt(match[1]);
          if (!weeks.includes(minggu)) return;
        }
        
        const onclick = hantarLink.getAttribute('onclick') || '';
        const miwMatch = onclick.match(/miw_id=(\d+)/);
        results.push({ row: i, subject: subject.substring(0, 40), miwId: miwMatch ? miwMatch[1] : null });
      });
      return results;
    }, targetWeeks);
    
    allMiwRecords = allMiwRecords.concat(monthRecords);
  }

  const miwRecords = allMiwRecords;

  console.log('4. ' + (targetWeeks.length > 0 ? 'Minggu ' + targetWeeks.join(', ') : 'Semua minggu') + ' records to submit: ' + miwRecords.length);
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
