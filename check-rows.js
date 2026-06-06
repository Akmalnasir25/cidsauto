const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);
  
  await page.goto('https://asiemodel.net/#login', { waitUntil: 'domcontentloaded', timeout: 0 });
  await sleep(2000);
  await page.locator('input[name="username"]').fill('CIDSGURU30770');
  await page.locator('input[name="password"]').fill('Ikam@l2521');
  await page.locator('input[name="submit"][value="Login"]').click();
  await page.waitForURL('**/main.php**', { timeout: 0 });
  await sleep(3000);
  
  await page.goto('https://asiemodel.net/model/search9.php?action=listmiw', { waitUntil: 'networkidle', timeout: 0 });
  await sleep(3000);
  
  const userVal = await page.locator('#select_user').evaluate(el => {
    const o = Array.from(el.options).find(o => o.text.toLowerCase().includes('akmal'));
    return o ? o.value : null;
  });
  if (userVal) await page.locator('#select_user').selectOption(userVal);
  
  await page.locator('input[name="filter"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 0 });
  await sleep(5000);
  
  await page.locator('a:has-text("Jun")').first().click();
  await page.waitForLoadState('networkidle', { timeout: 0 });
  await sleep(5000);
  
  const data = await page.evaluate(() => {
    const trs = document.querySelectorAll('table tr');
    return Array.from(trs).map((tr, i) => {
      const cells = tr.querySelectorAll('td');
      return {
        row: i,
        col1: cells[0]?.textContent.trim(),
        col2: cells[1]?.textContent.trim(),
        col3: cells[2]?.textContent.trim(),
        col4: cells[3]?.textContent.trim(),
      };
    }).filter(r => r.col2);
  });
  
  data.forEach(r => console.log(`Row ${r.row}: col2=[${r.col2}] col3=[${r.col3}] col4=[${r.col4}]`));
  
  await browser.close();
})();
