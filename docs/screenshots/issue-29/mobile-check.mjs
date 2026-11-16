// Usage: node mobile-check.mjs <outDir>
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const BASE = process.env.BASE || 'http://127.0.0.1:4200';
const OUT = process.argv[2];
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
  detachmentVavsRep: mk('Sgt. Maj. R. Vance', 'vavs54@dof-mcl.org', ['member', 'detachmentVavsRep'], { detachmentScopes: ['dof-054'] }),
  adBookApprover: mk('Cpl. M. Holloway', 'adbook@dof-mcl.org', ['member', 'adBookApprover']),
  departmentAdmin: mk('Dept. Adjutant (Admin)', 'adjutant@dof-mcl.org', ['member', 'departmentAdmin']),
  siteAdmin: mk('Morris F Dixon Jr.', 'site@dof-mcl.org', ['member', 'siteAdmin']),
};
const WIDTHS = [320, 360, 375, 390, 414, 430, 768, 1024, 1200, 1280, 1366, 1440];
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'] });
const page = await browser.newPage();
async function setRole(p) {
  await page.goto(BASE + '/sign-in', { waitUntil: 'networkidle0' });
  await page.evaluate((p) => { localStorage.setItem('mcl_portal_theme', 'light');
    if (p) localStorage.setItem('mcl_portal_demo_user', JSON.stringify(p)); else localStorage.removeItem('mcl_portal_demo_user'); }, p);
}
const results = [];
for (const [role, profile] of Object.entries(ROLES)) {
  await setRole(profile);
  for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const nav = document.querySelector('nav.mcl-navbar');
      const brand = nav.querySelector('.mcl-brand').getBoundingClientRect();
      const tg = nav.querySelector('.navbar-toggler');
      const t = tg.getBoundingClientRect();
      const toggleVisible = tg.offsetParent !== null;
      const vw = window.innerWidth;
      return { sw: document.documentElement.scrollWidth, vw, navH: Math.round(nav.getBoundingClientRect().height),
        toggleVisible, sameRow: !toggleVisible || Math.abs((t.top + t.bottom) / 2 - (brand.top + brand.bottom) / 2) < 4,
        togglerInside: !toggleVisible || t.right <= vw + 0.5,
        avatar: document.querySelector('[data-testid="account-menu-button"]')?.textContent.trim() ?? null };
    });
    const mobile = w < 1200;
    const pass = m.sw <= m.vw && m.sameRow && m.togglerInside && (mobile ? m.navH <= 60 : m.navH <= 72);
    results.push({ role, width: w, pass, ...m });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${role.padEnd(18)} ${String(w).padStart(4)}px scrollW=${m.sw} navH=${m.navH} sameRow=${m.sameRow} avatar=${m.avatar}`);
  }
}
writeFileSync(resolve(OUT, 'mobile-header-check.json'), JSON.stringify(results, null, 2));
await setRole(ROLES.departmentAdmin);
for (const w of [390, 320]) {
  await page.setViewport({ width: w, height: 760, deviceScaleFactor: 2 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: resolve(OUT, `after-header-${w}-dept-admin.png`) });
  await page.click('.navbar-toggler'); await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: resolve(OUT, `after-header-${w}-dept-admin-menu-open.png`) });
}
await setRole(null);
await page.setViewport({ width: 320, height: 760, deviceScaleFactor: 2 });
await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: resolve(OUT, `after-header-320-signed-out.png`) });
await browser.close();
const f = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - f}/${results.length} passed`);
