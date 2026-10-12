# Úkolníček: pokyny pro Clauda

Mini-Notion / školní plánovač v čistém HTML, CSS a JS. Složka `~/Documents/ukolnicek-webovka`. Piš česky, stručně a k věci.

## Pravidla práce (šetření kreditů)
- **Žádné zálohy.** Složky `_zaloha-*` nevytvářej. Zálohy dělám ručně já.
- **Složky `_zaloha-*` ignoruj.** Nečti je, neprohledávej je a nepoužívej je k porovnání, pokud to výslovně neřeknu.
- **Netestuj přehnaně.** Spusť jen test k té části, kterou jsi změnil (např. `node tests/skola.test.js`). Celé `npm test` jen na konci větší změny nebo když o to požádám. Z výpisu mi ukaž jen selhání.
- **Nespouštěj subagenty, ovládání prohlížeče, screenshoty ani hluboký průzkum**, pokud o to nepožádám. Kód si čti sám, jen to, co je potřeba.
- **Čti jen potřebné soubory.** Podle mapy níže jdi rovnou na správný modul. Velké soubory čti po částech.
- **Nepřepisuj celé soubory kvůli malé změně.** Používej cílené úpravy.
- **Dokumentaci aktualizuj jednou na konci úkolu**, ne po každé drobnosti.
- **Na konci stačí 1–3 věty:** co se změnilo a co případně zbývá. Žádný rekapitulační přehled kroků.
- Když je zadání jasné, rovnou ho dělej. Ptej se jen u věcí, které nejdou vyřešit rozumným výchozím postupem.

## Vývoj
- Jen na localhostu (`npm run serve`). **Na GitHub nic nenahrávej**, vydá se to najednou.
- Příkazy: `npm run serve`, `npm test`, `npm run fix-imports` (po přesunu funkcí mezi moduly).
- Nové testy dávej do `tests/` (např. `tests/skola.test.js`), ale jen k nové funkci a v rozumném rozsahu.

## Po dokončení změny
1. Zvýšit verzi: `VERSION` v `sw.js` a `APP_VERSION` v `js/views/settings.js` (obě stejně).
2. Nové soubory přidat do seznamu v `sw.js`.
3. Aktualizovat `navod.html` (návod a novinky) a `README.md` (formát dat, soubory, testy).

## Důležitá pravidla pro data
- Bez použití nových funkcí se tvar JSONu ani otisk dat nesmí změnit (po aktualizaci nesmí naskočit oranžová tečka).
- Nové nastavení se do dat zapisuje až po první změně uživatelem. Výchozí hodnota se neukládá.
- Nový typ bloku přidat do `BLOCK_TYPES` v `js/store.js` a ošetřit ve spojení verzí (`js/sync/merge.js`).
- Režim světlý/tmavý a velikost textu jsou jen v zařízení (`uk-theme`, `uk-fs`), ne v datech.

## Mapa kódu
- **Index (předměty):** `js/views/subjects.js`, `css/index.css`
- **Rozvrh:** `js/views/schedule.js`, `css/schedule.css`
- **Úkoly a Dnes:** `js/views/tasks.js`, `js/views/today.js`
- **Nastavení:** `js/views/settings.js`, `css/settings.css`
- **Hledání:** `js/views/search.js`
- **Menu a přesměrování pohledů:** `js/sidebar.js`, `js/router.js`
- **Editor (bloky, sbalování, lomítkové menu):** `js/editor/render.js`, `blocks.js`, `slash.js`, `menus.js`, dále `js/pages.js`
- **Markdown import/export:** `js/editor/markdown.js`
- **Rovnice (LaTeX):** `js/editor/math.js`, KaTeX v `lib/katex/` (načítá se líně)
- **Výchozí nastavení:** `js/state.js`
- **Ukládání, otisk dat, kontrola dat zvenku:** `js/store.js`
- **Spojení verzí při kolizi:** `js/sync/merge.js`
- **Školní režim, společné věci kolem předmětů:** `js/school.js`
- **Barevné motivy:** `css/themes.css`, `js/theme.js`
- **Základní styly a proměnné:** `css/base.css`

## Stav a známé věci
- Aktuální verze: 3.4.0 (rovnice v `js/editor/math.js` s KaTeXem v `lib/katex/`, inline jako `span.eq` s TeX textem a vykreslením ve shadow DOM, blok typu `eq`; motivy Mlha/Šípek/Levandule s písmy Newsreader a Literata z Google Fonts; hledání skáče na text přes CSS Highlight API v `js/pages.js`; ⌘S nahraje na Disk; oznámení jdou zavřít; lišta formátu na telefonu pod výběrem; test `tests/rovnice.test.js`), předtím 3.3.0 (import .md přes `/markdown` a export stránky do .md tlačítkem u zámku, oboje v `js/editor/markdown.js`, test `tests/markdown.test.js`), předtím 3.2.0 (zápočet jako podmínka známky, výběr přes víc bloků v `js/editor/multisel.js`, přesouvání projektů tažením v `js/sidebar.js`, výběr celých bloků taky v `multisel.js`, nabídka @ a zpětné odkazy v `js/editor/mention.js`), předtím 3.1.1 (nastavení po kategoriích Obecné/Vzhled/Škola/Google Disk/Zálohy, posuvníky v barvách motivu), navazuje 3.1.0 (barevné motivy).
- `tests/skola.test.js`, krok 11 selhává, protože chybí složka `_zaloha-v2.6.0`. Je to známé, **neřeš to a nezkoumej to**, dokud neřeknu.
- Čtyři záměrně ztlumená místa pod kontrastem 4,5:1 (dny mimo měsíc a víkendová záhlaví v mini kalendáři, tlačítko Skrýt u úkolů) nech být.
