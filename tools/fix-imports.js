#!/usr/bin/env node
/* Úkolníček – přepočítá importy a exporty všech modulů v js/.
   Použití (ve složce projektu):  node tools/fix-imports.js        → přepíše soubory
                                  node tools/fix-imports.js --check → jen zkontroluje (pro testy)
   - importy = jména, která modul používá a jsou deklarovaná v jiném modulu
   - exporty = jména, která ostatní moduly opravdu používají (+ funkce označené `export function`)
   - hlásí zápis do importované proměnné (v ES modulech nejde, je potřeba setter)
   - pořadí importů drží MODULES níže; určuje pořadí spouštění modulů (main.js je poslední) */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const eslintScope = require('eslint-scope');

const ROOT = path.resolve(__dirname, '..');
const JS = path.join(ROOT, 'js');
const CLASSIC = new Set(['storage.js', 'driveSync.js']); /* klasické skripty (window.Local, window.DriveSync) */
const MODULES = [
  'core.js', 'state.js', 'lock.js', 'store.js', 'editor/history.js', 'dates.js', 'pages.js', 'school.js', 'sanitize.js',
  'editor/caret.js', 'sidebar.js', 'router.js', 'editor/render.js', 'editor/blocks.js', 'editor/slash.js',
  'editor/keys.js', 'editor/events.js', 'editor/toolbar.js', 'ui.js', 'editor/menus.js', 'views/schedule.js',
  'views/subjects.js', 'views/tasks.js', 'views/today.js', 'views/search.js', 'views/settings.js', 'sync/sync.js',
  'sync/merge.js', 'editor/links.js', 'editor/images.js', 'main.js'
];
const check = process.argv.includes('--check');

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(JS).filter((f) => f.endsWith('.js')).map((f) => path.relative(JS, f).split(path.sep).join('/')).filter((f) => !CLASSIC.has(f));
const order = [...MODULES.filter((m) => files.includes(m)), ...files.filter((f) => !MODULES.includes(f)).sort()];
const missing = MODULES.filter((m) => !files.includes(m));
if (missing.length) console.warn('chybí moduly:', missing.join(', '));

const mods = {};
for (const f of order) {
  const orig = fs.readFileSync(path.join(JS, f), 'utf8');
  /* závěrečný seznam exportů se vždy přepočítá – odstranit ho předem (může obsahovat už neexistující jména) */
  const src = orig.replace(/\n*export \{[^}]*\};?\s*$/, '\n');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true, locations: true });
  /* hlavička = komentáře před prvním příkazem */
  const first = ast.body[0];
  const header = first ? src.slice(0, first.range[0]).replace(/\s+$/, '') : src;
  /* tělo = vše za posledním importem až po závěrečné `export { … }` (komentáře mezi tím zůstanou) */
  const imps = ast.body.filter((st) => st.type === 'ImportDeclaration');
  const tail = ast.body[ast.body.length - 1];
  const hasList = tail && tail.type === 'ExportNamedDeclaration' && !tail.declaration && !tail.source;
  if (ast.body.some((st, i) => st.type === 'ExportNamedDeclaration' && !st.declaration && i !== ast.body.length - 1)) throw new Error(f + ': `export { … }` musí být jen na konci');
  const start = imps.length ? imps[imps.length - 1].range[1] : (first ? first.range[0] : 0);
  const body = src.slice(start, hasList ? tail.range[0] : src.length);
  const explicit = new Set();
  for (const st of ast.body) if (st.type === 'ExportNamedDeclaration' && st.declaration) {
    const d = st.declaration; if (d.id) explicit.add(d.id.name); if (d.declarations) d.declarations.forEach((x) => x.id.name && explicit.add(x.id.name));
  }
  /* rozbor rozsahů na textu bez importů/exportů */
  const bodyAst = acorn.parse(body.replace(/^export (function|const|let|async function)/gm, '$1'), { ecmaVersion: 'latest', sourceType: 'module', ranges: true, locations: true });
  const sm = eslintScope.analyze(bodyAst, { ecmaVersion: 2022, sourceType: 'module' });
  const ms = sm.globalScope.childScopes.find((s) => s.type === 'module');
  mods[f] = { src: orig, header, body, explicit, decl: new Set(ms.variables.map((v) => v.name)), through: ms.through };
}
const owner = {}; let errors = 0;
for (const f of order) for (const n of mods[f].decl) { if (owner[n]) { console.error(`✘ ${n} je deklarované v ${owner[n]} i v ${f}`); errors++; } owner[n] = f; }
const used = {}; /* f → jména, která z něj ostatní používají */
for (const f of order) {
  const M = mods[f]; M.imports = {};
  for (const ref of M.through) {
    const n = ref.identifier.name, o = owner[n]; if (!o || o === f) continue;
    (M.imports[o] = M.imports[o] || new Set()).add(n); (used[o] = used[o] || new Set()).add(n);
    if (ref.isWrite()) { console.error(`✘ ${f}: zápis do importované proměnné ${n} (z ${o}), řádek ${ref.identifier.loc.start.line}`); errors++; }
  }
}
const rel = (from, to) => { let r = path.relative(path.dirname(from), to).split(path.sep).join('/'); return r.startsWith('.') ? r : './' + r; };
let changed = 0;
for (const f of order) {
  const M = mods[f];
  const imp = order.filter((o) => M.imports[o]).map((o) => `import { ${[...M.imports[o]].sort((a, b) => a.localeCompare(b)).join(', ')} } from '${rel(f, o)}';`);
  const exp = [...(used[f] || [])].filter((n) => !M.explicit.has(n)).sort((a, b) => a.localeCompare(b));
  const out = (M.header ? M.header + '\n' : '') + (imp.length ? imp.join('\n') + '\n\n' : '\n') + M.body.trim() + '\n' + (exp.length ? `\nexport { ${exp.join(', ')} };\n` : '');
  if (out !== M.src) { changed++; if (!check) fs.writeFileSync(path.join(JS, f), out); else console.error(`✘ ${f}: importy/exporty nejsou aktuální`); }
}
if (check) { if (errors || changed) process.exit(1); console.log('importy v pořádku'); }
else console.log(errors ? `${errors} chyb` : 'hotovo', changed ? `(upraveno ${changed} souborů)` : '(beze změny)');
process.exit(errors ? 1 : 0);
