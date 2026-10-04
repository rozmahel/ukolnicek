/* Úkolníček – test: Přehled Úkoly: termíny, projekty, nadpisy H1, skrývání projektů.
   Spouští se přes `npm test` (tests/run.js), ten nastaví UK_BASE (a UK_OLD). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const MOCK = fs.readFileSync(path.join(__dirname, 'mockDrive.js'), 'utf8');
const SHOTS = path.join(__dirname, 'shots', path.basename(__filename, '.test.js')); fs.mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.UK_BASE || 'http://localhost:8000/';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0; const id = () => 'b' + (++n);
const p = (t) => ({ id: id(), type: 'p', html: t });
const h1 = (t) => ({ id: id(), type: 'h1', html: t });
const todo = (t, done) => ({ id: id(), type: 'todo', html: t, done: !!done });
const table = (lines) => ({ id: id(), type: 'table', rows: [{ cells: [{ lines: [{ t: 'p', html: 'Úkol' }] }, { lines: [{ t: 'p', html: 'Stav' }] }] }, { cells: [{ lines: lines.map((x) => ({ t: 'todo', html: x })) }, { lines: [{ t: 'p', html: '' }] }] }] });
const pages = {
  pL: { id: 'pL', title: 'Letní semestr 2026', icon: '🌞', color: 'yellow', parent: null, order: 0, props: [], blocks: [h1('MPC-ELE — Elektroenergetika'), todo('Odevzdat zápočet 1.10.'), todo('Vrátit skripta')] },
  pZ: { id: 'pZ', title: 'Zimní semestr 2026', icon: '🎓', color: 'purple', parent: null, order: 1, props: [], blocks: [
    todo('Zapsat se na zkoušky'), p('poznámka'),
    h1('MPA-ZJR — Základy jaderných reaktorů'), todo('Protokol z laborky 10.10.'), todo('Přečíst kapitolu 3'), todo('Spočítat příklady k cvičení', true),
    h1('LMJ — Laboratorní měření'), todo('Připravit se na měření'), table(['Vypracovat graf 7.10.', 'Poslat data kolegovi'])] },
  pD: { id: 'pD', title: 'Diplomka', icon: '📝', color: 'blue', parent: 'pZ', order: 1, props: [], blocks: [todo('Domluvit téma s vedoucím'), h1('Rešerše'), todo('Najít 5 článků o MSR'), todo('Shrnout NAA metody 3.10.')] },
  pO: { id: 'pO', title: 'Osobní', icon: '', color: 'green', parent: null, order: 2, props: [], blocks: [todo('Zaplatit nájem 5.10.'), todo('Koupit dárek'), todo('Vrátit knihu', true)] },
  pC: { id: 'pC', title: 'Chata', icon: '🌲', color: 'orange', parent: null, order: 3, props: [], blocks: [todo('Objednat řemeslníka')] },
  pE: { id: 'pE', title: 'Prázdný projekt', icon: '', color: 'gray', parent: null, order: 4, props: [], blocks: [p('nic')] }
};

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
  await page.clock.install({ time: new Date('2026-10-02T10:00:00') });
  await page.goto(BASE + 'manifest.webmanifest');
  await page.evaluate(async (pages) => {
    localStorage.clear(); localStorage.setItem('mock-D', JSON.stringify({ files: [], data: {}, tok: 'off' }));
    localStorage.setItem('uk-view', JSON.stringify({ kind: 'tasks' }));
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ukolnicek', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('images', { keyPath: 'id' }); d.createObjectStore('backups', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = rej; });
    await new Promise((res) => { const tx = db.transaction(['kv'], 'readwrite'); tx.objectStore('kv').put({ pages, events: {}, settings: { semesterStart: '2026-09-21' }, meta: {} }, 'state'); tx.oncomplete = res; });
    db.close();
  }, pages);
  const boot = async () => { await page.goto(BASE); await page.waitForSelector('.v-title'); await page.clock.runFor(300); };
  await boot();

  const dated = () => page.$$eval('.t-sec .task', (rs) => rs.map((r) => r.querySelector('.task-t').textContent + ' | ' + r.querySelector('.task-pg').textContent.trim()));
  const projs = () => page.$$eval('.t-proj', (ss) => ss.map((s) => ({ t: s.querySelector('.t-proj-t').textContent.trim(), n: s.querySelector('.t-proj-n').textContent, rows: [...s.querySelectorAll('.card > *')].map((e) => e.classList.contains('t-grp') ? '## ' + e.textContent.trim().replace(/\s+/g, ' ') : e.querySelector('.task-t').textContent) })));
  const badge = () => page.$eval('[data-act="nav"][data-v="tasks"] .badge', (b) => b.textContent).catch(() => '');

  console.log('1) S termínem: mix projektů, nejbližší nahoře');
  const d1 = await dated();
  ok(d1.map((x) => x.split(' | ')[0]).join(' / ') === 'Odevzdat zápočet 1.10. / Shrnout NAA metody 3.10. / Zaplatit nájem 5.10. / Vypracovat graf 7.10. / Protokol z laborky 10.10.', d1.map((x) => x.split(' | ')[0]).join(' / '));
  ok(/Zimní semestr 2026 › Diplomka › Rešerše/.test(d1[1]), 'cesta u podstránky: ' + d1[1]);
  console.log('2) Projekty v pořadí panelu, uvnitř podle stránek a H1');
  const P = await projs();
  ok(P.map((x) => x.t).join(' / ') === '🌞Letní semestr 2026 / 🎓Zimní semestr 2026 / Osobní / 🌲Chata', P.map((x) => x.t).join(' / '));
  const z = P[1];
  ok(z.rows.join(' / ') === 'Zapsat se na zkoušky / ## MPA-ZJR — Základy jaderných reaktorů / Přečíst kapitolu 3 / ## LMJ — Laboratorní měření / Připravit se na měření / Poslat data kolegovi / ## Diplomka / Domluvit téma s vedoucím / ## RešeršeDiplomka / Najít 5 článků o MSR', z.rows.join(' / '));
  ok(z.n === '6', 'počet v hlavičce projektu: ' + z.n);
  ok(!P.some((x) => /Prázdný/.test(x.t)), 'projekt bez úkolů se neukazuje');
  ok(await badge() === '14', 'odznak v levém panelu: ' + await badge());
  await page.screenshot({ path: path.join(SHOTS, 'ukoly-svetly.png'), fullPage: true });

  console.log('3) Skrytí projektu tlačítkem u projektu');
  await page.locator('.t-proj').first().locator('.t-hide').click();
  await page.clock.runFor(100);
  const P2 = await projs();
  ok(!P2.some((x) => /Letní/.test(x.t)), 'Letní semestr zmizel');
  ok(!(await dated()).some((x) => /zápočet/.test(x)), 'i jeho úkol s termínem zmizel');
  ok(await badge() === '12', 'odznak bez skrytých: ' + await badge());
  ok(/1 skrytý/.test(await page.textContent('.t-projbtn')), 'tlačítko: ' + (await page.textContent('.t-projbtn')).trim());
  ok(/Skryté projekty: Letní semestr 2026/.test(await page.textContent('.t-hidnote')), 'poznámka dole');
  ok(/skrytý/.test(await page.textContent('.toast')), 'toast s Vrátit');
  ok(/Nesplněné · 12/.test(await page.textContent('.filters')), 'počty bez skrytých');
  await page.clock.runFor(600); await sleep(200);
  await boot();
  ok(!(await projs()).some((x) => /Letní/.test(x.t)), 'skrytí přežije obnovení stránky');
  ok(await page.$eval('#sync-box .cloud', (c) => c.className).then((c) => /dirty/.test(c)), 'skrytí je změna dat (jde na Disk)');

  console.log('4) Výběr projektů v menu Projekty');
  await page.click('.t-projbtn'); await page.clock.runFor(50);
  const items = await page.$$eval('.pop .t-pi', (b) => b.map((x) => (x.classList.contains('on') ? '☑ ' : '☐ ') + x.querySelector('.nm').textContent + ' ' + x.querySelector('.n').textContent));
  ok(items.join(' / ') === '☐ Letní semestr 2026 2 / ☑ Zimní semestr 2026 9 / ☑ Osobní 2 / ☑ Chata 1', items.join(' / '));
  await page.screenshot({ path: path.join(SHOTS, 'ukoly-menu.png') });
  await page.click('.pop .t-pi[data-v="pO"]'); await page.clock.runFor(50);
  ok(await page.isVisible('.pop'), 'menu zůstane otevřené');
  ok(!(await projs()).some((x) => /Osobní/.test(x.t)), 'Osobní skryté');
  await page.click('.pop .t-pi[data-v="pL"]'); await page.clock.runFor(50);
  ok((await projs())[0].t.includes('Letní'), 'Letní zpět na svém místě');
  await page.click('.pop [data-v="*all"]'); await page.clock.runFor(50);
  ok((await projs()).length === 4 && !(await page.$('.t-hidnote')), 'Zobrazit všechny');

  console.log('5) Filtr Vše + odškrtnutí');
  await page.click('[data-act="tfilter"][data-v="all"]');
  const zAll = (await projs())[1];
  ok(zAll.rows.includes('Spočítat příklady k cvičení'), 'hotové jsou ve Vše');
  await page.click('[data-act="tfilter"][data-v="open"]');
  const before = (await dated()).length;
  await page.click('.t-sec .task:first-child [data-act="task-check"]'); await page.clock.runFor(400);
  ok((await dated()).length === before - 1, 'odškrtnutý úkol zmizí z nesplněných');

  console.log('6) Prokliky');
  await page.click('.t-grp-t:has-text("LMJ")'); await page.clock.runFor(200);
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('uk-view')).pageId) === 'pZ', 'klik na H1 otevře stránku');
  await page.click('[data-act="nav"][data-v="tasks"]');

  console.log('7) Všechno skryté');
  for (const r of ['pL', 'pZ', 'pO', 'pC']) { await page.evaluate(() => {}); }
  await page.click('.t-projbtn');
  for (const r of ['pL', 'pZ', 'pO', 'pC']) { await page.click(`.pop .t-pi[data-v="${r}"]`); await page.clock.runFor(30); }
  ok(/Všechny projekty s úkoly jsou tady skryté/.test(await page.textContent('#view')), 'prázdný stav s tlačítkem');
  await page.keyboard.press('Escape');
  await page.click('#view [data-act="t-showall"]'); await page.clock.runFor(50);
  ok((await projs()).length === 4, 'zobrazeno');

  console.log('8) Tmavý motiv a mobil');
  await page.evaluate(() => localStorage.setItem('uk-theme', '"dark"'));
  await page.setViewportSize({ width: 390, height: 844 });
  await boot();
  await page.locator('.t-proj').nth(2).locator('.t-hide').click();
  await page.clock.runFor(100);
  await page.screenshot({ path: path.join(SHOTS, 'ukoly-tmavy-mobil.png'), fullPage: true });
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('#main').scrollWidth <= document.querySelector('#main').clientWidth), 'bez vodorovného posuvu');

  ok(errors.length === 0, 'žádné chyby' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} SELHALO` : '\nVŠE OK');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
