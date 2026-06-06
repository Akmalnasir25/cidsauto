const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CONFIG = {
  url: 'https://asiemodel.net/#login',
  baseUrl: 'https://asiemodel.net/model/',
  username: 'CIDSGURU30770',
  password: 'Ikam@l2521',
};

const TARGET_WEEKS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function matchTargetWeek(text) {
  const m = text.match(/[A-Z]+T[0-9]M(\d+)/);
  if (!m) return false;
  const week = parseInt(m[1], 10);
  return TARGET_WEEKS.includes(week);
}

async function runDelete() {
  console.log('Memulakan proses pemadaman rekod minggu 8-18...');
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);

  page.on('dialog', async d => {
    console.log('   [Dialog] ' + d.message().substring(0, 100));
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
  console.log('   Login OK');

  console.log('2. Buka Senarai Rekod...');
  await page.goto(CONFIG.baseUrl + 'search9.php?action=listmiw', { waitUntil: 'networkidle', timeout: 0 });
  await sleep(3000);

  console.log('3. Filter user...');
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

  const months = ['Mar', 'Apr', 'May', 'Jun'];
  let totalDeleted = 0;

  for (const month of months) {
    console.log(`\n4. Memproses tab bulan: ${month}...`);

    const monthLink = page.locator(`a:has-text("${month}")`).first();
    if (await monthLink.count() > 0) {
      await monthLink.click();
      await page.waitForLoadState('networkidle', { timeout: 0 });
      await sleep(5000);
    } else {
      console.log(`   Tab "${month}" tidak dijumpai, skip.`);
      continue;
    }

    let deletedInMonth = 0;
    let loopGuard = 0;

    while (loopGuard < 500) {
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

      if (candidates.length === 0) {
        console.log(`   Tiada rekod lagi dalam tab ${month}.`);
        break;
      }

      const target = candidates.find(c => matchTargetWeek(c.code));
      if (!target) {
        console.log(`   Tiada rekod minggu 8-18 dalam tab ${month}. (Tinggal ${candidates.length} rekod lain)`);
        break;
      }

      console.log(`   [${loopGuard}] Memadam: "${target.code}" (ID=${target.recId})`);

      if (target.recId) {
        const delUrl = `${CONFIG.baseUrl}record.php?action=deletemiw&id=${target.recId}`;
        await page.goto(delUrl, { waitUntil: 'networkidle', timeout: 0 });
        await sleep(3000);

        const confirmBtn = page.locator('input[value="Padam"], input[value="Hapus"], button:has-text("Padam"), button:has-text("Hapus"), input[value="Delete"], button:has-text("Delete"), input[type="submit"][value="OK"], input[type="submit"]').first();
        if (await confirmBtn.count() > 0) {
          await confirmBtn.click();
          await sleep(2000);
        }

        totalDeleted++;
        deletedInMonth++;

        await page.waitForLoadState('networkidle', { timeout: 0 }).catch(() => {});
        await sleep(3000);
      } else {
        console.log('   ID tidak dijumpai, skip baris ini.');
        break;
      }
    }

    console.log(`   Tab ${month}: ${deletedInMonth} rekod dipadam.`);
  }

  console.log(`\n=== SELESAI: ${totalDeleted} rekod minggu 8-18 berjaya dipadam ===`);
  await browser.close();
}

runDelete().catch(e => {
  console.error('Fatal Error:', e.message);
  process.exit(1);
});
