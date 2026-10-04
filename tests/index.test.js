/* Úkolníček – test: školní režim a Index (karty předmětů, body na kartě, ozubené kolečko, známky, kredity),
   rozvrh s předměty z Indexu, zámek, synchronizace a kompatibilita s daty ze staré verze.
   Spouští se přes `npm test` (tests/run.js), ten nastaví UK_BASE (a UK_OLD). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const MOCK = fs.readFileSync(path.join(__dirname, 'mockDrive.js'), 'utf8');
const SHOTS = path.join(__dirname, 'shots', path.basename(__filename, '.test.js')); fs.mkdirSync(SHOTS, { recursive: true });
const ORIGIN = process.env.UK_BASE || 'http://localhost:8000/';
const OLD = process.env.UK_OLD || ORIGIN, NEW = ORIGIN;  /* stará verze musí běžet na stejném původu (sdílí IndexedDB) */
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pages = {
  pZ: { id: 'pZ', title: 'Zimní semestr 2026', icon: '🎓', color: 'purple', parent: null, order: 1, props: [], blocks: [
    { id: 'h1a', type: 'h1', html: 'MPA-ZJR — Jaderné systémy' }, { id: 't1', type: 'todo', html: 'Přečíst kapitolu 3' },
    { id: 'h1b', type: 'h1', html: 'LMJ — Mechanika tekutin' }, { id: 't2', type: 'todo', html: 'Laborka' }] }
};
const events = { e1: { id: 'e1', title: 'ZJR', type: 'Přednáška', day: 0, start: '08:00', end: '09:50', repeat: 'weekly', color: 'purple', sec: 'pZ|h1a' } };

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
  const boot = async (url = NEW, ms = 700) => { await page.goto(url); await page.waitForSelector('#sync-box .cloud'); await sleep(ms); };
  const dirty = () => page.$eval('#sync-box .cloud', (c) => /dirty/.test(c.className));
  const navs = () => page.$$eval('.nav .nv span:first-of-type', (s) => s.map((x) => x.textContent));
  const view = () => page.evaluate(() => JSON.parse(localStorage.getItem('uk-view')).kind);
  const idbState = () => page.evaluate(async () => { const db = await window.Local.open(); return new Promise((res) => { const r = db.transaction('kv').objectStore('kv').get('state'); r.onsuccess = () => res(r.result); }); });
  const card = (code) => page.locator(`.ix-card:has(.ixc-nm b:text-is("${code}"))`);
  const cardText = async (code) => (await card(code).locator('.ixc-h').innerText()).replace(/\s+/g, ' ').trim();
  const tiles = async () => (await page.$$eval('.ix-tile b', (b) => b.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))).join(' | ');

  // ---------- kompatibilita: data uložená verzí 2.6 (Index zapnutý) ----------
  console.log('1) data uložená verzí 2.6 → nová verze');
  await page.goto(OLD + 'manifest.webmanifest');
  await page.evaluate(async ([pages, events]) => {
    localStorage.clear(); localStorage.setItem('mock-D', JSON.stringify({ files: [], data: {}, tok: 'ok' }));
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ukolnicek', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('images', { keyPath: 'id' }); d.createObjectStore('backups', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = rej; });
    await new Promise((res) => { const tx = db.transaction(['kv'], 'readwrite'); tx.objectStore('kv').put({ pages, events, settings: { semesterStart: '2026-09-21', index: true }, meta: {} }, 'state'); tx.oncomplete = res; });
    db.close();
  }, [pages, events]);
  await boot(OLD);
  await page.click('[data-act="sync-up"]'); await sleep(500);
  ok(!(await dirty()), 'stará verze: nahráno, bez tečky');
  await boot(NEW);
  ok(!(await dirty()), 'nová verze se stejnými daty: bez oranžové tečky (otisk se nezměnil)');
  ok((await page.evaluate(() => window.__D.calls.join())) === 'latest', 'nic se nestahuje');
  ok((await navs()).join(', ') === 'Dnes, Úkoly, Hledat', 'školní režim je ve výchozím stavu vypnutý i se starými daty: ' + (await navs()).join(', '));
  ok(!(await page.isVisible('.ws-week')) && !(await page.isVisible('.ws .linkbtn')), 'bez týdne výuky v levém panelu');
  ok(!(await page.$('.mc-d[data-act="mc-day"]')), 'dny v mini kalendáři neotvírají rozvrh');
  ok(!/v rozvrhu|Zítra/.test(await page.textContent('#view')) && /podle nadpisů/.test(await page.textContent('#view')), 'Dnes: bez rozvrhu, „Stav úkolů podle nadpisů“');
  await page.evaluate(() => { localStorage.setItem('uk-view', JSON.stringify({ kind: 'schedule' })); });
  await boot(NEW, 300);
  ok(await view() === 'today', 'uložený pohled Rozvrh se přesměruje na Dnes');
  let st = await idbState();
  ok(st.settings.index === true && st.events.e1 && st.events.e1.sec === 'pZ|h1a', 'data ze starší verze zůstala beze změny');

  // ---------- zapnutí ----------
  console.log('2) zapnutí školního režimu');
  await page.click('[data-act="settings"]');
  ok(await page.isHidden('#st-start'), 'nastavení rozvrhu je schované, dokud je režim vypnutý');
  await page.check('#st-school'); await sleep(100);
  ok(await page.isVisible('#st-start') && await page.isVisible('#st-hs'), 'po zapnutí se ukáže nastavení rozvrhu');
  await page.screenshot({ path: path.join(SHOTS, 'nastaveni-skolni-rezim.png') });
  await page.keyboard.press('Escape'); await sleep(500);
  ok((await navs()).slice(0, 4).join(', ') === 'Dnes, Index, Rozvrh, Úkoly', 'pořadí v menu: ' + (await navs()).join(', '));
  ok(await page.isVisible('.ws-week'), 'týden výuky v levém panelu');
  st = await idbState();
  ok(st.settings.school === true && !('index' in st.settings), 'v datech je settings.school, settings.index z 2.6 je pryč');
  await page.click('[data-act="nav"][data-v="index"]');
  ok(/Začni semestrem/.test(await page.textContent('#view')) && /První semestr/.test(await page.textContent('#view')), 'prázdný Index: nejdřív semestr');
  ok(!(await page.$('[data-act="subj-new"]')), 'bez semestru nejde přidat předmět');

  // ---------- předmět s body celkem ----------
  console.log('3) nový předmět, body celkem na kartě');
  await page.click('#view .empty [data-act="sem-new"]'); await sleep(100);
  ok(await page.$eval('#sm-name', (i) => i.value) === 'ZS 2026/27', 'název semestru se předvyplní: ZS 2026/27');
  await page.click('#smf button[type=submit]'); await sleep(200);
  ok(/První předmět/.test(await page.textContent('#view')) && await page.isVisible('.v-tools [data-act="subj-new"]'), 'se semestrem jde přidat předmět');
  await page.click('#view .v-tools [data-act="subj-new"]'); await sleep(100);
  ok(!(await page.$('#su-sec')) && !(await page.$('#su-pts')), 've formuláři není nadpis H1 ani body');
  ok(await page.$eval('#su-sem', (s) => [...s.options].map((o) => o.textContent).join()) === 'ZS 2026/27', 'v nabídce jsou jen založené semestry');
  /* záložní cesta: bez semestru se nejdřív otevře semestr a pak rovnou předmět */
  await page.keyboard.press('Escape');
  await page.evaluate(async () => { const { openSubjectModal } = await import('./js/views/subjects.js'); const { S } = await import('./js/state.js'); window.__sems = S.semesters; S.semesters = {}; openSubjectModal(null); });
  ok(await page.isVisible('#smf') && /Nejdřív založ semestr/.test(await page.textContent('.modal')), 'bez semestru se místo předmětu otevře semestr');
  await page.evaluate(async () => { const { S } = await import('./js/state.js'); S.semesters = window.__sems; });
  await page.keyboard.press('Escape');
  await page.click('#view .v-tools [data-act="subj-new"]'); await sleep(100);
  await page.fill('#su-code', 'MPA-ZJR'); await page.fill('#su-name', 'Jaderné systémy'); await page.fill('#su-cr', '4');
  await page.screenshot({ path: path.join(SHOTS, 'kolecko-novy.png') });
  await page.click('#suf button[type=submit]'); await sleep(300);
  ok(/V rozvrhu je 1 hodina s názvem „ZJR“/.test(await page.textContent('.toast')), 'nabídka propojení hodiny „ZJR“: ' + await page.textContent('.toast'));
  ok(await card('MPA-ZJR').count() === 1, 'karta předmětu');
  ok(await card('MPA-ZJR').evaluate((c) => c.classList.contains('flash')), 'nová karta je zvýrazněná');
  const total = card('MPA-ZJR').locator('.ixc-in');
  ok(await total.count() === 1 && /Body celkem/.test(await card('MPA-ZJR').locator('.ixc-pts').innerText()), 'bez dílčích hodnocení je na kartě pole „Body celkem“');
  await total.click(); await page.keyboard.type('78');
  ok(/78 b C/.test(await cardText('MPA-ZJR')), 'živě při psaní: ' + await cardText('MPA-ZJR'));
  ok(await page.evaluate(() => document.activeElement.classList.contains('ixc-in') && document.activeElement.value === '78'), 'kurzor zůstal v poli');
  ok(/dobře · 2/.test(await card('MPA-ZJR').locator('.ixc-meta').innerText()), 'číselná známka bokem: ' + await card('MPA-ZJR').locator('.ixc-meta').innerText());
  ok(/^4 \| 1 \/ 1 \| 2$/.test(await tiles()), 'souhrn se přepočítal: ' + await tiles());
  await page.keyboard.type('x'); await sleep(50);
  ok(await total.evaluate((i) => i.classList.contains('bad')), 'neplatné číslo: červený rámeček');
  await page.keyboard.press('Tab'); await sleep(100);
  ok(await total.inputValue() === '78' && /číslo/.test(await page.textContent('.toast')), 'po opuštění pole se vrátí poslední platná hodnota');
  await sleep(500);
  st = await idbState();
  ok(Object.values(st.subjects)[0].pts === '78', 'body uložené v datech: ' + Object.values(st.subjects)[0].pts);

  // ---------- dílčí hodnocení ----------
  console.log('4) dílčí hodnocení přes kolečko, body na kartě, F, bonus');
  await page.click('#view .v-tools [data-act="subj-new"]'); await sleep(100);
  await page.fill('#su-code', 'LMJ'); await page.fill('#su-name', 'Mechanika tekutin'); await page.fill('#su-cr', '5');
  await page.click('#su-addpart'); await page.fill('.su-pdef:nth-child(1) .pn', 'Cvičení'); await page.fill('.su-pdef:nth-child(1) .pm', '30');
  await page.click('#su-addpart'); await page.fill('.su-pdef:nth-child(2) .pn', 'Zkouška'); await page.fill('.su-pdef:nth-child(2) .pm', '70');
  ok(/celkem max 100 b/.test(await page.textContent('#su-sum')), 'součet maxim: ' + await page.textContent('#su-sum'));
  ok(!(await page.$('.su-pdef .pp')), 'v okně se body nezadávají');
  await page.screenshot({ path: path.join(SHOTS, 'kolecko-dilci.png') });
  await page.click('#suf button[type=submit]'); await sleep(300);
  const lmj = card('LMJ');
  ok(await lmj.locator('.ixc-in').count() === 2, 'obě dílčí hodnocení jsou na kartě');
  await lmj.locator('.ixc-in').nth(0).fill('20'); await lmj.locator('.ixc-in').nth(1).fill('25'); await sleep(50);
  ok(/45 \/ 100 b F/.test(await cardText('LMJ')), 'součet 45/100 → F: ' + await cardText('LMJ'));
  ok(/^4 \|/.test(await tiles()) && /ze 9 zapsaných/.test(await page.textContent('.ix-sum')), 'F se do kreditů nepočítá');
  await lmj.locator('.ixc-in').nth(1).fill('40,5'); await sleep(50);
  ok(/60,5 \/ 100 b D/.test(await cardText('LMJ')), 'desetinná čárka, 60,5 → D: ' + await cardText('LMJ'));
  ok(/^9 \| 2 \/ 2 \| 2,28$/.test(await tiles()), 'souhrn 9 kr., vážený průměr 2,28: ' + await tiles());
  ok(/9 \/ 30 kr/.test(await page.textContent('.ix-sem .ix-prog')), 'semestr 9 / 30 kr.: ' + await page.textContent('.ix-sem .ix-prog'));
  await lmj.locator('.ixc-in').nth(0).fill('33'); await sleep(50);
  ok(await lmj.locator('.ixc-part').nth(0).evaluate((p) => p.classList.contains('bonus')), 'body nad maximum: zvýrazněné jako bonus');
  ok(/73,5 \/ 100 b C/.test(await cardText('LMJ')), 'bonus se započítá do součtu: ' + await cardText('LMJ'));
  await page.screenshot({ path: path.join(SHOTS, 'index-karty.png'), fullPage: true });
  /* kolečko: přejmenování dílčího hodnocení body nesmaže */
  await lmj.locator('.ixc-gear').click(); await sleep(100);
  ok(/33 b/.test(await page.textContent('.su-pdef:nth-child(1) .pz')), 'v okně je u dílčího hodnocení vidět zapsané body');
  await page.fill('.su-pdef:nth-child(1) .pn', 'Cvičení a protokoly'); await page.click('#suf button[type=submit]'); await sleep(200);
  ok(/Cvičení a protokoly/.test(await lmj.innerText()) && await lmj.locator('.ixc-in').nth(0).inputValue() === '33', 'přejmenováno, body zůstaly');

  console.log('5) zápočet a druhý semestr');
  await page.click('[data-act="sem-new"]'); await sleep(100); await page.fill('#sm-name', 'LS 2026/27'); await page.fill('#sm-t', '32'); await page.click('#smf button[type=submit]'); await sleep(100);
  await page.click('#view .v-tools [data-act="subj-new"]'); await sleep(100);
  await page.fill('#su-code', 'SEM'); await page.fill('#su-name', 'Seminář'); await page.fill('#su-cr', '2');
  await page.selectOption('#su-end', 'z');
  await page.click('#suf button[type=submit]'); await sleep(200);
  const semHeads = await page.$$eval('.ix-sem-h h2', (h) => h.map((x) => x.textContent));
  ok(semHeads.join(' | ') === 'LS 2026/27 | ZS 2026/27', 'novější semestr nahoře: ' + semHeads.join(' | '));
  ok(await card('SEM').locator('.ixc-passed').isVisible(), 'u zápočtu je na kartě „Zápočet udělen“');
  await card('SEM').locator('.ixc-passed').check(); await sleep(50);
  ok(/✓/.test(await cardText('SEM')) && /2 \/ 32 kr/.test(await page.textContent('.ix-sem:first-of-type .ix-prog')), 'zápočet připočítal 2 kr. do LS');

  console.log('5b) zobrazení semestrů: souhrn a seznam');
  const tilesBefore = await tiles();
  await page.click('.v-tools [data-act="ix-view"]'); await sleep(100);
  ok((await page.$$eval('.ixv-r .ixv-n b', (b) => b.map((x) => x.textContent))).join(' | ') === 'LS 2026/27 | ZS 2026/27', 'okno se seznamem semestrů');
  await page.screenshot({ path: path.join(SHOTS, 'zobrazeni-semestru.png') });
  await page.uncheck('.ixv-r:has-text("ZS 2026/27") input[data-k="hidden"]'); await sleep(100);
  await page.uncheck('.ixv-r:has-text("ZS 2026/27") input[data-k="noStats"]'); await sleep(100);
  await page.click('.modal [data-close]'); await sleep(200);
  ok((await page.$$eval('.ix-sem-h h2', (h) => h.map((x) => x.textContent))).join() === 'LS 2026/27', 'ZS zmizel ze seznamu');
  ok(/1 semestr je skrytý/.test(await page.textContent('.ix-hidnote')), 'poznámka o skrytém semestru');
  ok(/^2 \| 1 \/ 1 \| –$/.test(await tiles()) && /Souhrn bez ZS 2026\/27/.test(await page.textContent('#view')), 'souhrn jen z LS: ' + await tiles());
  await sleep(500); let stv = await idbState();
  ok(Object.values(stv.semesters).find((x) => x.name === 'ZS 2026/27').hidden === true, 'uloženo v datech');
  await page.click('.ix-hidnote [data-act="ix-view"]'); await sleep(100);
  await page.check('.ixv-r:has-text("ZS 2026/27") input[data-k="hidden"]'); await page.check('.ixv-r:has-text("ZS 2026/27") input[data-k="noStats"]'); await sleep(100);
  await page.click('.modal [data-close]'); await sleep(200);
  ok(await tiles() === tilesBefore && (await page.$$('.ix-sem')).length === 2, 'zase všechno zpátky');

  // ---------- rozvrh ----------
  console.log('6) předmět v rozvrhu: název a barva z Indexu');
  await page.click('[data-act="nav"][data-v="schedule"]');
  ok(await page.$eval('#sg .ev[data-id="e1"] .ev-t', (e) => e.textContent) === 'ZJR', 'stará hodina bez předmětu má svůj název');
  await page.click('[data-act="ev-add"].btn');
  ok(await page.isVisible('#ev-subj') && !(await page.$('#ev-sec')), 've formuláři je „Předmět“, výběr nadpisu H1 zmizel');
  const opts = await page.$$eval('#ev-subj optgroup', (g) => g.map((x) => x.label + ': ' + [...x.children].map((o) => o.textContent).join(', ')));
  ok(opts.join(' | ') === 'LS 2026/27: SEM — Seminář | ZS 2026/27: LMJ — Mechanika tekutin, MPA-ZJR — Jaderné systémy', opts.join(' | '));
  const lmjId = await page.$eval('#ev-subj', (s) => [...s.options].find((o) => /LMJ/.test(o.textContent)).value);
  await page.selectOption('#ev-subj', lmjId);
  ok(await page.isHidden('#f-title'), 's předmětem se pole „Co“ schová');
  ok(await page.isVisible('.sw-auto.on'), 'barva „Podle předmětu“');
  ok(await page.isVisible('#ev-ix'), 'tlačítko Otevřít v Indexu');
  await page.selectOption('#ev-day', '2');
  await page.screenshot({ path: path.join(SHOTS, 'rozvrh-formular.png') });
  await page.click('#evf button[type=submit]'); await sleep(600);
  st = await idbState();
  const ev2 = Object.values(st.events).find((e) => e.subj === lmjId);
  ok(ev2 && ev2.color === '' && ev2.title === 'LMJ' && !('sec' in ev2), 'uloženo: předmět, barva podle předmětu, název jako kopie');
  ok(await page.$eval(`#sg .ev[data-id="${ev2.id}"]`, (e) => /hl-blue|hl-purple/.test(e.className) && e.querySelector('.ev-t').textContent === 'LMJ'), 'hodina ukazuje název z Indexu');
  /* bez předmětu: volný název */
  await page.click('[data-act="ev-add"].btn');
  ok(await page.$eval('#ev-subj', (s) => s.value) === '' && await page.isVisible('#ev-title'), 'nová hodina bez předmětu: pole „Co“');
  ok(await page.isHidden('.sw-auto'), 'bez předmětu se „Podle předmětu“ nenabízí');
  await page.fill('#ev-title', 'Konzultace'); await page.selectOption('#ev-day', '3'); await page.click('#evf button[type=submit]'); await sleep(400);
  ok(await page.$$eval('#sg .ev-t', (t) => t.some((x) => x.textContent === 'Konzultace')), 'hodina s volným názvem');
  /* přejmenování a přebarvení předmětu se projeví v rozvrhu */
  await page.click('[data-act="nav"][data-v="index"]');
  await card('LMJ').locator('.ixc-gear').click(); await sleep(100);
  await page.fill('#su-code', 'MPA-LMJ'); await page.click('#su-color [data-c="orange"]'); await page.click('#suf button[type=submit]'); await sleep(200);
  await page.click('[data-act="nav"][data-v="schedule"]');
  ok(await page.$eval(`#sg .ev[data-id="${ev2.id}"]`, (e) => e.classList.contains('hl-orange') && e.querySelector('.ev-t').textContent === 'MPA-LMJ'), 'rozvrh: nový název i barva z Indexu');
  /* vlastní barva má přednost */
  await page.click(`#sg .ev[data-id="${ev2.id}"]`);
  await page.click('#ev-color [data-c="green"]'); await page.click('#evf button[type=submit]'); await sleep(300);
  await page.click('[data-act="nav"][data-v="index"]');
  await card('MPA-LMJ').locator('.ixc-gear').click(); await sleep(100); await page.click('#su-color [data-c="red"]'); await page.click('#suf button[type=submit]'); await sleep(200);
  await page.click('[data-act="nav"][data-v="schedule"]');
  ok(await page.$eval(`#sg .ev[data-id="${ev2.id}"]`, (e) => e.classList.contains('hl-green')), 'hodina s vlastní barvou (zelená) zůstane zelená i po přebarvení předmětu');
  await page.hover(`#sg .ev[data-id="${ev2.id}"]`); await sleep(500);
  ok(/MPA-LMJ — Mechanika tekutin/.test(await page.textContent('.evtip')), 'bublina ukáže celý název předmětu: ' + await page.textContent('.evtip'));
  await page.click(`#sg .ev[data-id="${ev2.id}"]`);
  await page.click('#ev-ix'); await sleep(300);
  ok(await view() === 'index', 'přesměrováno do Indexu');
  ok(await card('MPA-LMJ').evaluate((c) => c.classList.contains('flash')), 'karta předmětu je zvýrazněná');
  ok(/1 hodina v rozvrhu/.test(await card('MPA-LMJ').innerText()), 'na kartě je odkaz na hodinu v rozvrhu');
  await card('MPA-LMJ').locator('[data-act="ix-evs"]').click();
  ok(/Cvičení|Přednáška/.test(await page.textContent('.pop')), 'seznam hodin: ' + (await page.textContent('.pop')).replace(/\s+/g, ' '));
  await page.click('.pop .pop-item'); await sleep(300);
  ok(await view() === 'schedule' && await page.isVisible('#evf'), 'klik na hodinu otevře rozvrh a její úpravu');
  await page.keyboard.press('Escape');

  // ---------- nabídka propojení ----------
  console.log('7) propojení hodin z rozvrhu s předmětem');
  await page.click('[data-act="nav"][data-v="index"]');
  ok(/Propojit 1 hodinu z rozvrhu/.test(await card('MPA-ZJR').innerText()), 'karta nabízí propojení hodiny „ZJR“ (MPA-ZJR)');
  await card('MPA-ZJR').locator('[data-act="ix-link"]').click(); await sleep(200);
  ok(/Propojeno/.test(await page.textContent('.toast')) && !/Propojit/.test(await card('MPA-ZJR').innerText()), 'propojeno, nabídka zmizela');
  await sleep(400); st = await idbState();
  ok(st.events.e1.subj && st.events.e1.color === '' && st.events.e1.title === 'ZJR', 'hodina má předmět a barvu podle předmětu, původní název zůstal jako záloha');
  await page.click('.toast button'); await sleep(400); st = await idbState();
  ok(!st.events.e1.subj && st.events.e1.color === 'purple', 'Vrátit: propojení zrušeno');

  // ---------- zámek ----------
  console.log('8) zámek v rozvrhu a v Indexu');
  await page.click('[data-act="nav"][data-v="schedule"]');
  await page.click('.v-tools .lock-btn'); await sleep(100);
  ok(await page.evaluate(() => document.body.classList.contains('locked')), 'zamčeno');
  const col = page.locator('#sg .sg-col').nth(1);
  const box = await col.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 500);
  ok(await page.$$eval('#sg .ghost', (g) => g.every((x) => x.hidden)), 'přejetí: žádný náhled nové hodiny');
  await page.mouse.click(box.x + box.width / 2, box.y + 500); await sleep(150);
  ok(!(await page.isVisible('.modal')), 'klik do prázdna nic nevytvoří');
  await page.click(`#sg .ev[data-id="${ev2.id}"]`); await sleep(100);
  ok(!(await page.isVisible('.modal')) && /Otevřít v Indexu/.test(await page.textContent('.pop')) && /Zamčeno/.test(await page.textContent('.pop')), 'zamčeno: hodina se neotevře k úpravě, nabídne skok do Indexu');
  await page.screenshot({ path: path.join(SHOTS, 'rozvrh-zamceno.png') });
  await page.click('.pop [data-v="ix"]'); await sleep(300);
  ok(await view() === 'index' && await card('MPA-LMJ').evaluate((c) => c.classList.contains('flash')), 'skok na kartu předmětu');
  ok(!(await page.$('#view .lock-btn')) && !/Body zapisuješ|vložíš přes/.test(await page.textContent('#view')), 'Index je bez zámku a bez vysvětlujících vět');
  await card('MPA-LMJ').locator('.ixc-in').nth(0).fill('30'); await sleep(50);
  ok(/70,5/.test(await cardText('MPA-LMJ')), 'zamčeno: body jde dál zapisovat');
  await card('MPA-LMJ').locator('.ixc-gear').click(); await sleep(100);
  ok(!(await page.isVisible('#su-del')) && !(await page.locator('.su-pdef [data-rm]').first().isVisible()), 'zamčeno: v okně nejde smazat předmět ani dílčí hodnocení');
  await page.keyboard.press('Escape');
  await page.click('[data-act="nav"][data-v="schedule"]'); await page.click('.v-tools .lock-btn'); await page.click('[data-act="nav"][data-v="index"]');

  // ---------- data a synchronizace ----------
  console.log('9) data a synchronizace');
  await sleep(500);
  st = await idbState();
  ok(Object.keys(st.subjects || {}).length === 3 && Object.keys(st.semesters || {}).length === 2, 'předměty a semestry jsou v datech');
  ok(await dirty(), 'změny čekají na nahrání');
  await page.click('[data-act="sync-up"]'); await sleep(500);
  ok(!(await dirty()), 'nahráno');
  const up = await page.evaluate(() => { const D = window.__D; const f = [...D.files].sort((a, b) => b.createdTime.localeCompare(a.createdTime))[0]; return D.data[f.id]; });
  ok(up.subjects && up.semesters && up.settings.school === true, 'záloha na Disku obsahuje Index a školní režim');
  // jiné zařízení změní body
  await page.evaluate(() => { const D = window.__D; const last = [...D.files].sort((a, b) => b.createdTime.localeCompare(a.createdTime))[0]; const d = JSON.parse(JSON.stringify(D.data[last.id])); const su = Object.values(d.subjects).find((s) => s.code === 'MPA-ZJR'); su.pts = '93'; d.device = 'iPhone'; const id = 'o1'; D.files.push({ id, name: 'ukolnicek_o1.json', createdTime: new Date(Date.parse(last.createdTime) + 60000).toISOString() }); D.data[id] = d; window.__saveD(); });
  await boot(NEW, 900);
  ok(/93 b A/.test(await cardText('MPA-ZJR')), 'automatické stažení přeneslo body z iPhonu (A)');
  ok(!(await dirty()), 'bez tečky po stažení');

  console.log('10) vypnutí školního režimu nic nesmaže');
  await page.click('[data-act="settings"]'); await page.uncheck('#st-school'); await page.keyboard.press('Escape'); await sleep(500);
  ok((await navs()).join(', ') === 'Dnes, Úkoly, Hledat', 'Index a Rozvrh zmizely z menu');
  ok(await view() === 'today', 'pohled přepnut na Dnes');
  st = await idbState();
  ok(Object.keys(st.subjects).length === 3 && Object.keys(st.events).length === 3 && !('school' in st.settings), 'předměty a hodiny zůstaly v datech, školní režim je z dat pryč');
  await page.click('[data-act="settings"]'); await page.check('#st-school'); await page.keyboard.press('Escape'); await sleep(300);

  console.log('11) mobil a tmavý motiv');
  await page.evaluate(() => localStorage.setItem('uk-theme', '"dark"'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => localStorage.setItem('uk-view', JSON.stringify({ kind: 'index' })));
  await boot(NEW);
  await page.screenshot({ path: path.join(SHOTS, 'index-mobil.png'), fullPage: true });
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('#main').scrollWidth <= document.querySelector('#main').clientWidth), 'bez vodorovného posuvu');
  await card('MPA-LMJ').locator('.ixc-gear').click(); await sleep(100);
  await page.screenshot({ path: path.join(SHOTS, 'kolecko-mobil.png') });
  await page.keyboard.press('Escape');

  ok(errors.length === 0, 'žádné chyby' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} SELHALO` : '\nVŠE OK');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
