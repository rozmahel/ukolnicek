/* Úkolníček – test: barevné motivy (Výchozí / Papír / Les) × režim (světlý / tmavý).
   - Výchozí vzhled je pixel po pixelu stejný jako ve verzi 3.0.1 (proměnné i snímky obrazovky)
   - výběr motivu v Nastavení → Obecné, ukládání jen po změně, Výchozí = klíč se z dat odstraní, neznámá hodnota = Výchozí
   - po aktualizaci ze 3.0.1 žádná oranžová tečka, motiv přes Disk mezi zařízeními
   - kontrast WCAG se počítá ze skutečného CSS pro všech 6 vzhledů: dvojice proměnných i čitelnost vykresleného textu v pohledech
   - systémová písma, barva lišty prohlížeče, mobil, seznam souborů v sw.js
   Spouští se přes `npm test` (tests/run.js), ten nastaví UK_BASE a UK_PREV (složka _zaloha-v3.0.1). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MOCK = fs.readFileSync(path.join(__dirname, 'mockDrive.js'), 'utf8');
const SHOTS = path.join(__dirname, 'shots', path.basename(__filename, '.test.js')); fs.mkdirSync(SHOTS, { recursive: true });
const ORIGIN = process.env.UK_BASE || 'http://localhost:8000/';
const PREV = process.env.UK_PREV || '';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const info = (m) => console.log('  · ' + m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- WCAG ---- */
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const HLS = ['purple', 'pink', 'red', 'orange', 'yellow', 'green', 'blue', 'gray'];
const TOK = ['bg', 'side', 'panel', 'fg', 'fg2', 'muted', 'faint', 'line', 'hover', 'sel', 'accent', 'accent-soft', 'on-accent', 'danger', 'on-danger', 'ok'].concat(HLS.flatMap((c) => ['hl-' + c + '-bg', 'hl-' + c + '-fg']));
/* dvojice [text, pozadí], které se v aplikaci opravdu potkávají (viz css/*.css); každá musí mít aspoň 4,5:1 */
function pairs() {
  const P = [];
  ['bg', 'side', 'panel', 'hover'].forEach((s) => { P.push(['fg', s], ['fg2', s], ['muted', s]); });
  P.push(['fg', 'sel'], ['fg', 'accent-soft']);
  ['bg', 'side', 'panel'].forEach((s) => { P.push(['faint', s], ['danger', s], ['ok', s]); });
  ['bg', 'side', 'panel', 'accent-soft', 'on-accent'].forEach((s) => P.push(['accent', s]));
  P.push(['on-accent', 'accent'], ['on-danger', 'danger']);
  HLS.forEach((c) => {
    P.push(['hl-' + c + '-fg', 'hl-' + c + '-bg'], ['fg', 'hl-' + c + '-bg']);
    ['bg', 'side', 'panel', 'hover'].forEach((s) => P.push(['hl-' + c + '-fg', s]));
  });
  return P;
}

/* ---- data pro testy: všech 8 barev předmětů, rozvrh, stránka s odkazy a callouty ---- */
const CODES = ['MPA-ZJR', 'LMJ', 'ELE', 'FYZ', 'MAT', 'PRG', 'TEO', 'ANG'];
const seed = () => {
  const subjects = {}, events = {};
  HLS.forEach((c, i) => {
    subjects['s' + i] = { id: 's' + i, code: CODES[i], name: 'Předmět ' + CODES[i], credits: 4, sem: 's1', end: 'zk', color: c, pts: i % 2 ? '' : String(50 + i), parts: i % 2 ? [{ id: 'pt' + i, name: 'Cvičení', max: 30, pts: 18 }, { id: 'pu' + i, name: 'Projekt', max: 20, pts: 22 }] : [] };
    events['e' + i] = { id: 'e' + i, title: CODES[i], type: 'Přednáška', day: i % 5, start: i < 5 ? '08:00' : '11:00', end: i < 5 ? '09:50' : '12:50', repeat: 'weekly', color: c, subj: 's' + i, place: 'E' + i, who: 'Dr. Novák' };
  });
  return {
    settings: { school: true, semesterStart: '2026-09-21' },
    semesters: { s1: { id: 's1', name: 'ZS 2026/27', target: 30, order: 1 } },
    subjects, events,
    pages: { pZ: { id: 'pZ', title: 'Zimní semestr 2026', icon: '🎓', color: 'purple', parent: null, order: 1, props: [], blocks: [
      { id: 'p0', type: 'p', html: 'Poznámky k semestru' },
      { id: 'sj', type: 'subj', subj: 's0', html: 'MPA-ZJR — Předmět MPA-ZJR' },
      { id: 'td', type: 'todo', html: 'Domluvit téma', due: '2026-10-07' },
      { id: 'td2', type: 'todo', html: 'Odevzdat protokol', due: '2026-10-03' },
      { id: 'h1', type: 'h1', html: 'Diplomka' },
      ...HLS.map((c, i) => ({ id: 'c' + i, type: 'callout', html: 'Poznámka ' + c, color: c, icon: '💡' })),
      { id: 'pz', type: 'p', html: 'konec' }] } }
  };
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
  await page.clock.setFixedTime(new Date('2026-10-05T10:15:00'));   /* pondělí; jinak by snímky ovlivnil čas */
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });

  const boot = async (url = ORIGIN, ms = 700) => { await page.goto(url); await page.waitForSelector('#sync-box .cloud'); await sleep(ms); };
  const idbState = () => page.evaluate(async () => { const db = await window.Local.open(); return new Promise((res) => { const r = db.transaction('kv').objectStore('kv').get('state'); r.onsuccess = () => res(r.result); }); });
  const putState = (st) => page.evaluate(async (st) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('ukolnicek', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('images', { keyPath: 'id' }); d.createObjectStore('backups', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = rej; });
    await new Promise((res) => { const tx = db.transaction(['kv'], 'readwrite'); const o = tx.objectStore('kv'); o.clear(); o.put(st, 'state'); tx.oncomplete = res; }); db.close();
  }, st);
  const cloudCls = () => page.$eval('#sync-box .cloud', (c) => c.className);
  const dirty = async () => /dirty/.test(await cloudCls());
  /* nový čistý stav: data v zařízení + prázdný falešný Disk; režim a motiv se nastaví před startem */
  const fresh = async ({ theme, mode = 'light', view = { kind: 'today' }, settings = {}, url = ORIGIN } = {}) => {
    await page.goto(ORIGIN + 'manifest.webmanifest');
    await page.evaluate(([mode, view]) => {
      localStorage.clear(); localStorage.setItem('mock-D', JSON.stringify({ files: [], data: {}, tok: 'ok' }));
      localStorage.setItem('uk-theme', JSON.stringify(mode)); localStorage.setItem('uk-view', JSON.stringify(view));
    }, [mode, view]);
    const st = Object.assign(seed(), { meta: {} });
    Object.assign(st.settings, settings); if (theme) st.settings.theme = theme;
    await putState(st);
    await boot(url);
  };
  const html = (a) => page.evaluate((a) => document.documentElement.getAttribute(a), a);
  const tokens = () => page.evaluate((names) => { const cs = getComputedStyle(document.documentElement); const o = {}; names.forEach((n) => { o[n] = cs.getPropertyValue('--' + n).trim(); }); return o; }, TOK);
  const nav = async (v) => { await page.click(`[data-act="nav"][data-v="${v}"]`); await sleep(350); };
  const openPageZ = async () => { await page.click('.ti-main[data-id="pZ"]'); await sleep(350); };
  const openSettings = async (tab) => { await page.click('[data-act="settings"]'); await sleep(250); if (tab) { await page.click(`.set-nav [data-tab="${tab}"]`); await sleep(120); } };

  /* ---- čitelnost vykresleného textu: u každého viditelného textu se spočítá barva proti skutečnému pozadí ---- */
  const scan = () => page.evaluate(() => {
    const rgba = (s) => {
      let m = s.match(/^rgba?\(([^)]+)\)$/);
      if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
      m = s.match(/^color\(srgb ([^)]+)\)$/);
      if (m) { const p = m[1].split(/[\s\/]+/).filter(Boolean).map(parseFloat); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
      return null;
    };
    const over = (t, b) => { const a = t[3]; return [t[0] * a + b[0] * (1 - a), t[1] * a + b[1] * (1 - a), t[2] * a + b[2] * (1 - a), 1]; };
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bgOf = (el) => {
      const chain = [];
      for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { chain.push(c); if (c[3] >= 1) break; } }
      let acc = chain.length && chain[chain.length - 1][3] >= 1 ? chain.pop() : [255, 255, 255, 1];
      while (chain.length) acc = over(chain.pop(), acc);
      return acc;
    };
    const lbl = (e) => e.tagName.toLowerCase() + [...e.classList].map((c) => '.' + c).join('');
    const out = []; let n = 0;
    document.querySelectorAll('body *').forEach((el) => {
      if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|PATH|OPTION)$/i.test(el.tagName)) return;
      const form = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
      const own = form ? (el.value || '').trim() : [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim();
      if (!own || (form && (el.type === 'checkbox' || el.type === 'file' || el.type === 'date'))) return;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (cs.visibility !== 'visible' || cs.display === 'none' || r.width < 2 || r.height < 2) return;
      let op = 1; for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
      if (op < 0.05) return;                                   /* neviditelné do najetí myší (např. „+“ v rozvrhu) */
      const fg0 = rgba(cs.color); if (!fg0) return;
      const bg = bgOf(el), fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * op], bg);
      const px = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight, 10) || 400, large = px >= 24 || (px >= 18.66 && w >= 700);
      const rt = ratio(fg, bg); n++;
      /* dim = záměrně ztlumený stav v CSS komponenty (opacity nebo průhledná barva), stejný ve všech motivech */
      if (rt < (large ? 3 : 4.5)) out.push({ k: lbl(el) + ' < ' + (el.parentElement ? lbl(el.parentElement) : ''), text: own.slice(0, 28), ratio: Math.round(rt * 100) / 100, need: large ? 3 : 4.5, dim: op < 1 || fg0[3] < 1 });
    });
    return { n, bad: out };
  });
  const VIEWS = [['today', () => nav('today')], ['tasks', () => nav('tasks')], ['schedule', () => nav('schedule')], ['index', () => nav('index')], ['poznamky', openPageZ]];
  const SET_TABS = ['general', 'look', 'sync', 'help'];
  const scanLook = async (shotPrefix) => {
    const bad = new Map(); let total = 0;
    const add = (r, where) => { total += r.n; r.bad.forEach((b) => { if (!bad.has(b.k)) bad.set(b.k, Object.assign({ where }, b)); }); };
    for (const [name, go] of VIEWS) {
      await go(); add(await scan(), name);
      if (shotPrefix) await page.screenshot({ path: path.join(SHOTS, `${shotPrefix}-${name}.png`) });
    }
    await openSettings();
    for (const t of SET_TABS) {
      await page.click(`.set-nav [data-tab="${t}"]`); await sleep(120); add(await scan(), 'nastavení/' + t);
      if (shotPrefix && t === 'general') await page.screenshot({ path: path.join(SHOTS, `${shotPrefix}-nastaveni.png`) });
    }
    await page.keyboard.press('Escape'); await sleep(150);
    return { bad, total };
  };
  const nm = { default: 'Výchozí', paper: 'Papír', forest: 'Les' }, md = { light: 'světlý', dark: 'noční' };

  /* ================================================================ */
  console.log('1) Výchozí vzhled je beze změny proti verzi 3.0.1');
  if (!PREV) info('(složka _zaloha-v3.0.1 chybí, porovnání s předchozí verzí se přeskočí)');
  if (PREV) {
    for (const mode of ['light', 'dark']) {
      /* všechny proměnné, které definovala stará verze, musí mít v nové verzi stejnou hodnotu */
      const grab = async (url) => {
        await fresh({ mode, url });
        return page.evaluate(() => {
          const cs = getComputedStyle(document.documentElement), names = new Set(), o = {};
          const walk = (rule) => { if (rule.style) [...rule.style].filter((p) => p.startsWith('--')).forEach((p) => names.add(p)); if (rule.cssRules) [...rule.cssRules].forEach(walk); };
          [...document.styleSheets].forEach((ss) => { try { [...ss.cssRules].forEach(walk); } catch (e) {} });
          names.forEach((n) => { o[n] = cs.getPropertyValue(n).trim(); });
          o['color-scheme'] = cs.colorScheme; o['font-family'] = cs.fontFamily; o['body-bg'] = getComputedStyle(document.body).backgroundColor;
          return o;
        });
      };
      const a = await grab(PREV), b = await grab(ORIGIN);
      const diff = Object.keys(a).filter((k) => a[k] !== b[k]);
      ok(Object.keys(a).length > 30 && diff.length === 0, `proměnné (${md[mode]} režim): všech ${Object.keys(a).length} hodnot shodných` + (diff.length ? ' – liší se: ' + diff.map((k) => `${k}: ${a[k]} → ${b[k]}`).join('; ') : ''));
    }
    /* snímky: stejné stránky ve staré a nové verzi musí dát identické obrazové body */
    for (const mode of ['light', 'dark']) {
      const eq = [];
      for (const [name, view] of [['today', { kind: 'today' }], ['tasks', { kind: 'tasks' }], ['schedule', { kind: 'schedule' }], ['index', { kind: 'index' }], ['poznamky', { kind: 'page', pageId: 'pZ' }]]) {
        const s = {};
        for (const [tag, url] of [['stara', PREV], ['nova', ORIGIN]]) { await fresh({ mode, view, url }); await sleep(300); s[tag] = await page.screenshot({ animations: 'disabled' }); }
        const same = s.stara.equals(s.nova);
        if (!same) { fs.writeFileSync(path.join(SHOTS, `rozdil-${mode}-${name}-stara.png`), s.stara); fs.writeFileSync(path.join(SHOTS, `rozdil-${mode}-${name}-nova.png`), s.nova); }
        eq.push([name, same]);
      }
      /* okno „Smazat školní data?“ má červené tlačítko, které dřív mělo natvrdo bílý text */
      const d = {};
      for (const [tag, url] of [['stara', PREV], ['nova', ORIGIN]]) { await fresh({ mode, url }); await openSettings(); await page.click('#st-clear'); await sleep(300); d[tag] = await page.locator('.modal').screenshot({ animations: 'disabled' }); }
      eq.push(['okno Smazat školní data', d.stara.equals(d.nova)]);
      eq.forEach(([n, same]) => ok(same, `snímek identický (${md[mode]}): ${n}`));
    }
  }

  /* ================================================================ */
  console.log('2) Výběr motivu v Nastavení → Obecné');
  await fresh({});
  ok((await html('data-skin')) === null, 'Výchozí: na <html> není data-skin');
  ok(!('theme' in (await idbState()).settings), 'Výchozí: v datech není klíč theme');
  await openSettings('general');
  const btns = await page.$$eval('#st-skin .skin', (b) => b.map((x) => [x.dataset.v, x.getAttribute('aria-pressed'), x.textContent.replace(/Aa/, '').trim()]));
  ok(JSON.stringify(btns) === JSON.stringify([['default', 'true', 'Výchozí'], ['paper', 'false', 'Papír'], ['forest', 'false', 'Les']]), 'tři volby Výchozí / Papír / Les, vybrané Výchozí: ' + JSON.stringify(btns));
  ok(await page.$eval('#st-skin', (e) => !!e.closest('[data-pane="general"]')), 'výběr je v kategorii Obecné');
  ok(await page.$eval('#st-theme', (e) => !!e.closest('[data-pane="look"]')), 'přepínač světlý/tmavý/auto zůstal ve Vzhledu');
  /* ukázky mají skutečné barvy a písmo motivů (ne společné) */
  const sw = await page.$$eval('#st-skin .skin-sw', (els) => els.map((e) => ({ bg: getComputedStyle(e).backgroundColor, ff: getComputedStyle(e.querySelector('b')).fontFamily, dots: [...e.querySelectorAll('i')].map((i) => getComputedStyle(i).backgroundColor) })));
  ok(new Set(sw.map((s) => s.bg)).size === 3 && sw.every((s) => new Set(s.dots).size === 3), 'ukázky se barevně liší a každá má 3 různé tečky');
  ok(/Onest/.test(sw[0].ff) && /Iowan/.test(sw[1].ff) && /system-ui/.test(sw[2].ff), 'ukázka ukazuje i písmo motivu: ' + sw.map((s) => s.ff.split(',')[0]).join(' | '));
  await page.click('#st-skin [data-v="paper"]'); await sleep(500);
  ok((await html('data-skin')) === 'paper', 'Papír: <html data-skin="paper"> hned po kliknutí');
  ok((await idbState()).settings.theme === 'paper', 'Papír: v datech settings.theme = "paper"');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('uk-skin'))) === 'paper', 'kopie v zařízení pro rychlý start');
  ok(await page.$eval('#st-skin [data-v="paper"]', (b) => b.getAttribute('aria-pressed') === 'true') && await page.$eval('#st-skin [data-v="default"]', (b) => b.getAttribute('aria-pressed') === 'false'), 'vybraná volba je označená');
  await page.click('#st-skin [data-v="forest"]'); await sleep(500);
  ok((await html('data-skin')) === 'forest' && (await idbState()).settings.theme === 'forest', 'Les: atribut i data');
  await page.screenshot({ path: path.join(SHOTS, 'vyber-motivu.png') });
  await page.click('#st-skin [data-v="default"]'); await sleep(500);
  ok((await html('data-skin')) === null, 'zpět na Výchozí: atribut zmizí');
  ok(!('theme' in (await idbState()).settings), 'zpět na Výchozí: klíč theme se z dat odstraní (výchozí se neukládá)');
  ok(await page.evaluate(() => localStorage.getItem('uk-skin')) === null, 'kopie v zařízení smazána');
  const rev0 = JSON.stringify((await idbState()).settings);
  await page.click('#st-skin [data-v="default"]'); await sleep(400);
  ok(JSON.stringify((await idbState()).settings) === rev0, 'klik na už vybranou volbu nic nezapíše');

  /* ================================================================ */
  console.log('3) Motiv × režim jsou nezávislé');
  await fresh({ theme: 'paper', mode: 'light' });
  ok((await html('data-skin')) === 'paper' && (await html('data-theme')) === 'light', 'Papír + světlý');
  const bgL = (await tokens()).bg;
  await openSettings('look'); await page.click('#st-theme [data-v="dark"]'); await sleep(300);
  ok((await html('data-skin')) === 'paper' && (await html('data-theme')) === 'dark', 'přepnutí režimu na tmavý nechá motiv Papír');
  const bgD = (await tokens()).bg;
  ok(bgL.toLowerCase() === '#f4ecd8' && bgD.toLowerCase() === '#1f1a14', `pozadí Papíru: světlé ${bgL}, noční ${bgD} (podle zadání)`);
  await page.click('#st-theme [data-v="auto"]'); await sleep(250);
  await page.emulateMedia({ colorScheme: 'dark' }); await sleep(250);
  ok((await tokens()).bg.toLowerCase() === '#1f1a14', 'Podle zařízení + tmavý systém = noční Papír');
  await page.emulateMedia({ colorScheme: 'light' }); await sleep(250);
  ok((await tokens()).bg.toLowerCase() === '#f4ecd8', 'Podle zařízení + světlý systém = světlý Papír');
  await page.emulateMedia({ colorScheme: null });
  await fresh({ theme: 'forest', mode: 'light' }); const fl = (await tokens()).bg.toLowerCase();
  await fresh({ theme: 'forest', mode: 'dark' }); const fd = (await tokens()).bg.toLowerCase();
  ok(fl === '#eef2ec' && fd === '#121a16', `pozadí Lesa: světlé ${fl}, noční ${fd} (podle zadání)`);

  /* ================================================================ */
  console.log('4) Kontrast WCAG AA (≥ 4,5:1), počítaný ze skutečného CSS, všech 6 vzhledů');
  const LOOKS = [['default', 'light'], ['default', 'dark'], ['paper', 'light'], ['paper', 'dark'], ['forest', 'light'], ['forest', 'dark']];
  for (const [skin, mode] of LOOKS) {
    await fresh({ theme: skin === 'default' ? null : skin, mode });
    const t = await tokens();
    const rs = pairs().map(([f, b]) => [f, b, ratio(t[f], t[b])]);
    const bad = rs.filter((r) => r[2] < 4.5).map((r) => `${r[0]}/${r[1]} ${r[2].toFixed(2)}`);
    const worst = rs.reduce((a, r) => Math.min(a, r[2]), 99);
    if (skin === 'default') info(`${nm[skin]} ${md[mode]}: ${bad.length} dvojic pod 4,5:1 (stávající vzhled, beze změny; nejslabší ${worst.toFixed(2)})`);
    else ok(bad.length === 0, `${nm[skin]} ${md[mode]}: všech ${rs.length} dvojic barev ≥ 4,5:1 (nejslabší ${worst.toFixed(2)})` + (bad.length ? ' – NEVYHOVUJE: ' + bad.join(', ') : ''));
    /* barvy značek: tmavé pozadí v nočním, světlé ve světlém (nic se nepřeneslo z druhého režimu) */
    if (skin !== 'default') ok(HLS.every((c) => (lum(t['hl-' + c + '-bg']) < 0.2) === (mode === 'dark')) && (lum(t.bg) < 0.2) === (mode === 'dark'), `${nm[skin]} ${md[mode]}: barvy značek patří k režimu (nic nepřeteklo ze světlého do nočního)`);
    ok((await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)) === (mode === 'dark' ? 'dark' : 'normal'), `${nm[skin]} ${md[mode]}: color-scheme ${mode === 'dark' ? 'dark' : 'normal'}`);
    const meta = await page.$$eval('meta[name="theme-color"]', (m) => m.map((x) => x.content.toLowerCase()));
    ok(meta.length > 0 && meta.every((c) => c === t.bg.toLowerCase()), `${nm[skin]} ${md[mode]}: barva lišty prohlížeče = pozadí (${meta[0]})`);
  }

  console.log('5) Čitelnost vykresleného textu v pohledech a v Nastavení (porovnání s Výchozím)');
  const baseline = {};
  for (const [skin, mode] of LOOKS) {
    await fresh({ theme: skin === 'default' ? null : skin, mode });
    const s = await scanLook(`${skin}-${mode}`);
    if (skin === 'default') { baseline[mode] = s; info(`${nm[skin]} ${md[mode]}: zkontrolováno ${s.total} textů, pod mezí ${s.bad.size} míst, z toho ${[...s.bad.values()].filter((b) => !b.dim).length} bez záměrného ztlumení (stávající stav, beze změny)`); continue; }
    /* nový motiv: každý text musí mít aspoň 4,5:1 (velký 3:1); výjimkou jsou jen záměrně ztlumené stavy z CSS komponent */
    const all = [...s.bad.values()], solid = all.filter((b) => !b.dim), dimmed = all.filter((b) => b.dim);
    ok(solid.length === 0, `${nm[skin]} ${md[mode]}: ${s.total} vykreslených textů, každý (mimo záměrně ztlumené stavy) ≥ 4,5:1` + (solid.length ? ' – POD MEZÍ: ' + solid.map((b) => `${b.where}: ${b.k} „${b.text}“ ${b.ratio}`).join('; ') : ''));
    const worse = all.filter((b) => !baseline[mode].bad.has(b.k));
    ok(worse.length === 0, `${nm[skin]} ${md[mode]}: žádné místo není horší než ve Výchozím` + (worse.length ? ' – ' + worse.map((b) => `${b.where}: ${b.k} „${b.text}“ ${b.ratio}`).join('; ') : ''));
    info(`${nm[skin]} ${md[mode]}: ${dimmed.length} záměrně ztlumených míst (Výchozí ${[...baseline[mode].bad.values()].filter((b) => b.dim).length}): ` + dimmed.map((b) => `${b.k.split(' < ')[0]} „${b.text}“ ${b.ratio}`).join('; '));
  }

  /* ================================================================ */
  console.log('6) Písma jsou systémová');
  const ff = {};
  for (const skin of ['default', 'paper', 'forest']) {
    await fresh({ theme: skin === 'default' ? null : skin });
    ff[skin] = await page.evaluate(() => { const r = getComputedStyle(document.documentElement); return { body: getComputedStyle(document.body).fontFamily, disp: r.getPropertyValue('--f-display').trim(), mono: r.getPropertyValue('--f-mono').trim() }; });
  }
  ok(/^"?Onest/.test(ff.default.body) && /Bricolage/.test(ff.default.disp), 'Výchozí: písma Onest / Bricolage Grotesque beze změny');
  ok(ff.paper.body.startsWith('"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif') && ff.paper.disp === ff.paper.body, 'Papír: Iowan Old Style → Palatino Linotype → Palatino → Georgia → serif');
  ok(ff.forest.body.startsWith('system-ui, -apple-system, "Segoe UI", sans-serif') && ff.forest.disp === ff.forest.body, 'Les: system-ui → -apple-system → Segoe UI → sans-serif');
  const themesCss = fs.readFileSync(path.join(ROOT, 'css/themes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/@import|url\(|fonts\.g|https?:\/\//i.test(themesCss), 'themes.css nic nestahuje (žádné @import, url(), odkazy na internet)');
  ok(!/JetBrains|Onest|Bricolage/.test(themesCss) && !/JetBrains/.test(ff.paper.mono + ff.forest.mono), 'nové motivy nepoužívají webová písma ani u --f-mono');

  /* ================================================================ */
  console.log('7) Motiv po načtení, neznámá hodnota, rychlý start');
  await fresh({ theme: 'forest' });
  await page.goto(ORIGIN + 'manifest.webmanifest'); await page.evaluate(() => localStorage.removeItem('uk-skin'));
  await boot();
  ok((await html('data-skin')) === 'forest', 'bez kopie v zařízení se motiv nastaví z dat po načtení');
  /* skript v index.html: aplikace se nespustí (main.js zablokovaný), motiv musí být na <html> i tak */
  await page.goto(ORIGIN + 'manifest.webmanifest'); await page.evaluate(() => localStorage.setItem('uk-skin', '"forest"'));
  await page.route('**/js/main.js', (r) => r.abort());
  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
  ok((await html('data-skin')) === 'forest', 'motiv je na <html> hned při startu, ještě před načtením dat (bez poblikání)');
  await page.goto(ORIGIN + 'manifest.webmanifest'); await page.evaluate(() => localStorage.setItem('uk-skin', '"aurora"'));
  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
  ok((await html('data-skin')) === null, 'neznámá hodnota v kopii se při startu ignoruje');
  await page.unroute('**/js/main.js');
  await fresh({ theme: 'aurora' });
  ok((await html('data-skin')) === null && (await tokens()).bg.toLowerCase() === '#fcfbfe', 'neznámá hodnota v datech (aurora) = Výchozí vzhled');
  await openSettings('general');
  ok(await page.$eval('#st-skin [data-v="default"]', (b) => b.getAttribute('aria-pressed') === 'true'), 'v Nastavení je u neznámé hodnoty označená Výchozí');
  await page.fill('#st-name', 'Moje úkoly'); await page.keyboard.press('Tab'); await sleep(500);
  const st7 = (await idbState()).settings;
  ok(st7.name === 'Moje úkoly' && st7.theme === 'aurora', 'jiná změna nastavení neznámou hodnotu z dat nesmaže');

  /* ================================================================ */
  console.log('8) Aktualizace bez oranžové tečky a motiv přes Disk');
  if (PREV) {
    await fresh({ url: PREV }); await page.click('[data-act="sync-up"]'); await sleep(600);
    ok(!(await dirty()), 'verze 3.0.1: nahráno, bez tečky');
    await boot(ORIGIN);
    ok(!(await dirty()), 'nová verze se stejnými daty: bez oranžové tečky');
    ok(!('theme' in (await idbState()).settings) && (await html('data-skin')) === null, 'nic se samo nezapsalo a vzhled je Výchozí');
  }
  await fresh({}); await page.click('[data-act="sync-up"]'); await sleep(600);
  ok(!(await dirty()), 'nahráno na Disk');
  await openSettings('general'); await page.click('#st-skin [data-v="paper"]'); await sleep(500);
  ok(await dirty(), 'výběr motivu je změna dat: oranžová tečka');
  await page.click('#st-skin [data-v="default"]'); await sleep(500);
  ok(!(await dirty()), 'návrat na Výchozí: otisk dat je zase stejný jako na Disku, tečka zmizí');
  await page.click('#st-skin [data-v="paper"]'); await sleep(500); await page.keyboard.press('Escape');
  await page.click('[data-act="sync-up"]'); await sleep(600);
  ok(!(await dirty()), 'motiv nahrán na Disk');
  const remote = await page.evaluate(() => { const f = [...window.__D.files].sort((a, b) => b.createdTime.localeCompare(a.createdTime))[0]; return window.__D.data[f.id].settings.theme; });
  ok(remote === 'paper', 'v záloze na Disku je settings.theme = "paper"');
  /* jiné zařízení uloží Les, tady beze změn: po otevření se motiv převezme */
  const otherDevice = (theme, dev) => page.evaluate(([theme, dev]) => {
    const D = window.__D, last = [...D.files].sort((x, y) => y.createdTime.localeCompare(x.createdTime))[0];
    const d = JSON.parse(JSON.stringify(D.data[last.id])); if (theme) d.settings.theme = theme; else delete d.settings.theme; d.device = dev;
    const id = 'o' + Math.random().toString(36).slice(2, 7); D.files.push({ id, name: 'ukolnicek_' + id + '.json', createdTime: new Date(Date.parse(last.createdTime) + 60000).toISOString(), size: 100 }); D.data[id] = d; window.__saveD();
  }, [theme, dev]);
  await otherDevice('forest', 'iPhone');
  await boot(ORIGIN, 1500);
  ok((await html('data-skin')) === 'forest' && (await idbState()).settings.theme === 'forest', 'motiv z jiného zařízení (Les) se po otevření převzal a použil');
  ok(!(await dirty()), 'po převzetí bez oranžové tečky');
  await otherDevice(null, 'iPad');
  await boot(ORIGIN, 1500);
  ok((await html('data-skin')) === null && !('theme' in (await idbState()).settings), 'Výchozí z jiného zařízení: motiv se vrátí na Výchozí');

  /* ================================================================ */
  console.log('9) Mobil');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [skin, mode] of [['paper', 'dark'], ['forest', 'light']]) {
    await fresh({ theme: skin, mode });
    await page.click('.topbar [data-act="menu"]'); await sleep(300);
    await openSettings('general'); await sleep(200);
    const fit = await page.evaluate(() => { const m = document.querySelector('.modal'), r = document.querySelector('#st-skin').getBoundingClientRect(); return { modal: m.scrollWidth <= m.clientWidth + 1, doc: document.documentElement.scrollWidth <= innerWidth, inside: r.left >= 0 && r.right <= innerWidth }; });
    ok(fit.modal && fit.doc && fit.inside, `${nm[skin]} ${md[mode]}: výběr motivu se na úzké obrazovce vejde`);
    await page.screenshot({ path: path.join(SHOTS, `mobil-${skin}-${mode}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  /* ================================================================ */
  console.log('10) Offline: sw.js a verze');
  const swJs = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const assets = [...swJs.matchAll(/^\s*'\.\/([^']*)'/gm)].map((m) => m[1]).filter(Boolean);
  ok(assets.every((a) => fs.existsSync(path.join(ROOT, a))), 'každý soubor ze sw.js existuje');
  const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);
  const missing = [...walk('css'), ...walk('js')].filter((f) => /\.(css|js)$/.test(f) && !assets.includes(f));
  ok(missing.length === 0, 'všechny CSS a JS soubory aplikace jsou v mezipaměti sw.js' + (missing.length ? ' – chybí: ' + missing.join(', ') : ''));
  ok(assets.includes('css/themes.css') && assets.includes('js/theme.js'), 'themes.css a theme.js jsou v sw.js');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(idx.indexOf('css/base.css') < idx.indexOf('css/themes.css') && idx.indexOf('css/themes.css') < idx.indexOf('css/layout.css'), 'themes.css se načítá hned za base.css');
  const appV = (fs.readFileSync(path.join(ROOT, 'js/views/settings.js'), 'utf8').match(/APP_VERSION='([^']+)'/) || [])[1];
  const swV = (swJs.match(/const VERSION = 'ukolnicek-v([^']+)'/) || [])[1];
  ok(appV && appV === swV, `verze v sw.js (${swV}) a v Nastavení (${appV}) se shodují`);

  ok(errors.length === 0, 'žádné chyby v konzoli' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} SELHALO` : '\nVŠE OK');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
