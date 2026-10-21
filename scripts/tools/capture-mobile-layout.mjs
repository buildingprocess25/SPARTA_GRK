import puppeteer from 'puppeteer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Usage: node --env-file=.env scripts/tools/capture-mobile-layout.mjs <label> [outDir]
// Needs the dev server on http://127.0.0.1:3000 and AUTH_SESSION_SECRET in .env.

const label = process.argv[2] || 'snapshot';
const outDir = path.resolve(process.argv[3] || 'docs/evidence/mobile');
const BASE_URL = process.env.CAPTURE_BASE_URL || 'http://127.0.0.1:3000';
const USERNAME = process.env.CAPTURE_USERNAME || 'admin';

const VIEWPORTS = [
  { name: '360x560', width: 360, height: 560 },
  { name: '360x640', width: 360, height: 640 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
];

const TABS = [
  { name: 'resume', parent: null, sub: 'Ringkasan Emisi' },
  { name: 'scope1', parent: 'Sumber Emisi', sub: 'Scope 1' },
  { name: 'scope2', parent: 'Sumber Emisi', sub: 'Scope 2' },
  { name: 'scope3', parent: 'Sumber Emisi', sub: 'Scope 3' },
  { name: 'plts', parent: 'Pengurangan Emisi', sub: 'PLTS' },
  { name: 'water', parent: 'Pengurangan Emisi', sub: 'Daur Ulang Air' },
  { name: 'history', parent: null, sub: 'Riwayat Audit' },
];

function sessionToken(username) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) throw new Error('AUTH_SESSION_SECRET is not set');
  const now = Date.now();
  const payloadStr = Buffer.from(JSON.stringify({ u: username, exp: now + 3600_000, act: now })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function clickButtonByText(page, text) {
  return page.evaluate((t) => {
    const btn = Array.from(document.querySelectorAll('aside button'))
      .find(b => b.innerText && b.innerText.trim().split('\n')[0].trim() === t);
    if (!btn) return false;
    btn.click();
    return true;
  }, text);
}

async function openSidebar(page) {
  await page.click('button[aria-label="Buka Navigasi Menu"]');
  await sleep(450);
}

// Elements wider than the viewport, or poking past its right edge.
async function measureOverflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll('main *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') { clipped = true; break; }
        }
        if (clipped) continue;
        const cls = typeof el.className === 'string' ? el.className.slice(0, 90) : '';
        offenders.push(`${el.tagName.toLowerCase()} [${Math.round(r.left)}..${Math.round(r.right)}] ${cls}`);
      }
    }
    return {
      viewport: vw,
      scrollWidth: document.documentElement.scrollWidth,
      offenders: offenders.slice(0, 12),
      offenderCount: offenders.length,
    };
  });
}

async function measureSidebar(page) {
  return page.evaluate(() => {
    const aside = document.querySelector('aside');
    const header = document.querySelector('header');
    const logo = aside?.querySelector('img');
    const footer = aside?.lastElementChild;
    const rect = (el) => el ? el.getBoundingClientRect() : null;
    const point = (el) => {
      const r = rect(el);
      if (!r) return null;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 10));
      return hit ? aside.contains(hit) : false;
    };
    return {
      viewportHeight: window.innerHeight,
      logo: rect(logo) && { top: Math.round(rect(logo).top), bottom: Math.round(rect(logo).bottom), visibleOnTop: point(logo) },
      footer: rect(footer) && { top: Math.round(rect(footer).top), bottom: Math.round(rect(footer).bottom), insideViewport: rect(footer).bottom <= window.innerHeight },
      headerZ: header ? getComputedStyle(header).zIndex : null,
      asideZ: aside ? getComputedStyle(aside).zIndex : null,
    };
  });
}

async function run() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });
  const report = [];
  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await page.setCookie({ name: 'sparta_session', value: sessionToken(USERNAME), url: BASE_URL });
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(1500);

      const isDrawer = vp.width < 768;
      if (isDrawer) {
        await openSidebar(page);
        const sidebar = await measureSidebar(page);
        report.push({ viewport: vp.name, view: 'sidebar', ...sidebar });
        await page.screenshot({ path: path.join(outDir, `${label}-${vp.name}-sidebar.png`) });
        await page.keyboard.press('Escape');
        await sleep(400);
      }

      for (const tab of TABS) {
        if (isDrawer) await openSidebar(page);
        const ok = await clickButtonByText(page, tab.sub);
        if (!ok) {
          report.push({ viewport: vp.name, view: tab.name, error: 'nav button not found' });
          if (isDrawer) { await page.keyboard.press('Escape'); await sleep(300); }
          continue;
        }
        await sleep(2500);
        const overflow = await measureOverflow(page);
        report.push({ viewport: vp.name, view: tab.name, ...overflow });
        await page.screenshot({ path: path.join(outDir, `${label}-${vp.name}-${tab.name}.png`), fullPage: true });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(outDir, `${label}-report.json`), JSON.stringify(report, null, 2));
  for (const row of report) {
    if (row.view === 'sidebar') {
      console.log(`${row.viewport} sidebar: logo=${JSON.stringify(row.logo)} footer=${JSON.stringify(row.footer)} z(header/aside)=${row.headerZ}/${row.asideZ}`);
    } else if (row.error) {
      console.log(`${row.viewport} ${row.view}: ${row.error}`);
    } else {
      console.log(`${row.viewport} ${row.view}: scrollWidth=${row.scrollWidth}/${row.viewport} offenders=${row.offenderCount}`);
      for (const o of row.offenders.slice(0, 4)) console.log(`    ${o}`);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
