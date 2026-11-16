// Usage: node header-check.mjs <outDir> [--shots-only]
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:4200';
const OUT = process.argv[2] || '/workspace/mcl-header-27/out';
mkdirSync(OUT, { recursive: true });

const now = new Date().toISOString();
const mk = (displayName, email, roles, extra = {}) => ({
  uid: `demo-${email.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
  email, displayName, defaultDetachmentId: 'dof-054', status: 'active', roles,
  detachmentScopes: [], createdAt: now, updatedAt: now, ...extra,
});
const ROLES = {
  'signed-out': null,
  member: mk('Cpl. D. Rivera', 'member@dof-mcl.org', ['member']),
  'member-pending': mk('Cpl. D. Rivera', 'member@dof-mcl.org', ['member'], { status: 'pending' }),
  detachmentVavsRep: mk('Sgt. Maj. R. Vance', 'vavs54@dof-mcl.org', ['member', 'detachmentVavsRep'], { detachmentScopes: ['dof-054'] }),
  adBookApprover: mk('Cpl. M. Holloway', 'adbook@dof-mcl.org', ['member', 'adBookApprover']),
  departmentAdmin: mk('Dept. Adjutant (Admin)', 'adjutant@dof-mcl.org', ['member', 'departmentAdmin']),
  'departmentAdmin-longname': mk('Master Gunnery Sergeant Bartholomew Montgomery-Fitzgerald III (Department Adjutant)', 'bartholomew.montgomery-fitzgerald.adjutant@dof-mcl.org', ['member', 'departmentAdmin']),
};
const WIDTHS = [1200, 1280, 1366, 1440];

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);

async function setRole(profile) {
  await page.goto(BASE + '/sign-in', { waitUntil: 'networkidle0' });
  await page.evaluate((p) => {
    localStorage.setItem('mcl_portal_theme', 'light');
    if (p) localStorage.setItem('mcl_portal_demo_user', JSON.stringify(p));
    else localStorage.removeItem('mcl_portal_demo_user');
  }, profile);
}

async function measure() {
  return page.evaluate(() => {
    const header = document.querySelector('app-shell-header header, header');
    const nav = header.querySelector('nav');
    const vw = window.innerWidth;
    const doc = document.documentElement;
    // Count visual lines of each visible text-bearing item in the header bar.
    const items = [...header.querySelectorAll('nav a, nav button, .mcl-brand-title, .mcl-brand-subtitle')]
      .filter((el) => el.offsetParent !== null && !el.closest('.dropdown-menu'));
    const wrapped = [];
    const clipped = [];
    for (const el of items) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > vw + 0.5 || r.left < -0.5) clipped.push((el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40));
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let maxLines = 0;
      while (walker.nextNode()) {
        const n = walker.currentNode;
        const t = n.textContent;
        const start = t.search(/\S/);
        if (start < 0) continue;
        const end = t.length - (t.length - t.trimEnd().length);
        const range = document.createRange();
        range.setStart(n, start);
        range.setEnd(n, end);
        const tops = new Set();
        for (const rr of range.getClientRects()) if (rr.width > 0) tops.add(Math.round(rr.top));
        maxLines = Math.max(maxLines, tops.size);
      }
      const tops = { size: maxLines };
      if (tops.size > 1) wrapped.push((el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40));
    }
    return {
      innerWidth: vw,
      scrollWidth: doc.scrollWidth,
      overflow: doc.scrollWidth > vw,
      navHeight: Math.round(nav.getBoundingClientRect().height),
      wrapped, clipped,
    };
  });
}

const results = [];
for (const [role, profile] of Object.entries(ROLES)) {
  await setRole(profile);
  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 300));
    const m = await measure();
    const pass = !m.overflow && m.wrapped.length === 0 && m.clipped.length === 0 && m.navHeight <= 72;
    results.push({ role, width: w, pass, ...m });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${role.padEnd(26)} ${w}px scrollW=${m.scrollWidth} navH=${m.navHeight} wrapped=${JSON.stringify(m.wrapped)} clipped=${JSON.stringify(m.clipped)}`);
  }
}
writeFileSync(resolve(OUT, 'header-check.json'), JSON.stringify(results, null, 2));

// Screenshots: dept admin at 1366 and 390
await setRole(ROLES.departmentAdmin);
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: resolve(OUT, 'header-1366-dept-admin.png'), clip: { x: 0, y: 0, width: 1366, height: 300 } });
// account menu open, if present
const avatar = await page.$('[data-testid="account-menu-button"]');
if (avatar) {
  await avatar.click();
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: resolve(OUT, 'header-1366-dept-admin-account-menu.png'), clip: { x: 0, y: 0, width: 1366, height: 520 } });
  await page.keyboard.press('Escape');
}
await setRole(null);
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: resolve(OUT, 'header-1366-signed-out.png'), clip: { x: 0, y: 0, width: 1366, height: 300 } });

await setRole(ROLES.departmentAdmin);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: resolve(OUT, 'header-390-dept-admin.png') });
const toggler = await page.$('.navbar-toggler');
if (toggler) {
  await toggler.click();
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: resolve(OUT, 'header-390-dept-admin-menu-open.png') });
}
// 390 overflow
for (const [role, profile] of Object.entries(ROLES)) {
  await setRole(profile);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  const t = await page.$('.navbar-toggler');
  if (t) { await t.click(); await new Promise((r) => setTimeout(r, 200)); }
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  console.log(`${m.sw <= m.iw ? 'PASS' : 'FAIL'} 390px menu-open ${role} scrollW=${m.sw}`);
}
// Keyboard: avatar + Admin menus open with Enter/Space, Esc closes and returns focus
await setRole(ROLES.departmentAdmin);
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
for (const [sel, key] of [['[data-testid="account-menu-button"]', 'Enter'], ['[data-testid="admin-menu-button"]', 'Space']]) {
  const el = await page.$(sel);
  if (!el) { console.log('SKIP keyboard', sel); continue; }
  await el.focus();
  await page.keyboard.press(key);
  await new Promise((r) => setTimeout(r, 150));
  const opened = await page.$eval(sel, (b) => b.getAttribute('aria-expanded'));
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 150));
  const closed = await page.$eval(sel, (b) => b.getAttribute('aria-expanded'));
  const focused = await page.$eval(sel, (b) => document.activeElement === b);
  console.log(`${opened === 'true' && closed === 'false' && focused ? 'PASS' : 'FAIL'} keyboard ${sel} ${key}: open=${opened} afterEsc=${closed} focusReturned=${focused}`);
}
const bell = await page.$eval('[data-testid="notification-bell"]', (b) => b.getAttribute('aria-label')).catch(() => null);
console.log('bell aria-label:', bell);
await browser.close();
const fails = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(0);
