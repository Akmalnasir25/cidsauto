const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CONFIG = {
  url: 'https://asiemodel.net/#login',
  baseUrl: 'https://asiemodel.net/model/',
  username: 'CIDSGURU30770',
  password: 'Ikam@l2521',
};

// Cari sebarang kod subjek yang ada M8, M9, M10, M11, M12, M13, M14, M15, M16, M17
function isTargetWeek(code) {
  const match = code.match(/M(\d+)/);
  if (!match) return false;
  const week = parseInt(match[1], 10);
  return week >= 8 && week <= 17;
}

async function runDelete() {
  console.log('Memulakan proses pemadaman AGRESIF untuk minggu 8-17...');
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);

  page.on('dialog', async d => {
    try { await d.accept(); } catch {}
  });

  console.log('1. Login...');
  await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: 0 });
  await sleep(2000);
  await page.locator('input[name="username"]').fill(CONFIG.username);
  await page.locator('input[name="password"]').fill(CONFIG.password);
  await page.locator('input[name="submit"][value="Login"]').click();
  await page.waitForURL('**/main.php**', { timeout: 0 });
  await sleep(3000);

  console.log('2. Buka Senarai Rekod & Filter...');
  await page.goto(CONFIG.baseUrl + 'search9.php?action=listmiw', { waitUntil: 'networkidle', timeout: 0 });
  await sleep(3000);
  
  const userVal = await page.locator('#select_user').evaluate(el => {
    const o = Array.from(el.options).find(o => o.text.toLowerCase().includes('akmal'));
    return o ? o.value : null;
  }).catch(() => null);
  if (userVal) {
    await page.locator('#select_user').selectOption(userVal);
    await sleep(1000);
  }
  await page.locator('input[name="filter"]').first().click();
  await page.waitForLoadState('networkidle', { timeout: 0 });
  await sleep(5000);

  const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let totalDeleted = 0;

  for (const month of months) {
    console.log(`\n--- Memproses tab bulan: ${month} ---`);

    const monthLink = page.locator(`a:has-text("${month}")`).first();
    if (await monthLink.count() > 0) {
      await monthLink.click();
      await page.waitForLoadState('networkidle', { timeout: 0 });
      await sleep(4000);
    } else {
      continue;
    }

    let deletedInMonth = 0;
    let loopGuard = 0;
    let foundTarget = true;

    while (foundTarget && loopGuard < 300) {
      loopGuard++;

      const candidates = await page.evaluate(() => {
        const trs = document.querySelectorAll('table tr');
        const rows = [];
        trs.forEach((row, i) => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 3) return;
          const subjectCode = cells[2]?.textContent.trim() || '';
          const hapusLink = Array.from(row.querySelectorAll('a')).find(a => a.textContent.trim() === 'Hapus');
          if (!hapusLink) return;
          let recId = null;
          const href = hapusLink.getAttribute('href') || '';
          const m = href.match(/id=(\d+)/);
          if (m) recId = m[1];
          rows.push({ row: i, code: subjectCode, recId });
        });
        return rows;
      });

      const target = candidates.find(c => isTargetWeek(c.code));
      
      if (!target) {
        console.log(`   Tiada lagi rekod minggu 8-17 dalam tab ${month}.`);
        foundTarget = false;
        break;
      }

      console.log(`   [${loopGuard}] Memadam: ${target.code} (ID=${target.recId})`);

      if (target.recId) {
        const delUrl = `${CONFIG.baseUrl}record.php?action=deletemiw&id=${target.recId}`;
        await page.goto(delUrl, { waitUntil: 'networkidle', timeout: 0 });
        await sleep(2000);

        const confirmBtn = page.locator('input[value="Padam"], input[value="Hapus"], input[value="Delete"], input[type="submit"]').first();
        if (await confirmBtn.count() > 0) {
          await confirmBtn.click();
          await sleep(2000);
        }

        totalDeleted++;
        deletedInMonth++;

        await page.goto(CONFIG.baseUrl + 'search9.php?action=listmiw', { waitUntil: 'networkidle', timeout: 0 });
        await sleep(2000);
        if (userVal) await page.locator('#select_user').selectOption(userVal);
        await page.locator('input[name="filter"]').first().click();
        await page.waitForLoadState('networkidle', { timeout: 0 });
        await sleep(3000);
        
        await monthLink.click();
        await page.waitForLoadState('networkidle', { timeout: 0 });
        await sleep(3000);
      } else {
        console.log('   ID tidak dijumpai, skip.');
        break;
      }
    }

    if (deletedInMonth > 0) {
      console.log(`   => Tab ${month}: ${deletedInMonth} rekod dipadam.`);
    }
  }

  console.log(`\n========================================`);
  console.log(` SELESAI: ${totalDeleted} rekod minggu 8-17 berjaya dipadam.`);
  console.log(`========================================`);
  await browser.close();
}

runDelete().catch(e => {
  console.error('Fatal Error:', e.message);
  process.exit(1);
});
