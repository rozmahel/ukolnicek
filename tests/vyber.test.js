/* Úkolníček – test (3.2.0): výběr textu tažením přes víc bloků (kopírovat, smazat) a přesouvání projektů tažením.
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
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE.replace(/\/$/, '') });
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
      pA: { id: 'pA', title: 'Alfa', parent: null, order: 1, props: [], blocks: [
        { id: 'b1', type: 'h2', html: 'Nadpis' },
        { id: 'b2', type: 'bullet', html: 'První bod' },
        { id: 'b3', type: 'bullet', html: 'Druhý bod', level: 1 },
        { id: 'b4', type: 'todo', html: 'Úkol', done: true },
        { id: 'b5', type: 'p', html: 'Konec textu' }] },
      pB: { id: 'pB', title: 'Beta', parent: null, order: 2, props: [], blocks: [{ id: 'c1', type: 'p', html: '' }] },
      pC: { id: 'pC', title: 'Gama', parent: null, order: 3, props: [], blocks: [{ id: 'd1', type: 'p', html: '' }] }
    };
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ukolnicek', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('images', { keyPath: 'id' }); d.createObjectStore('backups', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = rej; });
    await new Promise((res) => { const tx = db.transaction(['kv'], 'readwrite'); tx.objectStore('kv').put({ pages, events: {}, settings: {}, meta: {} }, 'state'); tx.oncomplete = res; });
    db.close();
  });
  await page.goto(BASE); await page.waitForSelector('#sync-box .cloud'); await sleep(400);
  await page.click('[data-act="open"][data-id="pA"]'); await sleep(300);

  console.log('1) výběr tažením přes víc bloků');
  const box = async (id) => page.locator(`#blocks .blk[data-id="${id}"] .txt`).boundingBox();
  const a = await box('b2'), z = await box('b5');
  await page.mouse.move(a.x + 20, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(a.x + 40, a.y + a.height / 2 + 30, { steps: 5 });
  await page.mouse.move(z.x + 30, z.y + z.height / 2, { steps: 8 }); await page.mouse.up();
  const sel = await page.evaluate(() => getSelection().toString());
  ok(/bod[\s\S]*Druhý bod[\s\S]*Úkol[\s\S]*Kon/.test(sel), 'výběr jde přes víc bloků: ' + JSON.stringify(sel));
  await page.keyboard.press('ControlOrMeta+c'); await sleep(100);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok(/^- .*bod\n  - Druhý bod\n\[x\] Úkol\nKon/.test(clip), 'zkopírováno s odrážkami a zaškrtávátky: ' + JSON.stringify(clip));

  console.log('2) smazání výběru spojí první a poslední blok');
  await page.keyboard.press('Backspace'); await sleep(200);
  const txts = await page.$$eval('#blocks .txt', (t) => t.map((x) => x.textContent));
  ok(txts.length === 2 && /^Pr.*textu$/.test(txts[1]), 'zbyl nadpis a spojený blok: ' + JSON.stringify(txts));
  ok(await page.evaluate(() => document.activeElement.classList.contains('txt') && document.activeElement.isContentEditable), 'kurzor je zpátky v textu a jde psát');
  await page.click('#undo-btn'); await sleep(200);
  ok((await page.$$('#blocks .blk')).length === 5, 'Zpět vrátí smazané bloky');

  console.log('3) přesouvání projektů tažením');
  const order = () => page.$$eval('#side .ti-main', (b) => b.map((x) => x.textContent.trim()).join(' | '));
  const g = await page.locator('.ti-main[data-id="pC"]').boundingBox(), al = await page.locator('.ti-main[data-id="pA"]').boundingBox();
  await page.mouse.move(g.x + 30, g.y + g.height / 2); await page.mouse.down();
  await page.mouse.move(g.x + 30, g.y - 10, { steps: 4 }); await page.mouse.move(al.x + 30, al.y + 3, { steps: 6 });
  ok(await page.$('.ti.drop-before') !== null, 'čára ukazuje, kam se projekt vloží');
  await page.mouse.up(); await sleep(200);
  ok(/^.*Gama \| .*Alfa \| .*Beta$/.test(await order()), 'Gama je nahoře: ' + await order());
  ok(await page.$eval('#page-title', (t) => t.textContent) === 'Alfa', 'puštění neotevřelo jiný projekt');

  console.log('4) výběr celých bloků');
  await page.click('[data-act="open"][data-id="pA"]'); await sleep(300);
  await page.click('#blocks .blk[data-id="b2"] .txt'); await page.keyboard.press('Escape'); await sleep(50);
  ok(await page.$$eval('#blocks .bsel', (b) => b.map((x) => x.dataset.id).join()) === 'b2', 'Esc vybere celý blok');
  await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown'); await sleep(50);
  ok(await page.$$eval('#blocks .bsel', (b) => b.map((x) => x.dataset.id).join()) === 'b2,b3,b4', 'Shift+↓ přidá další bloky');
  ok(await page.isVisible('#bselbar') && /3 bloky/.test(await page.textContent('#bselbar')), 'lišta s počtem bloků');
  await page.keyboard.press('ControlOrMeta+c'); await sleep(100);
  ok(/^- .*bod\n  - Druhý bod\n\[x\] Úkol$/.test(await page.evaluate(() => navigator.clipboard.readText())), '⌘C zkopíruje celé bloky: ' + JSON.stringify(await page.evaluate(() => navigator.clipboard.readText())));
  await page.click('#bselbar [data-b="type"]'); await page.click('.pop [data-v="todo"]'); await sleep(100);
  ok(await page.$$eval('#blocks .blk', (b) => b.slice(1, 4).every((x) => x.classList.contains('b-todo'))), 'převod všech vybraných na úkoly');
  ok(await page.$$eval('#blocks .bsel', (b) => b.length) === 3, 'výběr zůstal');
  await page.keyboard.press('Alt+Shift+ArrowUp'); await sleep(100);
  ok(await page.$$eval('#blocks .blk', (b) => b.map((x) => x.dataset.id).join()) === 'b2,b3,b4,b1,b5', '⌥⇧↑ posune bloky nad nadpis');
  await page.keyboard.press('ControlOrMeta+d'); await sleep(100);
  ok((await page.$$('#blocks .blk')).length === 8, '⌘D duplikuje');
  await page.keyboard.press('Backspace'); await sleep(100);
  ok((await page.$$('#blocks .blk')).length === 5 && !(await page.isVisible('#bselbar')), 'Backspace smaže vybrané (kopie)');
  const f = await page.locator('#blocks .blk[data-id="b1"]').boundingBox(), l = await page.locator('#blocks .blk[data-id="b5"]').boundingBox();
  await page.mouse.move(f.x - 40, f.y - 6); await page.mouse.down(); await page.mouse.move(f.x - 30, f.y + 20, { steps: 3 }); await page.mouse.move(f.x - 20, l.y + 5, { steps: 4 }); await page.mouse.up(); await sleep(100);
  ok(await page.$$eval('#blocks .bsel', (b) => b.map((x) => x.dataset.id).join()) === 'b1,b5', 'rámeček z okraje vybere bloky: ' + await page.$$eval('#blocks .bsel', (b) => b.map((x) => x.dataset.id).join()));
  await page.keyboard.press('Escape'); await sleep(50);
  ok(!(await page.$('#blocks .bsel')), 'Esc výběr zruší');

  console.log('5) nabídka @ a zpětné odkazy');
  await page.click('#blocks .blk[data-id="b5"] .txt'); await page.keyboard.press('End');
  await page.keyboard.type(' @bet'); await sleep(100);
  ok(await page.isVisible('#mention') && /Beta/.test(await page.textContent('#mention')), 'nabídka @ našla stránku Beta');
  await page.keyboard.press('Enter'); await sleep(100);
  ok(await page.$eval('#blocks .blk[data-id="b5"] .txt', (t) => !!t.querySelector('a.mention[data-page="pB"]') && !/@bet/.test(t.textContent)), 'vložen odkaz na stránku');
  await page.keyboard.type('a @zít'); await sleep(100);
  await page.keyboard.press('Enter'); await sleep(100);
  const zz = new Date(); zz.setDate(zz.getDate() + 1);
  ok((await page.textContent('#blocks .blk[data-id="b5"] .txt')).includes(`${zz.getDate()}. ${zz.getMonth() + 1}.`), 'vloženo datum zítřka');
  await sleep(500);
  await page.click('#blocks a.mention[data-page="pB"]'); await sleep(300);
  ok(await page.$eval('#page-title', (t) => t.textContent) === 'Beta', 'klik na odkaz otevře stránku');
  ok(await page.isVisible('.backlinks') && /Alfa/.test(await page.textContent('.backlinks')), 'Beta ukazuje „Odkazuje sem“ z Alfy');
  await page.click('.backlinks .bl-it'); await sleep(300);
  ok(await page.$eval('#page-title', (t) => t.textContent) === 'Alfa', 'zpětný odkaz vede na blok');
  await page.evaluate(async () => { const { S } = await import('./js/state.js'); S.pages.pB.title = 'Beta nová'; });
  await page.click('[data-act="open"][data-id="pC"]'); await sleep(200); await page.click('[data-act="open"][data-id="pA"]'); await sleep(200);
  ok(await page.textContent('#blocks a.mention') === 'Beta nová', 'odkaz ukazuje aktuální název');

  ok(errors.length === 0, 'žádné chyby' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} SELHALO` : '\nVŠE OK');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
