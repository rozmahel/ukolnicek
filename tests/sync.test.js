/* Úkolníček – test: Synchronizace s Diskem: kontrola po otevření, tiché stažení, kolize, vypršelý token, offline.
   Spouští se přes `npm test` (tests/run.js), ten nastaví UK_BASE (a UK_OLD). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = '/home/claude/uk';
const MOCK = fs.readFileSync(path.join(__dirname, 'mockDrive.js'), 'utf8');
const SHOTS = path.join(__dirname, 'shots', path.basename(__filename, '.test.js')); fs.mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.UK_BASE || 'http://localhost:8000/';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const seedPages = () => ({
  pA: { id: 'pA', title: 'Poznámky ZJR', icon: '☢️', color: 'purple', parent: null, order: 1, props: [], blocks: [{ id: 'a1', type: 'p', html: 'Původní text A' }] },
  pB: { id: 'pB', title: 'LMJ', icon: '⚛️', color: 'blue', parent: null, order: 2, props: [], blocks: [{ id: 'b1', type: 'p', html: 'Původní text B' }] }
});

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await ctx.addInitScript(() => {
    const off = () => localStorage.getItem('test-offline') === '1';
    Object.defineProperty(Navigator.prototype, 'onLine', { get: off ? () => !off() : () => true, configurable: true });
  });
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
  page.on('console', (m) => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });

  const D = () => page.evaluate(() => ({ calls: window.__D.calls.slice(), files: window.__D.files.length, tok: window.__D.tok }));
  const setD = (fn, arg) => page.evaluate(([f, a]) => { (new Function('D', 'a', f))(window.__D, a); window.__saveD(); }, [fn, arg]);
  const idb = (fn) => page.evaluate(async (f) => {
    const db = await window.Local.open();
    const get = (k) => new Promise((res) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); });
    return (new Function('get', 'Local', 'return (async()=>{' + f + '})()'))(get, window.Local);
  }, fn);
  const boot = async (settle = 700) => {
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForSelector('#sync-box .cloud');
    await sleep(settle);
  };
  const toastText = () => page.evaluate(() => { const t = document.querySelector('.toast'); return t ? t.textContent : ''; });
  const cloudCls = () => page.evaluate(() => document.querySelector('#sync-box .cloud').className);
  const sideTitles = () => page.evaluate(() => [...document.querySelectorAll('.ti-main .ti-t')].map((e) => e.textContent));
  /* jiné zařízení nahraje upravenou verzi */
  const otherDevice = (mod) => setD(`
    const last=[...D.files].sort((x,y)=>y.createdTime.localeCompare(x.createdTime))[0];
    const d=JSON.parse(JSON.stringify(D.data[last.id])); (new Function('d',a))(d); d.device='iPhone';
    const id='o'+Date.now().toString(36); const t=new Date(Date.parse(last.createdTime)+60000).toISOString();
    D.files.push({id,name:'ukolnicek_'+id+'.json',createdTime:t,size:100}); D.data[id]=d;`, mod);
  const rawSeed = async (state) => {   /* zápis mimo běžící aplikaci (stránka se stejným původem, bez app.js) */
    await page.goto(BASE + 'manifest.webmanifest');
    await page.evaluate(async (st) => {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('ukolnicek', 1); r.onsuccess = () => res(r.result); r.onerror = rej; });
      await new Promise((res) => { const tx = db.transaction(['kv'], 'readwrite'); const o = tx.objectStore('kv'); o.clear(); if (st) o.put(st, 'state'); tx.oncomplete = res; });
      db.close();
    }, state);
  };
  const typeInBlock = async (pageId, blockId, text) => {
    await page.click(`[data-act="open"][data-id="${pageId}"]`);
    await page.click(`#blocks .blk[data-id="${blockId}"] .txt`);
    await page.keyboard.press('End');
    await page.keyboard.type(text);
    await sleep(500);
  };

  // ---------- příprava: data v zařízení, nahrání na Disk ----------
  await page.goto(BASE);
  await page.evaluate(async (pages) => {
    localStorage.clear(); localStorage.setItem('mock-D', JSON.stringify({ files: [], data: {}, tok: 'ok' }));
    const db = await window.Local.open();
    await new Promise((res) => { const tx = db.transaction(['kv', 'backups'], 'readwrite'); tx.objectStore('kv').clear(); tx.objectStore('backups').clear(); tx.oncomplete = res; });
    await window.Local.saveState({ pages, events: {}, settings: {}, meta: {} });
  }, seedPages());
  console.log('0) prázdný Disk, data jen v zařízení');
  await boot();
  let d = await D();
  ok(d.calls.join() === 'latest', 'při spuštění jen lehký dotaz: ' + d.calls.join());
  ok(/dirty/.test(await cloudCls()), 'oranžová tečka (data nejsou na Disku)');
  await page.click('[data-act="sync-up"]'); await sleep(500);
  ok(/Nahráno/.test(await toastText()), 'ruční nahrání funguje');
  ok(!/dirty/.test(await cloudCls()), 'po nahrání bez tečky');
  ok(!!(await idb('return await Local.loadBase()')), 'po nahrání uložena společná verze (base)');

  // ---------- případ 1 ----------
  console.log('1) na Disku nic nového');
  await boot();
  d = await D();
  ok(d.calls.join() === 'latest', 'jen latest, žádné stažení: ' + d.calls.join());

  // ---------- případ 2 ----------
  console.log('2) novější verze na Disku, tady beze změn');
  await otherDevice(`d.pages.pA.blocks[0].html='Text z iPhonu'; d.pages.pC={id:'pC',title:'Nová z iPhonu',icon:'',color:'green',parent:null,order:3,props:[],blocks:[{id:'c1',type:'p',html:'x'}]};`);
  const bk0 = (await page.evaluate(() => window.Local.listBackups())).length;
  await boot(900);
  d = await D();
  ok(d.calls.join() === 'latest,download', 'stáhlo se: ' + d.calls.join());
  ok((await sideTitles()).includes('Nová z iPhonu'), 'nová stránka je v panelu');
  ok(/Načtena novější verze z Disku/.test(await toastText()) && /iPhone/.test(await toastText()), 'nenápadný toast: ' + await toastText());
  ok(!/dirty/.test(await cloudCls()), 'žádná oranžová tečka po stažení (otisk sedí)');
  const bks = await page.evaluate(() => window.Local.listBackups());
  ok(bks.length === bk0 + 1 && bks[0].label === 'Před automatickým stažením z Disku', 'místní záloha před přepsáním: ' + bks[0].label);
  ok(JSON.stringify(bks[0].state.pages.pA.blocks[0].html) === '"Původní text A"', 'záloha obsahuje původní text');
  await boot();
  d = await D();
  ok(d.calls.join() === 'latest', 'další spuštění už nestahuje: ' + d.calls.join());

  // ---------- případ 2b: Vrátit ----------
  console.log('2b) tlačítko Vrátit po tichém stažení');
  await otherDevice(`d.pages.pB.blocks[0].html='B z iPhonu';`);
  await boot(900);
  await page.click('.toast button'); await sleep(400);
  const st2 = await idb('return await get("state")');
  ok(st2.pages.pB.blocks[0].html === 'Původní text B', 'vráceno na původní verzi');
  ok(/dirty/.test(await cloudCls()), 'po vrácení oranžová tečka (liší se od Disku)');
  await boot();
  d = await D();
  ok(d.calls.join() === 'latest', 'po vrácení se znovu nestahuje (verze z Disku je „viděná“)');
  await page.click('[data-act="sync-up"]'); await sleep(500);

  // ---------- případ 3 ----------
  console.log('3) změny tady, Disk beze změny');
  await boot();
  await typeInBlock('pA', 'a1', ' + lokální');
  ok(/dirty/.test(await cloudCls()), 'po psaní oranžová tečka');
  await boot();
  d = await D();
  ok(d.calls.join() === 'latest', 'nic se nestahuje: ' + d.calls.join());
  ok(/dirty/.test(await cloudCls()), 'tečka zůstala');

  // ---------- případ 4: kolize, různé stránky (čisté spojení) ----------
  console.log('4a) kolize – změněné různé stránky → Ponechat obě');
  await otherDevice(`d.pages.pB.blocks[0].html='B z iPhonu 2';`);
  await boot(900);
  ok(await page.isVisible('.cf-m'), 'dialog kolize je hned vidět');
  const sum = await page.textContent('.cf-sum');
  ok(/Změněno tady.*Poznámky ZJR/.test(sum) && /Změněno na Disku.*LMJ/.test(sum), 'přehled změn: ' + sum.replace(/\s+/g, ' '));
  ok(await page.isVisible('.guide-link.rec[data-cf="both"]'), '„Ponechat obě“ doporučeno (nepřekrývá se)');
  await page.screenshot({ path: path.join(SHOTS, 'kolize-svetly.png') });
  await page.click('[data-cf="both"]'); await sleep(500);
  let st = await idb('return await get("state")');
  ok(/lokální/.test(st.pages.pA.blocks[0].html) && st.pages.pB.blocks[0].html === 'B z iPhonu 2', 'spojeno: moje A + B z iPhonu');
  ok(Object.keys(st.pages).length === 3, 'žádné kopie: ' + Object.keys(st.pages).length + ' stránky');
  ok(/dirty/.test(await cloudCls()), 'po spojení tečka (je potřeba nahrát)');
  ok(/Spojeno/.test(await toastText()), 'toast: ' + await toastText());
  await page.click('.toast button'); await sleep(500);
  ok(!/dirty/.test(await cloudCls()), 'Nahrát z toastu → bez tečky');

  // ---------- případ 4: kolize na stejné stránce ----------
  console.log('4b) kolize – stejná stránka → Ponechat obě (kopie)');
  await boot();
  await typeInBlock('pB', 'b1', ' + mac');
  await otherDevice(`d.pages.pB.blocks[0].html='B jinak z iPhonu';`);
  await boot(900);
  ok(/Změněno na obou místech.*LMJ/.test((await page.textContent('.cf-sum')).replace(/\s+/g, ' ')), 'stejná stránka na obou místech');
  ok(!(await page.isVisible('.guide-link.rec')), 'bez doporučení');
  await page.click('[data-cf="both"]'); await sleep(500);
  ok((await sideTitles()).some((t) => /LMJ \(kopie – /.test(t)), 'kopie stránky: ' + (await sideTitles()).join(' | '));
  st = await idb('return await get("state")');
  ok(st.pages.pB.blocks[0].html === 'B jinak z iPhonu', 'originál = verze z Disku');
  await page.click('.toast button'); await sleep(500);

  console.log('4c) kolize → Použít verzi z Disku');
  await boot();
  await typeInBlock('pA', 'a1', ' ZAHODIT');
  await otherDevice(`d.pages.pA.title='ZJR (iPhone)';`);
  await boot(900);
  await page.click('[data-cf="remote"]'); await sleep(500);
  st = await idb('return await get("state")');
  ok(st.pages.pA.title === 'ZJR (iPhone)' && !/ZAHODIT/.test(st.pages.pA.blocks[0].html), 'použita verze z Disku');
  const b4 = (await page.evaluate(() => window.Local.listBackups()))[0];
  ok(/kolize/.test(b4.label) && /ZAHODIT/.test(b4.state.pages.pA.blocks[0].html), 'moje verze je v místní záloze: ' + b4.label);
  ok(!/dirty/.test(await cloudCls()), 'bez tečky');

  console.log('4d) kolize → Ponechat moji verzi / Rozhodnu později');
  await typeInBlock('pA', 'a1', ' MOJE');
  await otherDevice(`d.pages.pB.title='LMJ z iPhonu';`);
  await boot(900);
  await page.click('.cf-m [data-close]'); await sleep(200);
  ok(/dirty/.test(await cloudCls()) && await page.isVisible('.sync-io.dirty'), 'Rozhodnu později: tečka u mráčku i u ↓');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(300);
  ok(!(await page.isVisible('.cf-m')), 'po odložení se dialog hned znovu nevnucuje');
  await page.click('#sync-box .cloud'); await sleep(200);
  ok(await page.isVisible('.pop [data-v="merge"]'), 'v menu mráčku je „Porovnat s verzí na Disku…“');
  await page.click('.pop [data-v="merge"]'); await sleep(700);
  ok(await page.isVisible('.cf-m'), 'dialog znovu otevřen z menu');
  await page.click('[data-cf="local"]'); await sleep(400);
  st = await idb('return await get("state")');
  ok(/MOJE/.test(st.pages.pA.blocks[0].html) && st.pages.pB.title === 'LMJ', 'ponechána moje verze');
  ok(/dirty/.test(await cloudCls()) && !(await page.isVisible('.sync-io.dirty')), 'oranžová tečka, ↓ už ne');
  await boot();
  ok((await D()).calls.join() === 'latest' && !(await page.isVisible('.cf-m')), 'po restartu se už neptá');
  await page.click('[data-act="sync-up"]'); await sleep(500);

  // ---------- psaní během stahování ----------
  console.log('5) psaní během stahování = lokální změna (kolize, ne přepsání)');
  await otherDevice(`d.pages.pB.blocks[0].html='B během stahování';`);
  await setD('D.dlLatency=1500');
  await page.goto(BASE); await page.waitForSelector('#sync-box .cloud'); await sleep(200);
  await typeInBlock('pA', 'a1', ' PSANO');
  await sleep(1500);
  ok(await page.isVisible('.cf-m'), 'ukázal se dialog kolize: '+(await page.textContent('.cf-m')).replace(/\s+/g,' '));
  st = await idb('return await get("state")');
  ok(/PSANO/.test(st.pages.pA.blocks[0].html) && st.pages.pB.blocks[0].html !== 'B během stahování', 'nic se nepřepsalo');
  await page.click('[data-cf="both"]'); await sleep(500);
  st = await idb('return await get("state")');
  ok(/PSANO/.test(st.pages.pA.blocks[0].html) && st.pages.pB.blocks[0].html === 'B během stahování', 'spojeno: '+JSON.stringify([st.pages.pA.blocks[0].html, st.pages.pB.blocks[0].html, Object.values(st.pages).map(p=>p.title), await toastText()]));
  await setD('D.dlLatency=0');
  await page.click('[data-act="sync-up"]'); await sleep(500);

  // ---------- otevřený dialog během stažení ----------
  console.log('6) otevřený dialog (rozvrh) → stažení počká na zavření');
  await otherDevice(`d.pages.pA.title='ZJR po dialogu';`);
  await setD('D.dlLatency=700');
  await page.goto(BASE); await page.waitForSelector('#sync-box .cloud'); await sleep(100);
  await page.click('[data-act="settings"]'); await sleep(1200);
  ok(!(await sideTitles()).includes('ZJR po dialogu'), 'během otevřeného nastavení se nic nepřepsalo');
  await page.keyboard.press('Escape'); await sleep(500);
  ok((await sideTitles()).some((t) => /ZJR po dialogu/.test(t)), 'po zavření se stažená verze použila');
  await setD('D.dlLatency=0');

  // ---------- vypršelý token ----------
  console.log('7) vypršelý token: žlutý mrak, kontrola po prvním klepnutí');
  await otherDevice(`d.pages.pB.title='LMJ po přihlášení';`);
  await setD(`D.tok='expired'`);
  await boot();
  d = await D();
  ok(d.calls.length === 0, 'bez platného tokenu žádný dotaz: ' + d.calls.join());
  ok(/cl-exp/.test(await cloudCls()), 'žlutý mrak');
  ok(/první klepnutí/.test(await page.getAttribute('#sync-box .cloud', 'title')), 'nápověda u mráčku');
  await page.click('[data-act="nav"][data-v="tasks"]'); await sleep(700);
  d = await D();
  ok(/^connect:true,latest,download$/.test(d.calls.join()), 'klepnutí → přihlášení (s aktivací uživatele) → kontrola → stažení: ' + d.calls.join());
  ok((await sideTitles()).includes('LMJ po přihlášení'), 'staženo');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('uk-view')).kind) === 'tasks', 'klepnutí zároveň udělalo svou práci (Úkoly)');
  await page.click('[data-act="nav"][data-v="today"]'); await sleep(300);
  ok((await D()).calls.filter((c) => c.startsWith('connect')).length === 1, 'další klepnutí už přihlášení nespouští');

  console.log('7b) vypršelý token, okno přihlášení zavřené');
  await setD(`D.tok='expired'; D.failConnect=true`);
  await boot();
  await page.click('[data-act="nav"][data-v="tasks"]'); await sleep(400);
  ok(/zrušené/.test(await toastText()), 'toast: ' + await toastText());
  await page.click('[data-act="nav"][data-v="today"]'); await sleep(300);
  ok((await D()).calls.filter((c) => c.startsWith('connect')).length === 1, 'nespamuje dalšími okny');
  await setD(`D.tok='ok'; D.failConnect=false`);

  // ---------- offline ----------
  console.log('8) bez internetu se kontrola přeskočí');
  await otherDevice(`d.pages.pA.title='offline test';`);
  await page.evaluate(() => localStorage.setItem('test-offline', '1'));
  await boot();
  ok((await D()).calls.length === 0, 'žádný dotaz');
  ok((await sideTitles()).length >= 3, 'aplikace běží z dat v zařízení');
  await page.evaluate(() => localStorage.removeItem('test-offline'));

  // ---------- vypnuto v nastavení ----------
  console.log('9) vypnuto v nastavení');
  await page.evaluate(() => localStorage.setItem('uk-auto-pull', 'false'));
  await boot();
  d = await D();
  ok(d.calls.join() === 'latest', 'jen kontrola (tečka u ↓), bez stažení: ' + d.calls.join());
  ok(await page.isVisible('.sync-io.dirty'), '↓ ukazuje novější verzi');
  ok(!(await sideTitles()).includes('offline test'), 'nic se nepřepsalo');
  await page.click('[data-act="settings"]'); await page.click('[data-tab="sync"]');
  ok(!(await page.isChecked('#st-auto')), 'přepínač v nastavení vypnutý');
  await page.click('#st-auto'); await sleep(200);
  await page.screenshot({ path: path.join(SHOTS, 'nastaveni.png') });
  await page.keyboard.press('Escape'); await sleep(700);
  ok((await sideTitles()).includes('offline test'), 'po zapnutí a zavření nastavení se stáhlo');

  // ---------- tmavý motiv + mobil ----------
  console.log('10) vzhled dialogu – tmavý motiv, mobil');
  await typeInBlock('pA', 'a1', ' tmavý');
  await otherDevice(`d.pages.pA.blocks[0].html='jiný'; d.events={e1:{id:'e1',title:'Cvičení ZJR',type:'Cvičení',day:1,start:'10:00',end:'11:50',repeat:'weekly'}};`);
  await page.evaluate(() => localStorage.setItem('uk-theme', '"dark"'));
  await page.setViewportSize({ width: 390, height: 780 });
  await boot(900);
  await page.screenshot({ path: path.join(SHOTS, 'kolize-tmavy-mobil.png') });
  ok(await page.isVisible('.cf-m'), 'dialog na mobilu');
  const ov = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  ok(ov, 'bez vodorovného posuvu');

  // ---------- data, která nikdy nebyla na Disku ----------
  console.log('11) nové zařízení s vlastními daty, na Disku už něco je → zeptá se, nepřepíše');
  await page.evaluate(() => localStorage.setItem('uk-theme', '"light"'));
  await page.setViewportSize({ width: 1280, height: 820 });
  await rawSeed({ pages: { pX: { id: 'pX', title: 'Jen tady', parent: null, order: 1, props: [], blocks: [] } }, events: {}, settings: {}, meta: {} });
  await boot(900);
  ok(await page.isVisible('.cf-m'), 'dialog kolize místo tichého přepsání');
  const t11 = (await page.textContent('.cf-sum')).replace(/\s+/g, ' ');
  ok(/Jen tady \(jen tady\)/.test(t11) && /\(jen na Disku\)/.test(t11), 'bez společné verze: ' + t11.slice(0, 160));
  await page.screenshot({ path: path.join(SHOTS, 'kolize-nove-zarizeni.png') });
  await page.click('[data-cf="both"]'); await sleep(500);
  const t11b = await sideTitles();
  ok(t11b.includes('Jen tady') && t11b.length >= 4, 'spojeno, nic se neztratilo: ' + t11b.join(' | '));

  console.log('12) prázdné zařízení → tiše stáhne');
  await rawSeed(null);
  await boot(900);
  ok(!(await page.isVisible('.cf-m')) && (await sideTitles()).length >= 3, 'prázdné zařízení se naplní z Disku bez ptaní');

  ok(errors.length === 0, 'žádné chyby v konzoli' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} SELHALO` : '\nVŠE OK');
  process.exitCode = fails ? 1 : 0;
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
