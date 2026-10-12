/* Úkolníček – test (3.4.0): rovnice (LaTeX), skok na nalezený text z hledání, ⌘S = nahrání na Disk,
   zavírání oznámení, tichý indikátor ukládání, úpravy Indexu a nové motivy.
   Spouští se přes `npm test rovnice` (tests/run.js), ten nastaví UK_BASE. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const MOCK = fs.readFileSync(path.join(__dirname, 'mockDrive.js'), 'utf8');
const BASE = process.env.UK_BASE || 'http://localhost:8000/';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MD = `Rychlost $v_0 = 5\\,\\text{m/s}$ a cena $5 a $6.

$$
E = mc^2
$$
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
  const SEED = async () => {
    localStorage.clear(); localStorage.setItem('mock-D', JSON.stringify({ files: [], data: {}, tok: 'ok' }));
    const pages = {
      pA: { id: 'pA', title: 'Rovnice', parent: null, order: 1, props: [], blocks: [{ id: 'b1', type: 'p', html: '' }] },
      pB: { id: 'pB', title: 'Fyzika', parent: null, order: 2, props: [], blocks: [{ id: 'h', type: 'h1', html: 'Sekce', collapsed: true }, ...Array.from({ length: 40 }, (_, i) => ({ id: 'x' + i, type: 'p', html: 'Výplň ' + i })), { id: 'tgt', type: 'p', html: 'Tady je Poločas rozpadu jódu.' }] }
    };
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ukolnicek', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('images', { keyPath: 'id' }); d.createObjectStore('backups', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = rej; });
    await new Promise((res) => { const tx = db.transaction(['kv'], 'readwrite'); tx.objectStore('kv').put({ pages, events: {}, settings: { school: true }, semesters: { s1: { id: 's1', name: 'ZS', order: 1 } }, subjects: { su: { id: 'su', code: 'LMJ', name: 'Jaderná', credits: 5, sem: 's1', end: 'zk', pts: '85' } }, meta: {} }, 'state'); tx.oncomplete = res; });
    db.close();
  };
  await page.evaluate(SEED);
  await page.goto(BASE); await page.waitForSelector('#sync-box .cloud'); await sleep(400);
  const st = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open('ukolnicek', 1); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('state'); g.onsuccess = () => res(g.result); }; }));

  console.log('1) /rovnice v prázdném řádku = blok rovnice');
  await page.click('[data-act="open"][data-id="pA"]'); await sleep(300);
  await page.click('#blocks .blk[data-id="b1"] .txt');
  await page.keyboard.type('/rovnice'); await sleep(300);
  await page.keyboard.press('Enter'); await sleep(300);
  ok(!!(await page.$('.eq-pop .eq-in')), 'otevřelo se okénko s polem pro LaTeX');
  await page.keyboard.type('\\frac{a}{b}'); await sleep(300);
  ok(!!(await page.$('.eq-pop .eq-prev .katex')), 'náhled vykreslený KaTeXem');
  await page.keyboard.press('Enter'); await sleep(500);
  let s = await st();
  ok(s.pages.pA.blocks[0].type === 'eq' && s.pages.pA.blocks[0].html === '\\frac{a}{b}', 'v datech blok eq s TeX: ' + JSON.stringify(s.pages.pA.blocks[0]));
  ok(!!(await page.$('#blocks .eqb .katex-display')), 'blok je vykreslený');

  console.log('2) rovnice v textu: $…$ a /rovnice uprostřed věty');
  const tail = await page.$$('#blocks .blk .txt'); await tail[tail.length - 1].click();
  await page.keyboard.type('Rychlost $v_0$ a teplota '); await sleep(300);
  await page.keyboard.type('/rovnice'); await sleep(300); await page.keyboard.press('Enter'); await sleep(200);
  await page.keyboard.type('20^\\circ\\text{C}'); await page.keyboard.press('Enter'); await sleep(600);
  s = await st();
  const pb = s.pages.pA.blocks.find((b) => b.type === 'p' && /eq/.test(b.html || ''));
  ok(pb && (pb.html.match(/<span class="eq" contenteditable="false">/g) || []).length === 2, 'dvě rovnice v textu: ' + (pb && pb.html));
  ok(pb && /Rychlost <span[^>]*>v_0<\/span> a teplota/.test(pb.html), 'po $…$ jde psát dál, bez dvojité mezery');
  ok(pb && pb.html.includes('>v_0</span>') && pb.html.includes('>20^\\circ\\text{C}</span>') && !/katex/.test(pb.html), 'v datech jen zdroj TeX, žádné HTML z KaTeXu');
  const shadow = await page.$$eval('#blocks .txt span.eq', (els) => els.map((e) => !!(e.shadowRoot && e.shadowRoot.querySelector('.katex'))));
  ok(shadow.length === 2 && shadow.every(Boolean), 'obě vykreslené (shadow DOM)');
  await page.click('#blocks .txt span.eq'); await sleep(200);
  ok((await page.$eval('.eq-pop .eq-in', (t) => t.value)) === 'v_0', 'klik na rovnici otevře úpravu s jejím TeXem');
  await page.keyboard.press('Escape'); await sleep(200);
  ok(!(await page.$('.eq-pop')), 'Esc okénko zavře');

  console.log('3) Markdown: import $ a $$, export');
  await page.click('[data-act="tail"]'); await sleep(200);
  await page.keyboard.type('/markdown'); await sleep(150);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  await fc.setFiles({ name: 'r.md', mimeType: 'text/markdown', buffer: Buffer.from(MD) }); await sleep(500);
  s = await st();
  const bl = s.pages.pA.blocks;
  ok(bl.some((b) => b.type === 'eq' && b.html === 'E = mc^2'), 'blok $$…$$ → rovnice na řádku');
  ok(bl.some((b) => b.type === 'p' && /<span class="eq" contenteditable="false">v_0 = 5\\,\\text\{m\/s\}<\/span>/.test(b.html) && /cena \$5 a \$6/.test(b.html)), 'inline $…$ → rovnice, „$5 a $6“ zůstane textem');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#md-btn')]);
  const md = fs.readFileSync(await dl.path(), 'utf8');
  ok(md.includes('$$\n\\frac{a}{b}\n$$') && md.includes('$v_0$') && md.includes('$$\nE = mc^2\n$$'), 'export obsahuje $…$ i $$…$$');

  console.log('4) hledání skočí na text a zvýrazní ho');
  await page.keyboard.press('Meta+k'); await sleep(150);
  await page.keyboard.type('polocas'); await sleep(150); await page.keyboard.press('Enter'); await sleep(500);
  const hl = await page.evaluate(() => { const h = CSS.highlights && CSS.highlights.get('uk-find'); if (!h) return null; const r = [...h][0]; const rc = r.getBoundingClientRect(); return { t: r.toString(), vis: rc.top > 0 && rc.bottom < innerHeight }; });
  ok(hl && hl.t === 'Poločas' && hl.vis, 'nalezený text je zvýrazněný a vidět: ' + JSON.stringify(hl));
  ok(!!(await page.$('#blocks .blk[data-id="tgt"]')), 'sbalená sekce se rozbalila');

  console.log('5) ⌘S, oznámení, ukládání');
  await page.keyboard.press('Meta+s'); await sleep(600);
  ok((await page.evaluate(() => window.__D.calls)).includes('upload'), '⌘S nahrálo na Disk');
  ok(await page.$eval('.toast', (t) => !!t.querySelector('button.x')), 'oznámení má křížek');
  await page.click('.toast button.x'); await sleep(300);
  ok(!(await page.$('.toast')), 'křížek oznámení zavře');
  await page.click('#blocks .blk .txt'); await page.keyboard.type('x'); await sleep(100);
  ok((await page.textContent('#save-state')) === '', 'při psaní se vedle Nastavení nic neukazuje');

  console.log('6) Index');
  await page.click('[data-act="nav"][data-v="index"]'); await sleep(300);
  const ix = await page.textContent('#view');
  ok(!/Předměty, kredity a známky|zápočet a známka A–E|váhou jsou kredity|čeká na zápočet/.test(ix), 'zbytečné texty pryč');
  ok(await page.$eval('[data-act="subj-new"]', (b) => !b.classList.contains('pri')), '＋ Předmět stejné jako ＋ Semestr');

  console.log('7) motivy');
  const n = await page.evaluate(() => import('./js/theme.js').then((m) => m.SKINS.length));
  ok(n === 6, 'šest motivů');

  console.log('8) telefon: lišta formátu pod výběrem (nad ním je systémová nabídka)');
  const mctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  await mctx.route('**/*', (route) => { const u = route.request().url(); if (u.endsWith('/driveSync.js')) return route.fulfill({ contentType: 'application/javascript', body: MOCK }); if (u.endsWith('/sw.js')) return route.fulfill({ status: 404, body: '' }); if (!u.startsWith(BASE)) return route.abort(); return route.continue(); });
  const mp = await mctx.newPage(); await mp.goto(BASE + 'manifest.webmanifest'); await mp.evaluate(SEED); await mp.goto(BASE); await sleep(800);
  const pos = await mp.evaluate(async () => {
    document.querySelector('[data-act="open"][data-id="pB"]').click(); await new Promise((r) => setTimeout(r, 300));
    const t = document.querySelector('#blocks .blk[data-id="h"] .txt'); t.focus();
    const r = document.createRange(); r.setStart(t.firstChild, 0); r.setEnd(t.firstChild, 5); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    await new Promise((res) => setTimeout(res, 300));
    const f = document.getElementById('fmt'); return { hidden: f.hidden, top: f.getBoundingClientRect().top, sel: r.getBoundingClientRect().bottom };
  });
  ok(!pos.hidden && pos.top >= pos.sel + 20, 'lišta je pod výběrem: ' + JSON.stringify(pos));
  await mctx.close();

  ok(!errors.length, 'bez chyb v konzoli: ' + errors.join(' | '));
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
