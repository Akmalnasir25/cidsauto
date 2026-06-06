const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const dialogHandler = async dialog => {
    console.log('  Dialog: ' + dialog.type() + ' - ' + dialog.message().substring(0, 100));
    await dialog.accept().catch(() => {});
  };
  page.on('dialog', dialogHandler);

  console.log('1. Login...');
  await page.goto('https://asiemodel.net/#login', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(2000);
  await page.locator('input[name="username"]').fill('CIDSGURU30770');
  await page.locator('input[name="password"]').fill('Ikam@l2521');
  await page.locator('input[name="submit"][value="Login"]').click();
  await page.waitForURL('**/main.php**', { timeout: 30000 });
  await sleep(3000);
  console.log('   Logged in');

  console.log('2. Click eRPH...');
  await page.locator('a:has-text("eRPH"), a:has-text("ERPH")').first().click();
  await sleep(3000);

  console.log('3. Click Rekod > Buka Rekod...');
  await page.locator('a:has-text("Rekod")').first().hover();
  await sleep(1000);
  await page.locator('a:has-text("Buka Rekod"), a[href*="listmiw"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await sleep(3000);
  console.log('   URL: ' + page.url());

  const selects2 = await page.evaluate(() => {
    const sels = document.querySelectorAll('select');
    return Array.from(sels).map((s, i) => ({
      id: s.id,
      name: s.name,
      cls: s.className.substring(0, 40),
      visible: s.offsetParent !== null,
      optCount: s.options.length,
      firstOpts: Array.from(s.options).slice(0, 8).map(o => o.text.trim().substring(0, 40))
    }));
  });
  console.log('\nAll select elements:');
  selects2.forEach((s, i) => console.log('  #' + i + ': id=' + s.id + ' name=' + s.name + ' visible=' + s.visible + ' opts=' + s.optCount));
  selects2.filter(s => s.visible && s.optCount > 1).forEach((s, i) => console.log('  Visible: #' + i + ': ' + s.firstOpts.join(' | ')));

  const filterSection = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input,select')).filter(el => el.offsetParent !== null);
    return {
      visibleInputs: inputs.map(i => ({
        tag: i.tagName, type: i.type, name: i.name, id: i.id,
        placeholder: (i.placeholder || '').substring(0, 40),
        cls: (i.className || '').substring(0, 40)
      })).slice(0, 10)
    };
  });
  console.log('\nVisible form inputs:');
  filterSection.visibleInputs.forEach((inp, i) => console.log('  ' + i + ': ' + inp.tag + ' type=' + inp.type + ' name="' + inp.name + '" id="' + inp.id + '"'));

  await browser.close();
})().catch(e => console.error('Error: ' + e.message));
