/* Úkolníček – Service Worker (offline režim)
   Při každé nové verzi aplikace zvyš VERSION, jinak si telefony nechají starou verzi. */
const VERSION = 'ukolnicek-v4.15.0';
const ASSETS = [
  './',
  './index.html',
  './css/base.css',
  './css/themes.css',
  './css/layout.css',
  './css/controls.css',
  './css/editor.css',
  './css/views.css',
  './css/today.css',
  './css/schedule.css',
  './css/index.css',
  './css/settings.css',
  './css/sync.css',
  './css/draw.css',
  './css/mindmap.css',
  './css/ai.css',
  './css/responsive.css',
  './js/core.js',
  './js/dates.js',
  './js/driveSync.js',
  './js/editor/blocks.js',
  './js/editor/caret.js',
  './js/editor/code.js',
  './js/editor/draw.js',
  './js/editor/tblsize.js',
  './js/editor/caps.js',
  './js/editor/events.js',
  './js/editor/multisel.js',
  './js/editor/mention.js',
  './js/editor/history.js',
  './js/editor/images.js',
  './js/editor/keys.js',
  './js/editor/links.js',
  './js/editor/markdown.js',
  './js/editor/source.js',
  './js/editor/math.js',
  './js/editor/menus.js',
  './js/editor/render.js',
  './js/editor/slash.js',
  './js/editor/toolbar.js',
  './js/editor/aiedit.js',
  './js/editor/aipanel.js',
  './js/ai.js',
  './js/ai/actions.js',
  './js/ai/sse.js',
  './js/ai/stats.js',
  './js/ai/providers/gemini.js',
  './js/ai/providers/anthropic.js',
  './js/views/aiset.js',
  './js/lock.js',
  './js/main.js',
  './js/trash.js',
  './js/update.js',
  './js/pages.js',
  './js/router.js',
  './js/sanitize.js',
  './js/school.js',
  './js/sidebar.js',
  './js/state.js',
  './js/storage.js',
  './js/store.js',
  './js/theme.js',
  './js/sync/merge.js',
  './js/sync/uplog.js',
  './js/sync/sync.js',
  './js/sync/images.js',
  './js/ui.js',
  './js/views/schedule.js',
  './js/views/search.js',
  './js/views/settings.js',
  './js/views/subjects.js',
  './js/views/tasks.js',
  './js/views/mindmap.js',
  './js/views/today.js',
  './js/views/dashWidgets.js',
  './lib/fonts/fonts.css',
  './lib/fonts/bricolage-grotesque-latin-ext-opsz-normal.woff2',
  './lib/fonts/bricolage-grotesque-latin-opsz-normal.woff2',
  './lib/fonts/onest-latin-ext-wght-normal.woff2',
  './lib/fonts/onest-latin-wght-normal.woff2',
  './lib/fonts/jetbrains-mono-latin-ext-wght-normal.woff2',
  './lib/fonts/jetbrains-mono-latin-wght-normal.woff2',
  './lib/fonts/literata-latin-ext-opsz-normal.woff2',
  './lib/fonts/literata-latin-opsz-normal.woff2',
  './lib/fonts/literata-latin-ext-opsz-italic.woff2',
  './lib/fonts/literata-latin-opsz-italic.woff2',
  './lib/fonts/newsreader-latin-ext-opsz-normal.woff2',
  './lib/fonts/newsreader-latin-opsz-normal.woff2',
  './lib/fonts/source-serif-4-latin-ext-opsz-normal.woff2',
  './lib/fonts/source-serif-4-latin-opsz-normal.woff2',
  './lib/fonts/source-serif-4-latin-ext-opsz-italic.woff2',
  './lib/fonts/source-serif-4-latin-opsz-italic.woff2',
  './lib/fonts/ibm-plex-sans-latin-ext-wght-normal.woff2',
  './lib/fonts/ibm-plex-sans-latin-wght-normal.woff2',
  './lib/fonts/ibm-plex-sans-latin-ext-wght-italic.woff2',
  './lib/fonts/ibm-plex-sans-latin-wght-italic.woff2',
  './lib/fonts/newsreader-latin-ext-opsz-italic.woff2',
  './lib/fonts/newsreader-latin-opsz-italic.woff2',
  './lib/katex/katex.min.js',
  './lib/katex/katex.min.css',
  './lib/katex/fonts/KaTeX_AMS-Regular.woff2',
  './lib/katex/fonts/KaTeX_Caligraphic-Bold.woff2',
  './lib/katex/fonts/KaTeX_Caligraphic-Regular.woff2',
  './lib/katex/fonts/KaTeX_Fraktur-Bold.woff2',
  './lib/katex/fonts/KaTeX_Fraktur-Regular.woff2',
  './lib/katex/fonts/KaTeX_Main-Bold.woff2',
  './lib/katex/fonts/KaTeX_Main-BoldItalic.woff2',
  './lib/katex/fonts/KaTeX_Main-Italic.woff2',
  './lib/katex/fonts/KaTeX_Main-Regular.woff2',
  './lib/katex/fonts/KaTeX_Math-BoldItalic.woff2',
  './lib/katex/fonts/KaTeX_Math-Italic.woff2',
  './lib/katex/fonts/KaTeX_SansSerif-Bold.woff2',
  './lib/katex/fonts/KaTeX_SansSerif-Italic.woff2',
  './lib/katex/fonts/KaTeX_SansSerif-Regular.woff2',
  './lib/katex/fonts/KaTeX_Script-Regular.woff2',
  './lib/katex/fonts/KaTeX_Size1-Regular.woff2',
  './lib/katex/fonts/KaTeX_Size2-Regular.woff2',
  './lib/katex/fonts/KaTeX_Size3-Regular.woff2',
  './lib/katex/fonts/KaTeX_Size4-Regular.woff2',
  './lib/katex/fonts/KaTeX_Typewriter-Regular.woff2',
  './navod.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-180.png'
];

/* číslo verze z názvu mezipaměti 'ukolnicek-v4.3.0' → [4,3,0] */
const vnum = (k) => (/v(\d+)\.(\d+)(?:\.(\d+))?/.exec(k) || []).slice(1, 4).map((x) => +x || 0);
const isNewer = (a, b) => { const x = vnum(a), y = vnum(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
/* ?v=verze: server (CDN GitHub Pages) nevrátí starou kopii souboru uloženou pod stejnou adresou */
const bust = (u) => u + (u.includes('?') ? '&' : '?') + 'v=' + VERSION.replace('ukolnicek-v', '');

self.addEventListener('install', (e) => {
  e.waitUntil(caches.keys().then((keys) => {
    /* Ochrana proti návratu na starší verzi: GitHub Pages chvíli po vydání může z některého serveru poslat ještě starý sw.js.
       Když už je v zařízení novější verze, starší se nenainstaluje (instalace selže, zůstane novější). */
    if (keys.some((k) => k.startsWith('ukolnicek-v') && isNewer(k, VERSION))) throw new Error('Starší verze ' + VERSION + ' se neinstaluje');
    // cache:'reload' = stáhnout ze serveru, ne z mezipaměti prohlížeče; uloží se pod adresou bez ?v=
    return caches.open(VERSION).then((c) => Promise.all(ASSETS.map((u) =>
      fetch(new Request(bust(u), { cache: 'reload' })).then((r) => { if (!r.ok) throw new Error(u + ' ' + r.status); return c.put(u, r); }))));
  }));
  // nečekáme automaticky: aplikace nabídne „Obnovit“, pak pošle skipWaiting
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  /* aplikace se ptá na verzi čekajícího Service Workeru (starší nenasadí) */
  if (e.data === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION.replace('ukolnicek-v', ''));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google přihlášení a Drive API nikdy necachovat
  if (/(^|\.)googleapis\.com$/.test(url.hostname)) return;
  if (url.hostname === 'accounts.google.com') return;

  if (url.origin !== self.location.origin) return;

  // stránka: vždy z mezipaměti (funguje offline), nová verze se pozná přes aktualizaci SW
  if (req.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname)) {
    e.respondWith(caches.match('./index.html').then((hit) => hit || fetch(req)));
    return;
  }

  // ostatní soubory aplikace: nejdřív mezipaměť, pak síť
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
