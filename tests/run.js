#!/usr/bin/env node
/* Úkolníček – spustí všechny testy.
   Ve složce projektu:  npm install        (jednou: Playwright a nástroje)
                        npx playwright install chromium   (jednou: prohlížeč pro testy)
                        npm test
   - nejdřív zkontroluje importy mezi moduly (tools/fix-imports.js --check)
   - spustí vlastní malý server: projekt na /, starou verzi ze složky _zaloha-v2.6.0 na /old/
     (pro test, že data uložená starou verzí nová verze načte beze změny)
   - testy běží v Chromiu bez okna, Google Disk je napodobený (tests/mockDrive.js), nic se neposílá ven
   - snímky obrazovky z testů jsou v tests/shots */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OLD_DIR = ['_zaloha-v2.6.0'].map((d) => path.join(ROOT, d)).find((d) => fs.existsSync(path.join(d, 'index.html')));
/* předchozí verze 3.0.1 na /prev/ (test motivů porovnává Výchozí vzhled s ní, i po aktualizaci bez oranžové tečky) */
const PREV_DIR = ['_zaloha-v3.0.1'].map((d) => path.join(ROOT, d)).find((d) => fs.existsSync(path.join(d, 'index.html')));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const only = process.argv.slice(2);

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let base = ROOT;
  if (p.startsWith('/old/')) { base = OLD_DIR || ROOT; p = p.slice(4); }
  else if (p.startsWith('/prev/') && PREV_DIR) { base = PREV_DIR; p = p.slice(5); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(base, p);
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('nenalezeno'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.listen(0, 'localhost', async () => {
  const port = server.address().port;
  /* localhost (ne 127.0.0.1): stejný původ, jaký používá aplikace při vývoji */
  const env = { ...process.env, UK_BASE: `http://localhost:${port}/`, UK_OLD: `http://localhost:${port}/old/`, UK_PREV: PREV_DIR ? `http://localhost:${port}/prev/` : '' };
  const results = [];
  /* testy běží jako samostatné procesy; asynchronně, aby server v tomto procesu mohl odpovídat */
  const step = (name, cmd, args) => new Promise((resolve) => {
    process.stdout.write(`\n▶ ${name}\n`);
    spawn(cmd, args, { cwd: ROOT, env, stdio: 'inherit' }).on('close', (code) => { results.push([name, code === 0]); resolve(); });
  });
  if (!only.length) await step('Importy mezi moduly', process.execPath, [path.join(ROOT, 'tools/fix-imports.js'), '--check']);
  if (!OLD_DIR) console.log('\n(Složka _zaloha-v2.6.0 chybí, test kompatibility se starou verzí poběží proti současné verzi.)');
  const suites = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).filter((f) => !only.length || only.some((o) => f.includes(o))).sort();
  for (const f of suites) await step(f, process.execPath, [path.join(__dirname, f)]);
  server.close();
  console.log('\n──────── souhrn ────────');
  results.forEach(([n, ok]) => console.log(`${ok ? '✔' : '✘'} ${n}`));
  const bad = results.filter((r) => !r[1]).length;
  console.log(bad ? `\n${bad} z ${results.length} selhalo` : '\nVšechno prošlo');
  process.exit(bad ? 1 : 0);
});
