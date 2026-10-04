/* Úkolníček – test: opravy z verze 3.0 (rozdělení kódu do modulů).
   Spouští se přes `npm test` (tests/run.js), ten nastaví UK_BASE. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const MOCK = fs.readFileSync(path.join(__dirname, 'mockDrive.js'), 'utf8');
const BASE = process.env.UK_BASE || 'http://localhost:8000/';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.endsWith('/driveSync.js')) return route.fulfill({ contentType: 'application/javascript', body: MOCK });
    if (u.endsWith('/sw.js')) return route.fulfill({ status: 404, body: '' });
    if (!u.startsWith(BASE)) return route.abort();
    return route.continue();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + 'manifest.webmanifest');
  await page.evaluate(async () => {
    localStorage.clear(); localStorage.setItem('mock-D', JSON.stringify({ files: [], data: {}, tok: 'off' }));
    const pages = {
      pA: { id: 'pA', title: 'Import', parent: null, order: 1, props: [], blocks: [
        { id: 'h', type: 'h1', html: 'Nadpis', until: 't2' },
        { id: 't1', type: 'todo', html: '<img src="x" onerror="window.__xss=1"><img srcset="y" onerror="window.__xss=3"><video src="z" onerror="window.__xss=4"></video>Úkol 5.10.' },
        { id: 't2', type: 'todo', html: 'Druhý <a href="javascript:window.__xss=2">odkaz</a>' },
        { id: 'p', type: 'p', html: 'konec' }] },
      'z"><img src=x onerror=window.__xss=5>': { id: 'z"><img src=x onerror=window.__xss=5>', title: 'Podvržená', parent: null, order: 2, props: [], blocks: [
        { id: 'q"><img src=x onerror=window.__xss=6>', type: 'p" onmouseover="window.__xss=7', html: 'text', level: '1;background:red' },
        { id: 'c1', type: 'callout', color: 'x"><b>', html: 'pozor' },
        { id: 'tb', type: 'table', rows: [{ cells: [{ lines: [{ t: 'todo"><i>', html: 'buňka' }] }] }] }] }
    };
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ukolnicek', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('images', { keyPath: 'id' }); d.createObjectStore('backups', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = rej; });
    await new Promise((res) => { const tx = db.transaction(['kv'], 'readwrite'); tx.objectStore('kv').put({ pages, events: {}, settings: {}, meta: {} }, 'state'); tx.oncomplete = res; });
    db.close();
  });

  console.log('1) importovaná data s nebezpečným HTML');
  await page.goto(BASE); await page.waitForSelector('#sync-box .cloud'); await sleep(400);
  for (const v of ['tasks', 'today']) { await page.click(`[data-act="nav"][data-v="${v}"]`); await sleep(300); }
  await page.click('[data-act="open"][data-id="pA"]'); await sleep(400);
  await page.click('.ti-main:has-text("Podvržená")'); await sleep(400);
  await page.hover('#blocks .blk >> nth=0').catch(() => {});
  ok(await page.evaluate(() => window.__xss === undefined), 'žádný kód z dat se nespustil (Úkoly, Dnes, stránky, podvržená ID a typy)');
  ok(await page.evaluate(() => [...document.querySelectorAll('[data-id]')].every((e) => /^[A-Za-z0-9_-]+$/.test(e.dataset.id))), 'všechna ID v HTML mají bezpečný tvar');
  ok(await page.evaluate(() => document.querySelectorAll('#blocks .blk').length === 3 && !document.querySelector('#blocks b, #blocks i')), 'podvržená stránka se vykreslí jako obyčejný text');
  ok(await page.evaluate(() => [...document.querySelectorAll('#doc a')].every((a) => !/^javascript:/i.test(a.getAttribute('href') || ''))), 'odkaz javascript: se nevykreslí');
  await page.click('[data-act="nav"][data-v="tasks"]'); await sleep(200);
  ok(/5\. 10\./.test(await page.textContent('.t-sec')), 'termín z textu se pořád rozpozná');

  console.log('2) duplikát stránky zachová „sbalovat až sem“');
  await page.hover('.ti-main[data-id="pA"]');
  await page.click('.ti:has([data-id="pA"]) [data-act="page-menu"]');
  await page.click('.pop [data-v="dup"]'); await sleep(600);
  const r = await page.evaluate(async () => {
    const db = await window.Local.open();
    const st = await new Promise((res) => { const q = db.transaction('kv').objectStore('kv').get('state'); q.onsuccess = () => res(q.result); });
    const copy = Object.values(st.pages).find((p) => /\(kopie\)/.test(p.title));
    const h = copy.blocks[0], ids = copy.blocks.map((b) => b.id);
    return { until: h.until, third: ids[2], fresh: !ids.some((i) => ['h', 't1', 't2', 'p'].includes(i)) };
  });
  ok(r.fresh, 'kopie má nová ID bloků');
  ok(r.until === r.third, 'nadpis v kopii se sbaluje až po svůj vlastní (zkopírovaný) blok');

  console.log('3) vývoj na localhostu');
  ok(await page.evaluate(async () => !navigator.serviceWorker || (await navigator.serviceWorker.getRegistrations()).length === 0), 'na localhostu se Service Worker neregistruje');

  ok(errors.length === 0, 'žádné chyby' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} SELHALO` : '\nVŠE OK');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
