const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', async d => {
    console.log('   DIALOG: ' + d.type() + ' - ' + d.message().substring(0, 200));
    await d.accept().catch(() => {});
    console.log('   DIALOG ACCEPTED');
  });

  console.log('1. Login...');
  await page.goto('https://asiemodel.net/#login', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(2000);
  await page.locator('input[name="username"]').fill('CIDSGURU30770');
  await page.locator('input[name="password"]').fill('Ikam@l2521');
  await page.locator('input[name="submit"][value="Login"]').click();
  await page.waitForURL('**/main.php**', { timeout: 30000 });
  await sleep(3000);

  console.log('2. Navigate to list...');
  await page.locator('a:has-text("eRPH")').first().click();
  await sleep(2000);
  await page.locator('a:has-text("Rekod")').first().hover();
  await sleep(1000);
  await page.locator('a:has-text("Buka Rekod"), a[href*="listmiw"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await sleep(3000);

  console.log('3. Select Akmal + Cari + Mar...');
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
  await page.locator('a:has-text("Mar")').first().click().catch(() => {});
  await sleep(5000);

  console.log('4. Click "Hantar Untuk Pengesahan" on first row...');
  // Find the first "Hantar Untuk Pengesahan" link in the table
  const hantarLink = page.locator('a:has-text("Hantar Untuk Pengesahan")').first();
  await page.screenshot({ path: 'data/before-hantar.png', fullPage: true });

  // Get onclick attribute to understand what it does
  const onclick = await hantarLink.evaluate(el => el.getAttribute('onclick') || 'none');
  console.log('   onclick: ' + onclick);

  // Get parent and nearby elements to understand structure
  const linkInfo = await hantarLink.evaluate(el => {
    return {
      tagName: el.tagName,
      text: el.textContent.trim().substring(0, 50),
      href: el.href,
      onclick: el.getAttribute('onclick') || 'none',
      className: el.className,
      parentTag: el.parentElement.tagName,
      parentClass: el.parentElement.className.substring(0, 40),
      id: el.id || 'none'
    };
  });
  console.log('   Link info:', JSON.stringify(linkInfo));

  // Click the link
  console.log('   Clicking hantar link...');
  await hantarLink.click();
  await sleep(5000);

  // Check what appeared after click (modal, dialog, new page...)
  const afterClick = await page.evaluate(() => {
    const modals = document.querySelectorAll('.modal, [role="dialog"], .popup-overlay, .overlay, [class*="modal"]');
    const visible = Array.from(modals).filter(m => m.offsetParent !== null || m.style.display !== 'none');
    return {
      url: location.href,
      modalCount: visible.length,
      modals: visible.map(m => ({
        html: m.innerHTML.substring(0, 200),
        classes: m.className.substring(0, 40)
      })),
      bodyText: document.body.innerText.substring(0, 500)
    };
  });
  console.log('   After click URL:', afterClick.url);
  console.log('   Modals visible:', afterClick.modalCount);

  await page.screenshot({ path: 'data/after-hantar.png', fullPage: true });

  // Check buttons in any visible modal
  const modalBtns = await page.evaluate(() => {
    const allBtns = document.querySelectorAll('button, .modal button, .modal .btn, input[type="button"]');
    return Array.from(allBtns).filter(b => b.offsetParent !== null).map(b => ({
      tag: b.tagName,
      text: (b.textContent || b.value || '').trim().substring(0, 40),
      class: (b.className || '').substring(0, 40)
    }));
  });
  console.log('   Visible buttons:', JSON.stringify(modalBtns));

  await sleep(5000);
  await browser.close();
})().catch(e => console.error('Error: ' + e.message));
