const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CONFIG = {
  url: 'https://asiemodel.net/#login',
  baseUrl: 'https://asiemodel.net/model/',
  username: 'CIDSGURU30770',
  password: 'Ikam@l2521',
};

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  
  await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: 0 });
  await sleep(2000);
  await page.locator('input[name="username"]').fill(CONFIG.username);
  await page.locator('input[name="password"]').fill(CONFIG.password);
  await page.locator('input[name="submit"][value="Login"]').click();
  await page.waitForURL('**/main.php**', { timeout: 0 });
  await sleep(3000);

  await page.locator('a:has-text("eRPH")').first().click();
  await sleep(1000);
  await page.locator('a:has-text("Rekod")').first().hover();
  await sleep(500);
  await page.locator('a:has-text("Buka Rekod"), a[href*="listmiw"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 0 });
  await sleep(3000);

  const userVal = await page.locator('#select_user').evaluate(el => {
    const o = Array.from(el.options).find(o => o.text.toLowerCase().includes('akmal'));
    return o ? o.value : null;
  });
  if (userVal) await page.locator('#select_user').selectOption(userVal);
  
  await page.locator('input[name="filter"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 0 });
  await sleep(5000);

  await page.locator('a:has-text("Mar")').first().click();
  await page.waitForLoadState('networkidle', { timeout: 0 });
  await sleep(4000);

  const data = await page.evaluate(() => {
    const trs = document.querySelectorAll('table tr');
    return Array.from(trs).map((tr, i) => {
      const cells = tr.querySelectorAll('td');
      const allLinks = Array.from(tr.querySelectorAll('a'));
      return {
        row: i,
        col2: cells[1]?.textContent.trim().substring(0, 40),
        col3: cells[2]?.textContent.trim().substring(0, 40),
        linkTexts: allLinks.map(a => ({ text: a.textContent.trim(), onclick: a.getAttribute('onclick') || '', href: a.getAttribute('href') || '' }))
      };
    });
  });

  console.log('Rows in Mar tab:');
  data.slice(0, 5).forEach(r => {
    console.log(`\nRow ${r.row}: col2=[${r.col2}] col3=[${r.col3}]`);
    r.linkTexts.forEach(l => console.log(`  Link: "${l.text}" onclick="${l.onclick}" href="${l.href}"`));
  });

  await browser.close();
})();
