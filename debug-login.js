const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  console.log('Navigating to login...');
  await page.goto('https://asiemodel.net/#login', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);

  await page.screenshot({ path: path.join(__dirname, 'data', 'login-page.png'), fullPage: true });
  console.log('Screenshot saved to data/login-page.png');

  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'data', 'login-page.html'), html, 'utf-8');
  console.log('HTML saved to data/login-page.html');

  const inputs = await page.locator('input').all();
  console.log('Found ' + inputs.length + ' inputs:');
  for (const input of inputs) {
    const attrs = await input.evaluate(el => {
      return { type: el.type, name: el.name, id: el.id, placeholder: el.placeholder, visible: el.offsetParent !== null, value: el.value };
    });
    console.log('  input: ' + JSON.stringify(attrs));
  }

  const buttons = await page.locator('button, input[type="submit"], a.btn').all();
  console.log('Found ' + buttons.length + ' buttons:');
  for (const btn of buttons) {
    const text = await btn.textContent().catch(() => '');
    const attrs = await btn.evaluate(el => {
      return { tag: el.tagName, type: el.type, class: el.className, text: el.textContent?.trim().substring(0, 50), visible: el.offsetParent !== null };
    });
    console.log('  button: ' + JSON.stringify(attrs));
  }

  const forms = await page.locator('form').all();
  console.log('Found ' + forms.length + ' forms');
  for (const form of forms) {
    const attrs = await form.evaluate(el => ({ action: el.action, method: el.method, id: el.id, class: el.className }));
    console.log('  form: ' + JSON.stringify(attrs));
  }

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
