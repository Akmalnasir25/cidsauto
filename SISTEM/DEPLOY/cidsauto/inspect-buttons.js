const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  
  await page.goto('https://asiemodel.net/#login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="username"]').fill('CIDSGURU30770');
  await page.locator('input[name="password"]').fill('Ikam@l2521');
  await page.locator('input[name="submit"][value="Login"]').click();
  await page.waitForURL('**/main.php**');
  
  await page.locator('a:has-text("eRPH")').first().click();
  await page.locator('a:has-text("Rekod")').first().hover();
  await page.locator('a:has-text("Buka Rekod"), a[href*="listmiw"]').first().click();
  await page.waitForLoadState('networkidle');
  
  const userVal = await page.locator('#select_user').evaluate(el => {
    const o = Array.from(el.options).find(o => o.text.toLowerCase().includes('akmal'));
    return o ? o.value : null;
  });
  if (userVal) await page.locator('#select_user').selectOption(userVal);
  
  await page.locator('input[name="filter"]').first().click();
  await page.waitForLoadState('networkidle');
  
  const data = await page.evaluate(() => {
    const trs = document.querySelectorAll('table tr');
    const links = [];
    trs.forEach(tr => {
      tr.querySelectorAll('a, button, input[type=button]').forEach(el => {
        links.push({
          tag: el.tagName,
          text: (el.textContent || '').trim(),
          value: el.value || '',
          href: el.href || '',
          onclick: el.getAttribute('onclick') || '',
          className: el.className || ''
        });
      });
    });
    return links;
  });
  
  console.log('All links/buttons in table:');
  data.forEach((l, i) => console.log(i, l));
  
  await browser.close();
})();
