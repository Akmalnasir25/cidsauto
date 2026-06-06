const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', async d => { await d.accept().catch(() => {}); });

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
    const o = Array.from(el.options).find(o => o.text.toLowerCase().includes('akmal'));
    return o ? o.value : null;
  });
  if (userVal) {
    await page.locator('#select_user').selectOption(userVal);
    await sleep(1000);
  }
  await page.locator('input[name="filter"]').first().click();
  await sleep(5000);
  await page.locator('a:has-text("Mar")').first().click().catch(() => {});
  await sleep(5000);

  const rows = await page.evaluate(() => {
    const trs = document.querySelectorAll('table tbody tr');
    return Array.from(trs).map((row, i) => {
      const cells = row.querySelectorAll('td');
      return { 
        row: i, 
        subject: (cells[2]?.textContent.trim() || '').substring(0, 60), 
        hantarLinks: Array.from(row.querySelectorAll('a')).filter(a => a.textContent.includes('Hantar')).length 
      };
    });
  });
  console.log('Rows after Mar filter:');
  rows.forEach(r => console.log(r.row + ': ' + r.subject + ' (hantar links=' + r.hantarLinks + ')'));

  await page.screenshot({ path: 'data/after-mar-debug.png', fullPage: true });
  await browser.close();
})().catch(e => console.error('Error:', e.message));
