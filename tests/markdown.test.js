/* Úkolníček – test (3.3.0): import souboru .md přes / → Import Markdownu a export stránky do .md tlačítkem u zámku.
   Spouští se přes `npm test markdown` (tests/run.js), ten nastaví UK_BASE. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const MOCK = fs.readFileSync(path.join(__dirname, 'mockDrive.js'), 'utf8');
const BASE = process.env.UK_BASE || 'http://localhost:8000/';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MD = `---
tags: [skola]
---
# Jaderná fyzika

Úvodní **tučný** a *kurzíva*, \`kód\`, [VUT](https://www.vut.cz) a ==zvýraznění==.
Druhý řádek odstavce.

## Úkoly
- [ ] Spočítat aktivitu
- [x] Odevzdat protokol
- Odrážka
  - Vnořená
1. První
2. Druhý

> [!WARNING]
> Pozor na jednotky

> Citát

---

| Test | Body |
| --- | :-: |
| Půlsemestrálka | 20<br>- [x] hotovo |
`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.endsWith('/driveSync.js')) return route.fulfill({ contentType: 'application/javascript', body: MOCK });
    if (u.endsWith('/sw.js')) return route.fulfill({ status: 404, body: '' });
    if (!u.startsWith(BASE) && !u.startsWith('blob:')) return route.abort();
    return route.continue();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + 'manifest.webmanifest');
  await page.evaluate(async () => {
    localStorage.clear(); localStorage.setItem('mock-D', JSON.stringify({ files: [], data: {}, tok: 'off' }));
    const pages = { pA: { id: 'pA', title: '', parent: null, order: 1, props: [], blocks: [{ id: 'b1', type: 'p', html: '' }] }, pB: { id: 'pB', title: 'Beta', parent: null, order: 2, props: [], blocks: [{ id: 'c1', type: 'p', html: 'Úvod' }] } };
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ukolnicek', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('images', { keyPath: 'id' }); d.createObjectStore('backups', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = rej; });
    await new Promise((res) => { const tx = db.transaction(['kv'], 'readwrite'); tx.objectStore('kv').put({ pages, events: {}, settings: {}, meta: {} }, 'state'); tx.oncomplete = res; });
    db.close();
  });
  await page.goto(BASE); await page.waitForSelector('#sync-box .cloud'); await sleep(400);
  await page.click('[data-act="open"][data-id="pA"]'); await sleep(300);

  console.log('1) import přes / → Import Markdownu');
  await page.click('#blocks .blk[data-id="b1"] .txt');
  await page.keyboard.type('/markdown'); await sleep(150);
  ok(/Import Markdownu/.test(await page.textContent('#slash')), 'v nabídce / je Import Markdownu');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  await fc.setFiles({ name: 'fyzika.md', mimeType: 'text/markdown', buffer: Buffer.from(MD) });
  await sleep(400);
  const pg = await page.evaluate(async () => { const { S } = await import('./js/state.js'); return S.pages.pA; });
  const types = pg.blocks.map((b) => b.type + (b.level ? b.level : '') + (b.done ? '✓' : '')).join(' ');
  ok(pg.title === 'Jaderná fyzika', 'název stránky z prvního # (YAML přeskočen): ' + pg.title);
  ok(types === 'p h2 todo todo✓ bullet bullet1 num num callout quote divider table p', 'typy bloků: ' + types);
  const p0 = pg.blocks[0].html;
  ok(/<b>tučný<\/b>/.test(p0) && /<i>kurzíva<\/i>/.test(p0) && /<code>kód<\/code>/.test(p0) && /href="https:\/\/www\.vut\.cz"/.test(p0) && /<mark class="hl-yellow">/.test(p0) && /<br>Druhý/.test(p0), 'formátování v textu: ' + p0);
  const cal = pg.blocks.find((b) => b.type === 'callout'), tb = pg.blocks.find((b) => b.type === 'table');
  ok(cal.icon === '⚠️' && cal.html === 'Pozor na jednotky', 'rámeček [!WARNING]');
  ok(tb.hrow && tb.rows.length === 2 && tb.rows[1].cells[1].lines.length === 2 && tb.rows[1].cells[1].lines[1].t === 'todo' && tb.rows[1].cells[1].lines[1].done, 'tabulka se záhlavím a úkolem v buňce');

  console.log('2) export tlačítkem vedle zámku');
  await page.evaluate(() => { const o = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { window.__dlName = this.download; return o.call(this); }; });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#md-btn')]);
  const out = fs.readFileSync(await dl.path(), 'utf8');
  const nm = await page.evaluate(() => window.__dlName);
  ok(nm === 'Jaderná fyzika.md', 'název souboru: ' + nm);
  ok(out.startsWith('# Jaderná fyzika\n') && /- \[ \] Spočítat aktivitu\n- \[x\] Odevzdat protokol\n- Odrážka\n  - Vnořená\n1\. První/.test(out), 'seznamy a úkoly v exportu');
  ok(/\*\*tučný\*\*/.test(out) && /\[VUT\]\(https:\/\/www\.vut\.cz\)/.test(out) && /> \[!WARNING\]\n> Pozor/.test(out) && /\| Půlsemestrálka \| 20<br>- \[x\] hotovo \|/.test(out), 'formát, odkaz, rámeček a tabulka v exportu');
  console.log('3) export jde zpět importovat');
  await page.click('[data-act="open"][data-id="pB"]'); await sleep(300);
  await page.click('#blocks .blk[data-id="c1"] .txt'); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('/markdown'); await sleep(150);
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  await fc2.setFiles({ name: 'x.md', mimeType: 'text/markdown', buffer: Buffer.from(out) }); await sleep(400);
  const pb = await page.evaluate(async () => { const { S } = await import('./js/state.js'); return S.pages.pB; });
  const back = pb.blocks.map((b) => b.type).join(' ');
  ok(pb.title === 'Beta' && back === 'p h1 p h2 todo todo bullet bullet num num callout quote divider table p', 'stránka s názvem dostane # jako blok: ' + back);

  ok(errors.length === 0, 'žádné chyby' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} SELHALO` : '\nVŠE OK');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
