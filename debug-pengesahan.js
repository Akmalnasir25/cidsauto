const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', async d => { console.log('Dialog:', d.message().substring(0,80)); await d.accept().catch(()=>{}); });
  
  await page.goto('https://asiemodel.net/#login', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(2000);
  await page.locator('input[name="username"]').fill('CIDSGURU30770');
  await page.locator('input[name="password"]').fill('Ikam@l2521');
  await page.locator('input[name="submit"][value="Login"]').click();
  await page.waitForURL('**/main.php**', { timeout: 30000 });
  await sleep(3000);

  await page.locator('a:has-text("eRPH")').first().click();
  await sleep(2000);
  await page.locator('a:has-text("Rekod")').first().hover();
  await sleep(1000);
  await page.locator('a:has-text("Buka Rekod"), a[href*="listmiw"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await sleep(3000);

  const userVal = await page.locator('#select_user').evaluate(el => {
    const opts = Array.from(el.options);
    const akmal = opts.find(o => o.text.toLowerCase().includes('akmal'));
    return akmal ? akmal.value : null;
  });
  if (userVal) {
    await page.locator('#select_user').selectOption(userVal);
    await sleep(1000);
  }

  await page.locator('input[name="filter"]').first().click();
  await sleep(5000);

  const marLink = page.locator('a:has-text("Mar")').first();
  if (await marLink.count() > 0) {
    await marLink.click();
    await sleep(5000);
  }

  // Select all
  const checkboxes = await page.locator('input[type="checkbox"][name="bulk_action[]"]').all();
  for (const cb of checkboxes) {
    await cb.click({ position: { x: 5, y: 5 } }).catch(() => {});
    await sleep(100);
  }
  console.log('Selected ' + checkboxes.length + ' checkboxes');

  // Check all interactive elements with pengesahan/hantar
  const pengesahanElements = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const results = [];
    for (const el of allElements) {
      if (el.offsetParent === null) continue;
      const text = (el.textContent || '').toLowerCase().trim();
      if (text.includes('pengesahan') || text.includes('hantar')) {
        if (['button','input','a'].includes(el.tagName.toLowerCase())) {
          results.push({
            tag: el.tagName,
            text: (el.textContent || el.value || '').trim().substring(0, 60),
            href: el.href || '',
            className: (el.className || '').substring(0, 40)
          });
        }
      }
    }
    return results;
  });
  console.log('Pengesahan/Hantar elements:', JSON.stringify(pengesahanElements, null, 2));

  // Check row actions
  const rowActions = await page.evaluate(() => {
    const trs = document.querySelectorAll('table tbody tr');
    const results = [];
    trs.forEach((row, i) => {
      const links = row.querySelectorAll('a');
      links.forEach(a => {
        const text = a.textContent.trim();
        if (text && i < 10) results.push({row: i, text: text.substring(0,40), href: a.href.substring(0,60)});
      });
    });
    return results;
  });
  console.log('Row actions:', JSON.stringify(rowActions, null, 2));

  await page.screenshot({ path: 'data/pengesahan-debug.png', fullPage: true });
  await browser.close();
})().catch(e => console.error('Error:', e.message));
