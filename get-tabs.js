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
  
  const tabs = await page.locator('a').evaluateAll(els => 
    els.map(e => e.textContent.trim()).filter(t => t.length > 0 && t.length < 10)
  );
  console.log('Tabs found:', [...new Set(tabs)]);
  
  await browser.close();
})();
