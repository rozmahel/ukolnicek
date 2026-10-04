/* Úkolníček – test: blok /předmět v poznámkách (výběr z Indexu, živý název, sbalování, úkoly), převody H1 ↔ předmět,
   smazaný předmět, klasické poznámky bez školního režimu, smazání školních dat, spojení verzí a starší verze aplikace.
   Spouští se přes `npm test` (tests/run.js), ten nastaví UK_BASE (a UK_OLD). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const MOCK = fs.readFileSync(path.join(__dirname, 'mockDrive.js'), 'utf8');
const SHOTS = path.join(__dirname, 'shots', path.basename(__filename, '.test.js')); fs.mkdirSync(SHOTS, { recursive: true });
const ORIGIN = process.env.UK_BASE || 'http://localhost:8000/';
const OLD = process.env.UK_OLD || ORIGIN, NEW = ORIGIN;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

const seed = {
  settings: { school: true, semesterStart: '2026-09-21' },
  semesters: { s1: { id: 's1', name: 'ZS 2026/27', target: 30, order: 2 }, s0: { id: 's0', name: 'LS 2025/26', target: 30, order: 1 } },
  subjects: {
    sa: { id: 'sa', code: 'MPA-ZJR', name: 'Jaderné systémy', credits: 4, sem: 's1', end: 'zk', color: 'purple', pts: '', parts: [] },
    sb: { id: 'sb', code: 'LMJ', name: 'Mechanika tekutin', credits: 5, sem: 's1', end: 'zk', color: 'blue', pts: '', parts: [] },
    sc: { id: 'sc', code: 'ELE', name: 'Elektroenergetika', credits: 6, sem: 's0', end: 'zk', color: 'green', pts: '91', parts: [] }
  },
  events: { e1: { id: 'e1', title: 'ZJR', type: 'Přednáška', day: 0, start: '08:00', end: '09:50', repeat: 'weekly', color: 'purple', subj: 'sa' } },
  pages: { pZ: { id: 'pZ', title: 'Zimní semestr 2026', icon: '🎓', color: 'purple', parent: null, order: 1, props: [], blocks: [
    { id: 'p0', type: 'p', html: 'Poznámky k semestru' }, { id: 'e0', type: 'p', html: '' },
    { id: 'hd', type: 'h1', html: 'Diplomka', until: 'td' }, { id: 'td', type: 'todo', html: 'Domluvit téma' }, { id: 'pz', type: 'p', html: 'konec' }] } }
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.endsWith('/driveSync.js')) return route.fulfill({ contentType: 'application/javascript', body: MOCK });
    if (u.endsWith('/sw.js')) return route.fulfill({ status: 404, body: '' });
    if (!u.startsWith(ORIGIN)) return route.abort();
    return route.continue();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const boot = async (url = NEW, ms = 600) => { await page.goto(url); await page.waitForSelector('#sync-box .cloud'); await sleep(ms); };
  const view = () => page.evaluate(() => JSON.parse(localStorage.getItem('uk-view')));
  const idbState = () => page.evaluate(async () => { const db = await window.Local.open(); return new Promise((res) => { const r = db.transaction('kv').objectStore('kv').get('state'); r.onsuccess = () => res(r.result); }); });
  const putState = (st) => page.evaluate(async (st) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ukolnicek', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('images', { keyPath: 'id' }); d.createObjectStore('backups', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = rej; });
    await new Promise((res) => { const tx = db.transaction(['kv'], 'readwrite'); tx.objectStore('kv').put(st, 'state'); tx.oncomplete = res; }); db.close();
  }, st);
  const blocks = async () => { await sleep(450); return (await idbState()).pages.pZ.blocks; };   /* ukládání do zařízení je o 0,35 s odložené */
  const heads = () => page.$$eval('#blocks .b-subj, #blocks .b-h1', (b) => b.map((x) => (x.classList.contains('b-subj') ? '🎓 ' : '# ') + x.querySelector('.row').innerText.replace(/\s+/g, ' ').trim()));
  const openPage = async () => { await page.click('.ti-main[data-id="pZ"]'); await sleep(250); };

  await page.goto(NEW + 'manifest.webmanifest');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('mock-D', JSON.stringify({ files: [], data: {}, tok: 'off' })); });
  await putState(Object.assign(JSON.parse(JSON.stringify(seed)), { meta: {} }));
  await boot();

  // ---------- vložení přes /předmět ----------
  console.log('1) /předmět: výběr z Indexu');
  await openPage();
  await page.click('#blocks .blk[data-id="e0"] .txt');
  await page.keyboard.type('/před'); await sleep(100);
  ok(/Předmět/.test(await page.textContent('#slash')), 'v lomítkovém menu je „Předmět“');
  await page.keyboard.press('Enter'); await sleep(150);
  ok(await page.isVisible('.pop.subj-pick'), 'otevřel se výběr předmětů');
  ok((await page.$$eval('.subj-pick .pop-h', (h) => h.map((x) => x.textContent))).join(' | ') === 'ZS 2026/27 | LS 2025/26', 'rozdělené po semestrech, novější nahoře');
  ok(await page.evaluate(() => document.activeElement.classList.contains('sp-q')), 'kurzor je v hledání');
  await page.screenshot({ path: path.join(SHOTS, 'vyber-predmetu.png') });
  await page.keyboard.type('mechan'); await sleep(50);
  ok((await page.$$eval('.subj-pick .sp-it', (b) => b.map((x) => x.innerText.trim()))).join(' | ') === 'LMJ Mechanika tekutin', 'hledání bez diakritiky');
  await page.keyboard.press('Enter'); await sleep(200);
  let bl = await blocks();
  ok(bl[1].type === 'subj' && bl[1].subj === 'sb' && bl[1].html === 'LMJ — Mechanika tekutin', 'prázdný řádek se nahradil blokem předmětu (s textovou kopií názvu)');
  ok(bl[2].type === 'p' && bl[2].html === '', 'pod ním je prázdný řádek');
  ok(await page.evaluate(() => document.activeElement.closest('.blk') && document.activeElement.closest('.blk').previousElementSibling.classList.contains('b-subj')), 'kurzor je na řádku pod předmětem');
  await page.keyboard.type('[] Spočítat úlohy 6.10.'); await page.keyboard.press('Enter'); await page.keyboard.type('Laborka');
  await page.keyboard.press('Enter'); await page.keyboard.press('Backspace');
  await page.keyboard.type('## Přednášky'); await sleep(50);
  ok((await heads()).slice(0, 1).join() === '🎓 LMJ Mechanika tekutin', 'nadpis předmětu: ' + (await heads()).join(' / '));
  ok(await page.$eval('#blocks .b-subj', (b) => b.classList.contains('hl-blue') && !b.querySelector('[contenteditable]')), 'barva z Indexu, text se nedá psát ručně');
  await page.screenshot({ path: path.join(SHOTS, 'blok-predmetu.png') });

  console.log('2) stejný předmět víckrát, odkazy z karty');
  await page.click('.doc-tail'); await page.keyboard.type('/předmět'); await page.keyboard.press('Enter'); await sleep(120);
  await page.keyboard.type('LMJ'); await page.keyboard.press('Enter'); await sleep(200);
  bl = await blocks();
  ok(bl.filter((b) => b.type === 'subj' && b.subj === 'sb').length === 2, 'LMJ je na stránce dvakrát');
  await page.keyboard.type('[] Druhý úkol'); await sleep(500);
  await page.click('[data-act="nav"][data-v="index"]');
  const lmj = page.locator('.ix-card[data-id="sb"]');
  ok(/Poznámky · 2/.test(await lmj.innerText()) && /3 nesplněné úkoly/.test(await lmj.innerText()), 'karta: ' + (await lmj.locator('.ixc-links').innerText()).replace(/\s+/g, ' '));
  await lmj.locator('[data-act="ix-notes"]').click();
  ok((await page.$$('.pop .pop-item')).length === 2, 'výběr ze dvou míst v poznámkách');
  await page.click('.pop .pop-item >> nth=1'); await sleep(300);
  ok((await view()).pageId === 'pZ' && await page.$eval('#blocks .blk.flash', (b) => b.classList.contains('b-subj')).catch(() => false), 'skok na druhý výskyt (zvýrazněný)');
  await page.click('[data-act="nav"][data-v="index"]');
  await lmj.locator('[data-act="ix-tasks"]').click();
  ok(/Spočítat úlohy/.test(await page.textContent('.pop')), 'seznam nesplněných úkolů');
  await page.keyboard.press('Escape');

  console.log('3) přejmenování v Indexu se projeví všude');
  await lmj.locator('.ixc-gear').click(); await page.fill('#su-name', 'Mechanika tekutin a hydraulika'); await page.click('#suf button[type=submit]'); await sleep(300);
  await openPage();
  ok((await heads()).filter((h) => /hydraulika/.test(h)).length === 2, 'oba bloky mají nový název');
  bl = await blocks();
  ok(bl.filter((b) => b.type === 'subj').every((b) => b.html === 'LMJ — Mechanika tekutin a hydraulika'), 'textová kopie názvu pro starší verze se aktualizovala');

  console.log('4) sbalování a úkoly pod předmětem');
  await page.hover('#blocks .b-subj >> nth=0'); await page.click('#blocks .b-subj >> nth=0 >> .caret'); await sleep(100);
  ok(/3 skryté bloky/.test(await page.textContent('#blocks')), 'sbalený předmět skryje svou sekci (do dalšího H1): ' + (await page.textContent('#blocks .hidden-count')));
  await page.click('[data-act="nav"][data-v="tasks"]'); await sleep(200);
  const grp = await page.$$eval('.t-grp-t', (g) => g.map((x) => x.textContent + (x.classList.contains('hl-blue') ? ' [modrá]' : '')));
  ok(grp.includes('LMJ — Mechanika tekutin a hydraulika [modrá]') && grp.includes('Diplomka'), 'skupiny v Úkolech: ' + grp.join(' | '));
  ok(/LMJ — Mechanika tekutin a hydraulika/.test(await page.textContent('.t-sec')), 'úkol s termínem má v cestě předmět');
  await page.click('[data-act="nav"][data-v="today"]'); await sleep(200);
  ok(/Dnes nemáš v rozvrhu nic\.|Zítra/.test(await page.textContent('#view')) && !(await page.$('#view [data-act="day-add"]')), 'Dnes: bez odkazu na přidání události');
  ok(/Stav úkolů podle předmětů/.test(await page.textContent('#view')) && /LMJ — Mechanika tekutin a hydraulika/.test(await page.textContent('#view')), 'Dnes: stav úkolů podle předmětů');
  await page.click('.t-grp-t, [data-act="goto-task"] >> nth=0').catch(() => {});

  console.log('4b) oddělovač: sbalovat včetně oddělovače, nebo po něj');
  await openPage();
  await page.evaluate(async () => { const { S } = await import('./js/state.js'); const { rerenderBlocks } = await import('./js/editor/render.js'); const pg = S.pages.pZ; pg.blocks.find((b) => b.id === 'hd').collapsed = false; const i = pg.blocks.findIndex((b) => b.id === 'td'); pg.blocks.splice(i + 1, 0, { id: 'dv', type: 'divider', html: '' }); rerenderBlocks(); });
  await page.hover('#blocks .blk[data-id="dv"]'); await page.click('#blocks .blk[data-id="dv"] .g-drag');
  const dvOpts = await page.$$eval('.pop [data-v^="until"]', (b) => b.map((x) => x.dataset.v));
  ok(dvOpts.includes('until:hd') && dvOpts.includes('untilv:hd'), 'u oddělovače dvě volby: ' + dvOpts.join(', '));
  await page.click('.pop [data-v="untilv:hd"]'); await sleep(100);
  await page.click('#blocks .blk[data-id="hd"] .caret'); await sleep(100);
  ok(await page.isVisible('#blocks .blk[data-id="dv"]') && !(await page.isVisible('#blocks .blk[data-id="td"]')), 'sbaleno po oddělovač, oddělovač zůstal vidět');
  await page.hover('#blocks .blk[data-id="dv"]'); await page.click('#blocks .blk[data-id="dv"] .g-drag');
  await page.click('.pop [data-v="until:hd"]'); await sleep(100);
  ok(!(await page.$('#blocks .blk[data-id="dv"]')), 'včetně oddělovače: schová se taky');
  let hdb = (await blocks()).find((b) => b.id === 'hd');
  ok(hdb.until === 'dv' && !hdb.untilVis, 'v datech until bez untilVis');
  const dvBox = await page.evaluate(async () => { const { S } = await import('./js/state.js'); S.pages.pZ.blocks.find((b) => b.id === 'hd').collapsed = false; const { rerenderBlocks } = await import('./js/editor/render.js'); rerenderBlocks(); const b = document.querySelector('#blocks .blk[data-id="dv"]'), hr = b.querySelector('hr'), g = b.querySelector('.g-drag'); const rb = b.getBoundingClientRect(), rh = hr.getBoundingClientRect(), rg = g.getBoundingClientRect(); return { blk: rb.top + rb.height / 2, hr: rh.top + rh.height / 2, g: rg.top + rg.height / 2 }; });
  ok(Math.abs(dvBox.blk - dvBox.hr) < 1.5 && Math.abs(dvBox.g - dvBox.hr) < 2, 'čára oddělovače je uprostřed řádku: ' + JSON.stringify(dvBox));
  await page.evaluate(async () => { const { S } = await import('./js/state.js'); const pg = S.pages.pZ; pg.blocks = pg.blocks.filter((b) => b.id !== 'dv'); delete pg.blocks.find((b) => b.id === 'hd').until; pg.blocks.find((b) => b.id === 'hd').until = 'td'; const { savePage } = await import('./js/store.js'); savePage(pg); });

  console.log('4c) emoji a formát nadpisu předmětu');
  await openPage();
  await page.click('#blocks .b-subj >> nth=0 >> .sj-h');
  ok(/Formát nadpisu/.test(await page.textContent('.pop')) && /Ikona místo tečky/.test(await page.textContent('.pop')), 'odemčeno: v menu je formát a ikona');
  await page.click('.pop [data-v="f:it"]'); await page.click('.pop [data-v="h:yellow"]'); await sleep(100);
  ok(await page.isVisible('.pop'), 'menu zůstane otevřené při formátování');
  await page.screenshot({ path: path.join(SHOTS, 'predmet-format-menu.png') });
  await page.click('.pop [data-v="e:⚛️"]'); await sleep(150);
  ok(await page.$eval('#blocks .b-subj', (b) => !!b.querySelector('.sj-ic') && b.querySelector('.sj-ic').textContent === '⚛️' && !b.querySelector('.sj-dot') && !!b.querySelector('mark.hl-yellow i')), 'emoji místo tečky, kurzíva a zvýraznění');
  let fb = (await blocks()).find((b) => b.type === 'subj');
  ok(fb.icon === '⚛️' && fb.it === true && fb.hl === 'yellow', 'uloženo v datech');
  await page.screenshot({ path: path.join(SHOTS, 'predmet-format.png') });
  await page.keyboard.press(`${MOD}+Shift+KeyL`); await sleep(100);
  await page.click('#blocks .b-subj >> nth=0 >> .sj-h');
  ok(!/Formát nadpisu/.test(await page.textContent('.pop')) && /Otevřít v Indexu/.test(await page.textContent('.pop')), 'zamčeno: jen Otevřít v Indexu a Změnit předmět');
  await page.keyboard.press('Escape'); await page.keyboard.press(`${MOD}+Shift+KeyL`); await sleep(100);
  await page.click('#blocks .b-subj >> nth=0 >> .sj-h'); await page.click('.pop [data-v="f:it"]'); await page.click('.pop [data-v="h:"]'); await page.click('.pop [data-v="e:"]'); await sleep(150);
  fb = (await blocks()).find((b) => b.type === 'subj');
  ok(!fb.icon && !fb.it && !fb.hl, 'vše jde vrátit zpět');

  console.log('5) klik na nadpis předmětu, převody H1 ↔ předmět');
  await openPage();
  await page.click('#blocks .b-subj >> nth=0 >> .sj-h');
  ok(/Otevřít v Indexu/.test(await page.textContent('.pop')) && /Změnit předmět/.test(await page.textContent('.pop')), 'menu nadpisu předmětu');
  await page.click('.pop [data-v="ix"]'); await sleep(300);
  ok((await view()).kind === 'index' && await page.$eval('.ix-card[data-id="sb"]', (c) => c.classList.contains('flash')), 'Otevřít v Indexu → karta zvýrazněná');
  await openPage();
  await page.hover('#blocks .blk[data-id="hd"]'); await page.click('#blocks .blk[data-id="hd"] .g-drag');
  ok(/Předmět…/.test(await page.textContent('.pop')), 'u nadpisu H1 je „Převést na → Předmět…“');
  await page.click('.pop [data-v="tosubj"]'); await sleep(100);
  ok(await page.isVisible('.pop.subj-pick'), 'výběr předmětu');
  await page.keyboard.type('zjr'); await page.keyboard.press('Enter'); await sleep(200);
  bl = await blocks();
  const hd = bl.find((b) => b.id === 'hd');
  ok(hd.type === 'subj' && hd.subj === 'sa' && hd.until === 'td', 'H1 „Diplomka“ je teď MPA-ZJR, „sbalovat až sem“ zůstalo');
  await page.hover('#blocks .blk[data-id="hd"]'); await page.click('#blocks .blk[data-id="hd"] .g-drag');
  await page.click('.pop [data-v="subj-h1"]'); await sleep(200);
  bl = await blocks();
  ok(bl.find((b) => b.id === 'hd').type === 'h1' && bl.find((b) => b.id === 'hd').html === 'MPA-ZJR — Jaderné systémy' && !('subj' in bl.find((b) => b.id === 'hd')), 'zpět na H1 s názvem předmětu');
  await page.keyboard.press(`${MOD}+z`); await sleep(200);
  ok((await blocks()).find((b) => b.id === 'hd').type === 'subj', '⌘Z vrátí blok předmětu');

  console.log('6) smazaný předmět');
  await page.click('[data-act="nav"][data-v="index"]');
  await page.locator('.ix-card[data-id="sa"] .ixc-gear').click(); await page.click('#su-del'); await sleep(200);
  await openPage();
  ok(await page.$eval('#blocks .blk[data-id="hd"]', (b) => /Smazaný předmět/.test(b.innerText) && /MPA-ZJR — Jaderné systémy/.test(b.innerText)), 'blok ukáže „Smazaný předmět“ (a poslední název)');
  await page.click('#blocks .blk[data-id="hd"] .sj-h'); await sleep(100);
  ok(await page.isVisible('.pop.subj-pick'), 'klik rovnou nabídne jiný předmět');
  await page.keyboard.type('ele'); await page.keyboard.press('Enter'); await sleep(200);
  ok((await blocks()).find((b) => b.id === 'hd').subj === 'sc', 'vybrán jiný předmět');

  console.log('7) hledání podle názvu předmětu');
  await page.click('[data-act="nav"][data-v="today"]');
  await page.keyboard.press(`${MOD}+k`); await page.keyboard.type('hydraul'); await sleep(100);
  ok(/Zimní semestr 2026/.test(await page.textContent('#qres')), 'stránka se najde podle předmětu v bloku');
  await page.keyboard.press('Escape');

  // ---------- klasické poznámky ----------
  console.log('8) vypnutý školní režim');
  await page.click('[data-act="settings"]'); await page.uncheck('#st-school'); await page.keyboard.press('Escape'); await sleep(300);
  await openPage();
  ok(await page.$$eval('#blocks .b-subj', (b) => b.every((x) => x.querySelector('.t-h1.sj-plain') && !x.querySelector('[data-act="subj-blk"]'))), 'bloky předmětu jsou obyčejné nadpisy H1 bez odkazu do Indexu');
  ok((await heads())[0] === '🎓 LMJ — Mechanika tekutin a hydraulika', 'text nadpisu: ' + (await heads())[0]);
  await page.click('.doc-tail'); await page.keyboard.type('/před'); await sleep(100);
  ok(!(await page.isVisible('#slash')) || !/Předmět/.test(await page.textContent('#slash')), 'lomítkové menu „Předmět“ nenabízí');
  await page.keyboard.press('Escape'); await page.keyboard.press(`${MOD}+a`); await page.keyboard.press('Backspace');
  await page.click('[data-act="nav"][data-v="tasks"]'); await sleep(150);
  ok((await page.$$eval('.t-grp-t', (g) => g.map((x) => x.textContent))).includes('LMJ — Mechanika tekutin a hydraulika'), 'úkoly jsou dál seskupené pod nadpisem předmětu');
  await page.click('[data-act="settings"]'); await page.check('#st-school'); await page.keyboard.press('Escape'); await sleep(300);

  // ---------- skrytý Index (3.0.1) ----------
  console.log('8b) školní režim bez Indexu');
  await page.click('[data-act="nav"][data-v="schedule"]');
  await page.click('#sg .ev[data-id="e1"]'); await page.selectOption('#ev-subj', 'sb'); await page.click('#evf button[type=submit]'); await sleep(500);
  ok((await idbState()).events.e1.subj === 'sb', 'příprava: hodina e1 má předmět LMJ');
  await page.click('[data-act="nav"][data-v="index"]'); await sleep(200);
  await page.click('[data-act="settings"]');
  ok(await page.isChecked('#st-ix'), 've výchozím stavu je Index zapnutý');
  ok(!('noIndex' in (await idbState()).settings), 'v datech není žádný nový klíč');
  await page.uncheck('#st-ix'); await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, 'nastaveni-bez-indexu.png') });
  await page.keyboard.press('Escape'); await sleep(600);
  ok((await idbState()).settings.noIndex === true, 'uloženo noIndex: true');
  ok(!(await page.$('[data-act="nav"][data-v="index"]')) && !!(await page.$('[data-act="nav"][data-v="schedule"]')), 'v levém panelu je Rozvrh, Index ne');
  ok((await view()).kind === 'today', 'otevřený Index se přepnul na Dnes');
  await openPage();
  await page.click('.doc-tail'); await page.keyboard.type('/před'); await sleep(100);
  ok(!(await page.isVisible('#slash')) || !/Předmět/.test(await page.textContent('#slash')), 'lomítkové menu „Předmět“ nenabízí');
  await page.keyboard.press('Escape'); await page.keyboard.press(`${MOD}+a`); await page.keyboard.press('Backspace');
  ok((await heads()).filter((h) => h.startsWith('🎓')).length === 3, 'existující bloky předmětu zůstaly');
  await page.click('#blocks .b-subj >> nth=0 >> .sj-h'); await sleep(100);
  const pt = await page.textContent('.pop');
  ok(!/Otevřít v Indexu|Změnit předmět/.test(pt) && /Formát nadpisu/.test(pt), 'klik na nadpis předmětu: jen formát, bez Indexu');
  await page.keyboard.press('Escape');
  const h1 = await page.$('#blocks .b-h1');
  if (h1) { await h1.hover(); await (await h1.$('.g-drag')).click(); ok(!/Předmět…/.test(await page.textContent('.pop')), 'u H1 se „Převést na → Předmět…“ nenabízí'); await page.keyboard.press('Escape'); }
  await page.click('[data-act="nav"][data-v="schedule"]');
  await page.click('[data-act="ev-add"].btn');
  ok(!(await page.$('#ev-subj')) && await page.isVisible('#ev-title') && !/zakládají v Indexu/.test(await page.textContent('#evf')), 'nová hodina: jen vlastní název, bez výběru předmětu');
  await page.keyboard.press('Escape');
  await page.click('#sg .ev[data-id="e1"]');
  ok(/LMJ — Mechanika tekutin a hydraulika/.test(await page.textContent('#evf')) && await page.isHidden('#ev-ix'), 'hodina s předmětem: předmět jen jako informace');
  await page.click('#evf button[type=submit]'); await sleep(500);
  ok((await idbState()).events.e1.subj === 'sb', 'po uložení si hodina předmět ponechala');
  await page.click('[data-act="settings"]'); await page.check('#st-ix'); await page.keyboard.press('Escape'); await sleep(600);
  ok(!('noIndex' in (await idbState()).settings) && !!(await page.$('[data-act="nav"][data-v="index"]')), 'zapnutí: Index je zpátky, klíč z dat zmizel');

  // ---------- smazání školních dat ----------
  console.log('9) smazání školních dat');
  await sleep(400);
  const before = await idbState();
  await page.click('[data-act="settings"]');
  await page.click('#st-clear'); await sleep(100);
  const msg = (await page.textContent('.modal')).replace(/\s+/g, ' ');
  ok(/Smaže se 2 předměty, 2 semestry a 1 hodina v rozvrhu/.test(msg) && /3 bloky \/předmět se změní/.test(msg), 'potvrzení s počty: ' + msg.slice(0, 160));
  await page.screenshot({ path: path.join(SHOTS, 'smazat-skolni-data.png') });
  await page.click('#cs-yes'); await sleep(700);
  let st = await idbState();
  ok(!Object.keys(st.subjects || {}).length && !Object.keys(st.semesters || {}).length && !Object.keys(st.events).length, 'předměty, semestry a hodiny jsou pryč');
  bl = st.pages.pZ.blocks;
  ok(!bl.some((b) => b.type === 'subj') && bl.filter((b) => b.type === 'h1').map((b) => b.html).join(' | ') === 'LMJ — Mechanika tekutin a hydraulika | ELE — Elektroenergetika | LMJ — Mechanika tekutin a hydraulika', 'bloky předmětu jsou nadpisy H1: ' + bl.filter((b) => b.type === 'h1').map((b) => b.html).join(' | '));
  ok(bl.filter((b) => b.type === 'todo').length === before.pages.pZ.blocks.filter((b) => b.type === 'todo').length && st.settings.school === true, 'úkoly a nastavení zůstaly');
  ok(await page.evaluate(async () => (await window.Local.listBackups()).some((b) => /školních dat/.test(b.label))), 'místní záloha „Před smazáním školních dat“');
  await page.click('.toast button'); await sleep(600);
  st = await idbState();
  ok(Object.keys(st.subjects).length === 2 && Object.keys(st.events).length === 1 && st.pages.pZ.blocks.filter((b) => b.type === 'subj').length === 3, 'Vrátit: všechno je zpátky');

  // ---------- spojení verzí ----------
  console.log('10) spojení verzí („Ponechat obě“) s blokem předmětu');
  const merged = await page.evaluate(async () => {
    const { mergeData } = await import('./js/sync/merge.js');
    const pg = (extra) => ({ id: 'pM', title: 'M', parent: null, order: 1, props: [], blocks: [{ id: 'x1', type: 'subj', subj: 'sb', html: 'LMJ', until: 'x2' }, { id: 'x2', type: 'todo', html: 'a' }, { id: 'x3', type: 'p', html: extra }] });
    const B = { pages: { pM: pg('') }, events: {}, settings: {} }, L = { pages: { pM: pg('tady') }, events: {}, settings: {} }, R = { pages: { pM: pg('na Disku') }, events: {}, settings: {} };
    const r = mergeData(L, R, B); const ps = Object.values(r.data.pages);
    return { n: ps.length, copies: r.copies, ok: ps.every((p) => p.blocks[0].type === 'subj' && p.blocks[0].subj === 'sb' && p.blocks[0].until === p.blocks[1].id) };
  });
  ok(merged.n === 2 && merged.copies === 1 && merged.ok, 'obě verze stránky mají blok předmětu, „sbalovat až sem“ míří na vlastní blok kopie');

  // ---------- starší verze ----------
  console.log('11) starší verze (2.6) a blok předmětu');
  st = await idbState();
  await page.goto(OLD + 'manifest.webmanifest');
  await boot(OLD, 500);
  await page.click('.ti-main[data-id="pZ"]').catch(() => {}); await sleep(300);
  ok(/LMJ — Mechanika tekutin a hydraulika/.test(await page.textContent('#blocks')), 'stará verze ukáže blok aspoň jako text');
  await page.click('#blocks .blk[data-id="p0"] .txt'); await page.keyboard.press('End'); await page.keyboard.type('!'); await sleep(700);
  const old = await idbState();
  ok(old.pages.pZ.blocks.filter((b) => b.type === 'subj' && b.subj).length === 3, 'po uložení ve staré verzi bloky předmětu zůstaly');
  await boot(NEW);
  await openPage();
  ok((await heads()).filter((h) => h.startsWith('🎓')).length === 3, 'nová verze je zase ukáže jako předměty');

  console.log('12) mobil a tmavý motiv');
  await page.evaluate(() => localStorage.setItem('uk-theme', '"dark"'));
  await page.setViewportSize({ width: 390, height: 844 });
  await boot();
  await page.screenshot({ path: path.join(SHOTS, 'blok-predmetu-mobil.png'), fullPage: true });
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('#main').scrollWidth <= document.querySelector('#main').clientWidth), 'bez vodorovného posuvu');

  ok(errors.length === 0, 'žádné chyby' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} SELHALO` : '\nVŠE OK');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
