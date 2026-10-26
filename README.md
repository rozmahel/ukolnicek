# Úkolníček

Poznámky, úkoly a (volitelně) školní rozvrh a známky na jednom místě. Úkolníček je statická webová aplikace: běží celá v prohlížeči, funguje offline, dá se nainstalovat na plochu (PWA) a data si můžeš zálohovat na vlastní Google Disk. Žádný server ani účet u třetí strany nepotřebuje.

- **Stránky a bloky** jako v sešitu: nadpisy, odrážky, úkoly, tabulky (i s úkoly v buňkách), zvýraznění, odkazy, obrázky, podstránky. Nabídka bloků přes `/`, sbalování sekcí, zpět a znovu.
- **Úkoly ze všech stránek** v jednom přehledu. Datum v textu úkolu (třeba `5.10.`) se stane termínem.
- **Stránka Dnes** jako nástěnka z widgetů (hodiny, rozvrh dnes a zítra, termíny, stav úkolů) ve třech velikostech, s rozložením zvlášť pro telefon a počítač.
- **Školní režim** (zapíná se v nastavení): týdenní rozvrh, Index předmětů po semestrech s body, známkami A–F a kredity, týden výuky (lichý a sudý) a nadpisy s předměty v poznámkách (`/předmět`).
- **Zámek** (⌘⇧L), aby se nic nepřesunulo ani nesmazalo omylem.
- **Barevné motivy** (Výchozí, Papír, Les, Mlha, Šípek, Levandule), každý ve světlé i tmavé variantě, velikost písma 100–160 %.

Podrobný návod je přímo v aplikaci: **Nastavení → Návod a novinky** (soubor `navod.html`).

---

## Kde jsou data

- Všechno se ukládá **v prohlížeči zařízení** (IndexedDB). Aplikace funguje i bez internetu.
- Každé zařízení a každý prohlížeč má vlastní data. Mezi zařízeními je přeneseš přes Google Disk, nebo exportem a importem souboru (viz níže).
- Na Google Disk se data ukládají do **skryté složky aplikace**. Nikdo jiný k nim nemá přístup a Úkolníček nevidí ostatní soubory na tvém Disku.
- Obrázky jsou na Disku zvlášť, každý jako samostatný soubor `ukimg_<ID>` ve stejné skryté složce. Text je zná jen podle ID. Dokud obrázek v zařízení není, ukáže se místo něj rámeček s názvem.
- Safari na iPhonu umí smazat data webu, který se 7 dní nepoužívá a **není přidaný na plochu**. Přidej si proto Úkolníček na plochu, nebo pravidelně zálohuj.

---

## 1. Spuštění na počítači

Přihlášení Google a offline režim nefungují ze souboru otevřeného dvojklikem (`file://`). Je potřeba malý místní server. Stačí Python 3 (na macOS a Linuxu bývá předinstalovaný):

```bash
cd cesta/ke/slozce/ukolnicek
python3 tools/serve.py
```

Pak otevři `http://localhost:8000`. Server posílá soubory bez ukládání do mezipaměti, takže se každá změna projeví po obyčejném obnovení stránky.

- Na `localhost` se Service Worker (offline režim) záměrně vypíná, aby se nenačítaly staré soubory. Vyzkoušet ho jde i tady: v konzoli prohlížeče zadej `localStorage.setItem('uk-dev-sw','true')` a obnov stránku.
- Data na `localhost` jsou oddělená od zveřejněné verze (jiná adresa = jiné úložiště v prohlížeči). Když se tady přihlásíš ke stejnému Google Disku, stáhnou se tvoje data. Co odtud nahraješ, uvidí po otevření i tvoje ostatní zařízení.

## 2. Zveřejnění na GitHub Pages

1. Na GitHubu vytvoř repozitář, třeba `ukolnicek`. Může být veřejný, žádná tajemství v kódu nejsou.
2. Nahraj do něj obsah této složky. **Nenahrávej** zálohy (`_zaloha-*`), `node_modules`, `tests/shots`, `.DS_Store` ani exportované soubory s daty (`*.json` se zálohou). Složky `tools/` a `tests/` a soubor `package.json` aplikace nepotřebuje, ale nevadí.
3. V repozitáři: **Settings → Pages → Build and deployment → Deploy from a branch**, větev `main`, složka `/ (root)`.
4. Za chvíli aplikace poběží na `https://TVOJE-JMENO.github.io/ukolnicek/`.

Instalace na plochu: v Safari na iPhonu **Sdílet → Přidat na plochu**, v Chromu ikona instalace v adresním řádku.

Funguje to na jakémkoli statickém hostingu (Netlify, Cloudflare Pages, vlastní server). Podmínkou je HTTPS.

## 3. Nastavení Google Disku (jednorázově, nepovinné)

Bez Disku Úkolníček funguje normálně, jen se data nepřenášejí mezi zařízeními automaticky. Každý, kdo si aplikaci zveřejní sám, potřebuje vlastní **Client ID** od Googlu. Názvy položek v Google Cloud Console se občas mění, postup je ale takový:

1. Otevři [console.cloud.google.com](https://console.cloud.google.com) a vytvoř nový projekt, např. `Ukolnicek`.
2. **APIs & Services → Library** → vyhledej **Google Drive API** → **Enable**.
3. **OAuth consent screen** (v novější konzoli **Google Auth Platform**):
   - typ aplikace **External**, název `Úkolníček`, tvůj e-mail jako kontakt,
   - stav nech **Testing**,
   - v **Test users / Audience** přidej účty Google, které se mají přihlašovat (jen ty se přihlásí, v režimu Testing až 100 lidí),
   - v **Scopes / Data access** přidej `https://www.googleapis.com/auth/drive.appdata` (jen skrytá složka aplikace).
4. **Credentials / Clients → Create credentials → OAuth client ID**:
   - typ **Web application**,
   - **Authorized JavaScript origins**: adresa, kde aplikace běží (např. `https://tvoje-jmeno.github.io`), a pro zkoušení `http://localhost:8000`,
   - Redirect URI nejsou potřeba.
5. Zkopíruj **Client ID** (končí `.apps.googleusercontent.com`).
6. V Úkolníčku: **Nastavení → Google Disk** → vlož Client ID (volitelně i e-mail účtu Google, aby se nenabízel výběr účtu) → **Přihlásit k Disku**.

Při prvním přihlášení Google upozorní, že aplikace není ověřená. U vlastní aplikace v režimu Testing je to normální: **Pokračovat** (případně *Advanced → Go to Úkolníček*) a povol přístup k datům aplikace.

Client ID není tajný klíč, bezpečnost hlídá seznam povolených adres a testovacích uživatelů. Přihlášení platí asi hodinu, potom stačí jedno klepnutí na obnovení. Token se ukládá jen v prohlížeči.

## 4. Záloha a přenos dat

### Google Disk
- **↑ Nahrát** (ručně) uloží aktuální stav jako novou zálohu. Na Disku se drží posledních 10 verzí. Délka nahrání se zapíše k souboru (`appProperties.dur` v ms, `dev` = zařízení) a ukáže se v seznamu verzí vlevo od velikosti.
- **Spojení obou verzí** při kolizi jde po stránkách a uvnitř stránky změněné na obou místech po blocích (podle ID bloku a společného základu). Dvakrát zůstane jen blok upravený na obou místech; když se na obou změnila stejná vlastnost stránky (třeba název), zůstane stránka dvakrát jako dřív.
- **↓ Stáhnout** nahradí data v zařízení zálohou z Disku: buď rovnou nejnovější, nebo vybranou z posledních 10 (podle nastavení).
- **Po otevření aplikace** se novější verze z Disku stáhne sama, když v zařízení nemáš neuložené změny. Když se změnilo obojí, aplikace se zeptá: verze z Disku, tvoje, nebo obě spojené. Jde to vypnout v **Nastavení → Google Disk**.
- Mráček v levém panelu (na mobilu nahoře):
  - **šedý přeškrtnutý**: Disk není připojený,
  - **žlutý**: přihlášení vypršelo, obnoví ho první klepnutí do aplikace,
  - **zelený**: připojeno,
  - **oranžová tečka**: máš změny, které ještě nejsou na Disku,
  - **žlutý vykřičník** vedle mráčku: obrázky čekají na nahrání, chybí v tomto zařízení nebo čekají na smazání z Disku (klik otevře Nastavení → Google Disk).
- **Obrázky:** ↑ nahraje nejdřív nové obrázky (jen ty, které na Disku nejsou) a pak text. ↓ i automatické stažení po otevření doplní obrázky, které v zařízení chybí. Když se přenos přeruší, příště se pokračuje dalším obrázkem a text se nahraje i tak. Na mobilních datech se před stažením víc než 5 MB zeptá (automatické stažení počká). Obrázek, na který nahraný text už neodkazuje, se z Disku smaže, ale jen pokud tam byl už před poslední verzí textu, kterou zařízení vidělo, takže se nesmaže čerstvý obrázek z jiného zařízení. V zařízení se obrázky nemažou nikdy. Přenos obrázků přes ↑/↓ jde vypnout (Nastavení → Google Disk → Obrázky, jen pro toto zařízení), tlačítka pro samotné obrázky tam fungují vždy.

### Co se děje při stažení, a jak se vrátit
- Před každým stažením z Disku (i automatickým), obnovením nebo importem se uloží **místní záloha**. Najdeš je v **Nastavení → Zálohy → Místní zálohy**, kde je jedním klikem obnovíš.
- Po automatickém stažení je v oznámení tlačítko **Vrátit**.
- Po stažení stačí pokračovat v práci. Až něco změníš, objeví se oranžová tečka a změny nahraješ šipkou ↑.

### Soubor se zálohou (bez Disku)
- **Nastavení → Zálohy → Exportovat do souboru** stáhne všechna data jako `.json`. Hodí se jako ruční záloha nebo pro přenos na jiné zařízení.
- **Importovat ze souboru…** data ze souboru přidá k těm v zařízení. Stránky, hodiny a předměty se stejným ID přepíše, ostatní nechá, nastavení převezme ze souboru. Před importem se uloží místní záloha.
- Exportovaný soubor obsahuje všechny tvoje poznámky. Nenahrávej ho do veřejného repozitáře.

### Nové zařízení
1. Otevři aplikaci a přidej si ji na plochu.
2. S Diskem: **Nastavení → Google Disk**, vlož Client ID, přihlas se. Nejnovější záloha se stáhne sama.
3. Bez Disku: na původním zařízení **Exportovat do souboru**, na novém **Importovat ze souboru…**.
4. Obrázky přenese jen Disk (stáhnou se samy po textu). Export do souboru obsahuje jen text.

### Smazání dat
- Jen školní data (předměty, semestry, rozvrh): **Nastavení → Škola → Smazat školní data**. Poznámky a úkoly zůstanou.
- Všechno v zařízení: smaž v prohlížeči data webu (úložiště) pro adresu aplikace.
- Zálohy na Disku: v Google Disku **Nastavení → Správa aplikací → Úkolníček → Smazat skrytá data aplikace**.

---

## 5. Pro vývojáře

### Soubory

Kód je rozdělený do malých souborů podle oblastí. Prohlížeč je načte sám jako ES moduly, nic se nesestavuje ani nepřekládá.

| Soubor / složka | K čemu je |
|---|---|
| `index.html` | kostra stránky, načte styly a `js/main.js` |
| `css/` | vzhled po oblastech (na pořadí v `index.html` záleží); `themes.css` jsou barevné motivy Papír, Les, Mlha, Šípek a Levandule, Výchozí je v `base.css` |
| `js/main.js` | start aplikace, globální kliknutí a klávesy, Service Worker |
| `js/core.js`, `state.js`, `dates.js`, `ui.js`, `router.js`, `sidebar.js`, `pages.js`, `sanitize.js`, `lock.js` | základ: pomůcky, stav v paměti, data a časy, dialogy a oznámení, přepínání pohledů, levý panel, stránky, čištění HTML, zámek |
| `js/school.js` | školní režim a předměty: výběr předmětu, propojení hodin s předměty, smazání školních dat |
| `js/views/mindmap.js`, `css/mindmap.css` | myšlenková mapa: plátno, bloky, skupiny, čáry, propojení s projekty a nadpisy H1, zpět/znovu, export/import .canvas (JSON Canvas) |
| `js/trash.js` | koš: smazané stránky a projekty na 7 dní, levý panel koše, náhled ke čtení, obnovení |
| `js/ai.js`, `js/ai/`, `js/editor/aiedit.js`, `js/views/aiset.js`, `css/ai.css` | AI asistent: jediné rozhraní `aiAsk` (`ai.js`), adaptéry poskytovatelů `js/ai/providers/` (Gemini, Claude), prompty a popis formátu (`actions.js`), statistiky v zařízení (`stats.js`), ✦ u výběru (Opravit, Ověřit, Shrnout…), `/shrnutí`, `/ai`, náhled na místě a kontext stránky ✦ v liště (`aiedit.js`), Nastavení → AI (`aiset.js`) |
| `js/theme.js` | barevný motiv a písmo: čte `settings.theme` a `settings.font`, nastavuje `data-skin` a `data-font` na `<html>` a barvu lišty prohlížeče |
| `js/store.js` | ukládání do zařízení, otisk dat („neuloženo na Disk“), kontrola dat zvenku, víc oken najednou (Web Locks + BroadcastChannel, spojení přes `merge.js`) |
| `js/editor/` | editor stránek: vykreslení, klávesy, `/` menu, lišty, menu bloků, odkazy, obrázky, zpět a znovu, výběr textu i celých bloků (`multisel.js`), nabídka @ a zpětné odkazy (`mention.js`), import a export Markdownu (`markdown.js`), zobrazení zdroje (`source.js`), rovnice v LaTeXu (`math.js`), blok s kódem (`code.js`), kreslení (`draw.js`), šířka sloupců a výška řádků tabulky tažením (`tblsize.js`), hlídání textu psaného s Caps Lockem (`caps.js`) |
| `js/views/` | pohledy: Dnes, Index, Rozvrh, Úkoly, Hledání, Nastavení |
| `js/sync/` | synchronizace s Google Diskem (`sync.js`), obrázky na Disku (`images.js`), spojení dvou verzí při kolizi, i po blocích (`merge.js`), statistika nahrávání (`uplog.js`) |
| `js/storage.js` | IndexedDB: data, obrázky, místní zálohy |
| `js/driveSync.js` | přihlášení Google a práce se soubory na Disku |
| `lib/fonts/` | písma aplikace (Bricolage Grotesque, Onest, JetBrains Mono, Literata, Newsreader; SIL OFL 1.1, z balíčků `@fontsource-variable`, jen latin a latin-ext), načítá je `lib/fonts/fonts.css`, offline je drží `sw.js` |
| `lib/katex/` | KaTeX 0.16.22 (MIT) pro vykreslení rovnic: skript, styl a písma `.woff2`; načte se až když je na stránce rovnice, offline ho drží `sw.js` |
| `navod.html` | návod a novinky (zobrazují se v Nastavení) |
| `sw.js` | Service Worker: offline režim a nasazení nové verze |
| `manifest.webmanifest`, `icons/` | instalace na plochu |
| `tools/`, `tests/`, `package.json` | jen pro vývoj: místní server, kontrola importů, automatické testy |

Každý soubor v `js/` začíná komentářem, co v něm je, a nahoře má seznam importů.

### Testy a kontrola importů

Potřebuješ Node.js. Jednou ve složce projektu:

```bash
npm install
npx playwright install chromium
```

Pak:

- `npm test`: zkontroluje importy mezi moduly a spustí testy v prohlížeči bez okna (synchronizace s napodobeným Diskem včetně obrázků, Úkoly, Index, školní režim, barevné motivy, výběr přes víc bloků a přesouvání projektů, import a export Markdownu, rovnice, blok s kódem a „1.“ jako text, hledání a ⌘S, archiv a sbalené úkoly, widgety na Dnes včetně nastavení a rychlého úkolu, menu bloku a výběr víc bloků, ⌘ú/⌘), kurzor za rovnicí, místo na stránce a kopie hodiny v rozvrhu (`tests/blokmenu.test.js`), zkratky a ⌘D, typy rámečku, blok → rovnice, zobrazení zdroje, spojení po blocích, dvě okna, čas nahrání a graf (`tests/novinky43.test.js`), kreslení, koš a mazání vybraných bloků se zámkem (`tests/kresleni.test.js`), obrázky a obtékání v nestandardních případech (`tests/obtekani.test.js`), tažení okrajů tabulky, Enter u sbaleného nadpisu, kopírování kresby, přepínač režimu, graf nahrávání a doba nečinnosti (`tests/novinky46.test.js`), podtržení textu s Caps Lockem a bublina prohodit/nechat (`tests/caps.test.js`), písmo, widget Vzhled, skryté odkazy, kroužky v mini kalendáři a přetahování projektů prstem (`tests/novinky48.test.js`), myšlenková mapa (`tests/mapa.test.js`), AI asistent s napodobeným API Gemini a Claude (`tests/ai.test.js`) a další). Na Google se nic neposílá. Snímky obrazovky z testů jsou v `tests/shots/`. Test kompatibility se starší verzí bere poslední složku `_zaloha-vX.Y.Z`, bez ní poběží proti současné verzi. Test motivů porovnává Výchozí vzhled se složkou `_zaloha-v3.0.1` (bez ní se to porovnání přeskočí).
- `npm run fix-imports`: přepočítá řádky `import` a `export` ve všech modulech. Když přesuneš funkci do jiného souboru, stačí ho spustit. Nový modul přidej do seznamu `MODULES` v `tools/fix-imports.js` (určuje pořadí načítání).

### Vydání nové verze

1. Zvyš `VERSION` na začátku `sw.js` a `APP_VERSION` v `js/views/settings.js`. Jinak si zařízení nechají starou verzi z mezipaměti. Číslo musí vždy růst: `sw.js` odmítne nainstalovat verzi nižší, než už v zařízení je (ochrana proti starým kopiím z CDN GitHub Pages). Návrat ke starší verzi = vydat ji pod vyšším číslem.
2. Nový soubor (třeba další modul v `js/`) přidej do seznamu `ASSETS` v `sw.js`, jinak nebude fungovat offline.
3. Novinku dopiš do `navod.html`: zkopíruj blok `<article class="g-rel new">`, postup je v komentáři na začátku souboru.
4. Pusť `npm test` a nahraj soubory.

Soubory se při instalaci stahují s `?v=verze` (CDN nepošle starou kopii) a ukládají pod adresou bez ní. **Zkontrolovat aktualizace** v Nastavení (`js/update.js`) přečte verzi z `sw.js?check=…` a novější hned nasadí. `uk-ver-max` (jen v zařízení) = nejnovější známá verze; když se načte starší, aplikace si novou stáhne sama.

Nová verze se v zařízeních nasadí sama, při spuštění nebo návratu do aplikace (stránka se jednou krátce obnoví). Když uživatel zrovna píše nebo má otevřený dialog, objeví se jen lišta **„Je dostupná nová verze – Obnovit“**.

### Formát dat

Data jsou jeden JSON: `pages`, `events`, `settings`, a když jsou použité, i `subjects`, `semesters`, `trash` a `maps`.

- **Stránka:** `{id, title, icon, color, parent, order, props, blocks}`, volitelně `archived` (čas archivace v ms; jen u archivované stránky, její podstránky příznak nemají a archivované jsou s ní). Blok má `id`, `type` (`p`, `h1`–`h3`, `bullet`, `num`, `todo`, `quote`, `callout`, `code`, `table`, `divider`, `page`, `image`, `subj`, `eq`) a `html`. Nadpis může mít `collapsed`, `until` (blok, po který se sbaluje) a `untilVis` (ten blok zůstane vidět). Enter na sbaleném nadpisu (i + a klik pod stránku) nastaví `until` na poslední schovaný blok, aby nový řádek nespadl do sbalené sekce; prázdná sbalená sekce se rozbalí.
- **Tabulka** (`table`): `rows:[{cells:[{lines:[{t,html,done}]}]}]`, volitelně `hrow`, `hcol`, `cw` (šířky všech sloupců v px, po prvním tažení okraje; tabulka má pak `table-layout:fixed` a šířku = součet) a `rh` (výšky řádků v px, `null` = podle obsahu, jen do posledního nastaveného). Starší verze je ignorují.
- **Blok předmětu** (`subj`): `subj` (ID předmětu), `html` (textová kopie názvu pro starší verze), volitelně `icon`, `it`, `un`, `st`, `hl` (emoji a formát nadpisu).
- **Kód** (`code`): `html` je prostý text, řádky oddělené `<br>` (prázdný poslední řádek má `<br>` navíc), znaky `< > &` escapované, žádné značky formátu. Starší verze ho ukážou jako odstavec. Číslovaný seznam vrácený na text si pamatuje jen stránka v paměti (`blocks.js`), do dat se nic nezapisuje.
- **Rovnice na řádku** (`eq`): `html` je zdroj LaTeX jako escapovaný text (žádné HTML z KaTeXu). Starší verze z něj udělají odstavec s textem rovnice.
- **Kresba:** obrázkový blok (`image`) s `draw: 1`, `img` je ID souboru SVG v úložišti obrázků (v zařízení i na Disku jako `ukimg_<ID>`), `name` „Kresba“. V SVG je `<metadata id="uk-draw">` s JSONem `{v:1, bg, crop, view:[x,y,w,h], box?:[x,y,w,h] (vlastní ořez), s:[{t:'p'|'f'|'h', c:'#rrggbb', w, p:[x,y,…], r?:[přítlak 0–1]}]}`; aplikace ho při úpravě kontroluje a do stránky SVG nikdy nevkládá. Každá uložená úprava = nový soubor s novým ID, starý zůstane bez odkazu a ↑ ho smaže z Disku jako smazaný obrázek. Uložený soubor je vždy denní (bílý papír), tmavý režim ho převrací filtrem v `css/draw.css`. Starší verze kresbu ukáží jako obyčejný obrázek a příznak `draw` zachovají. Předvolby nástrojů jsou jen v zařízení (`uk-draw`).
- **Obrázek bez obtékání:** obrázkový blok (i kresba) může mít `nw: 1` = zarovnaný vlevo/vpravo, ale na vlastním řádku (bez `nw` se obtéká jako dřív, ukládá se jen když je zapnuté). Obrázek v textu má třídu `im al-left nw`.
- **Obtékání (4.5.0):** blok s `clr: 1` začne pod obtékaným obrázkem (konec obtékání, ukládá se jen když je zapnuté). Nový obrázek vložený do textu má třídu `im al-inline`; obtékání ho převede na obrázkový blok před odstavcem. Poměr stran obrázků je jen v zařízení (`localStorage` `uk-img-ar`, ID → šířka/výška), do dat se nezapisuje.
- **Myšlenkové mapy** (`maps`): `{ID: {id, title, icon, order, nodes, edges}}` (`icon` = smajlík, jen když je nastavený). Uzel `{id, k: card|text|group, x, y, w, h, text, label, color, page, hid}` (`page` = propojená stránka, `hid` = ID bloku H1/předmětu), čára `{id, from, to, end (chybí = šipka, both, none), color, label}`; barvy red/orange/yellow/green/blue/purple. Do dat se mapa dostane až první změnou, zapnutí je `settings.mindmap`. Posun a přiblížení (`uk-mm-v`) a otevřená mapa (`uk-mm-cur`) jsou jen v zařízení. Při spojení verzí se mapa bere jako celek (změněná na obou = kopie). Starší verze klíč `maps` zahodí.
- **Koš** (`trash`): `{ID kořenové stránky: {id, at, pages:[kořen, podstránky…]}}`, `at` = čas smazání v ms, po 7 dnech se položka smaže sama (při spuštění a návratu do aplikace). Stránky v koši nejsou v `pages`, takže je hledání, Úkoly ani Dnes nevidí. Starší verze klíč `trash` zahodí. Při spojení verzí: stránka smazaná na jedné straně a upravená na druhé zůstane a vrátí se z koše i s podstránkami.
- **Hodina v rozvrhu:** `{id, title, type, day, start, end, repeat, date, count, place, who, note, color, subj}`. Prázdné `color` u hodiny s předmětem znamená barvu podle předmětu.

- **Rovnice v textu:** `<span class="eq" contenteditable="false">TeX</span>` uvnitř `html` (i v buňce tabulky). Uvnitř je jen zdroj LaTeX, vykreslení je ve shadow DOM a do dat se nedostane. Starší verze ukáží TeX jako text.
- **Odkaz v textu (@):** `<a class="mention" data-page="ID">` nebo `data-subj="ID"` uvnitř `html` bloku (i v buňce tabulky). Text je kopie názvu, při vykreslení se obnoví. Starší verze ho ukáží jako obyčejný text. Datum z @ je obyčejný text „12. 10.“.
- **Skrytý odkaz na stránku (od 4.8.0):** `<a class="hlnk" data-hp="ID">text</a>` uvnitř `html`. Vypadá jako text, dvojklik nebo ⌘/Ctrl + klik přejde na stránku (`openHiddenLink` v `js/editor/links.js`). Počítá se do Odkazuje sem. Do Markdownu (i zobrazení zdroje) jde jen text. Starší verze odkaz při úpravě bloku zahodí, text zůstane.
- **Předmět:** `{id, code, name, credits, sem, end, color, pts, parts:[{id, name, max, pts}], passed, note}`. `passed` (zápočet udělen) platí pro všechna ukončení a je podmínkou známky; u ukončení `z` se body nezadávají. **Semestr:** `{id, name, target, order}`, volitelně `noStats` (nepočítat do souhrnu) a `hidden` (neukazovat v seznamu Indexu).
- `settings.taskHidden` (projekty skryté v Úkolech) je v datech jen tehdy, když je něco skryté: pole ID kořenových stránek, hodnota `_due` znamená skrytou sekci S termínem. Sbalené sekce v Úkolech jsou jen v zařízení (`uk-tfold`).
- Místo na stránce (posunutí) je jen v zařízení: `uk-scroll` = `{ID stránky: scrollTop}`. Délka posledního nahrání na Disk je v místních metadatech `META.lastUpDur` (ms), ne v datech. `META.wid` = ID posledního zápisu do IndexedDB (podle něj okno pozná, že mezitím zapsalo jiné okno).
- Statistika nahrávání je jen v zařízení: IndexedDB `kv` → `uplog` = pole `{id, t, b, ms, dev}` (ID souboru na Disku, čas v ms, velikost v B, délka v ms, zařízení). Maže se jen soubor na Disku (po 10), záznamy zůstávají; soubory se známou délkou ze seznamu záloh (i z jiného zařízení) se doplní. Widget `uploads` (Nahrávání na Disk) z nich kreslí dva spojnicové grafy (čas a velikost), bod = jedno nahrání: střední posledních 100, velký všechna (nejvýš 3000, 3,2 px na bod) s posouváním do stran.
- Hlídání Caps Locku je jen v zařízení: vypnutí `uk-caps` = false (výchozí zapnuto se neukládá), úseky ponechané tlačítkem ✓ v `uk-caps-ok` (`ID bloku|text`, nejvýš 200). Podtržení je CSS Highlight `uk-caps`, do dat se nic nezapisuje.
- Doba nečinnosti před automatickým nahráním je jen v zařízení: `uk-auto-sec` (sekundy, 5–7200, výchozí 300 se neukládá), zapnutí `uk-auto-push`.
- Vnitřní schránka bloků je jen v zařízení: `uk-clip` = `{text, blocks}`; uloží se při kopírování, když kopie obsahuje jiný než textový blok (obrázek, kresba, tabulka…). Vložení se stejným textem ve schránce vloží celé bloky (nová ID, stejné soubory obrázků).
- Typy zvýrazněného bloku (Poznámka, Tip, Důležité, Varování, Pozor) jsou jen předvolba `icon` + `color`, v datech nic nového.
- `settings.school` je v datech jen tehdy, když je školní režim zapnutý.
- `settings.dashPc` a `settings.dashMob` (rozložení Dnes pro počítač a pro telefon, tj. okno do 860 px) jsou v datech až po první úpravě rozložení: pole `{id, s, c}` v pořadí skládání, `id` je typ widgetu (`clock`, `sched`, `tomorrow`, `deadlines`, `status`, `week`, `calendar`, `quick`, `study`, `page`, `look`, `data`; dřívější `mentions` a `recent` se ignorují), další kus stejného typu má `id` ve tvaru `typ-xxxxxx`; nepovinné `o` je nastavení widgetu (`page`, `proj`, `sem`), `s` je `s`, `m` nebo `l` (Rychlý úkol jen `s`/`m`, Stránka jen `s`/`l`; jiná uložená velikost se ukáže jako nejbližší povolená), `c` je sloupec zleva od 0 (počítač 4 sloupce, telefon 2; bez `c` se dopočítá). Šířka ve sloupcích plyne z velikosti (`WG[id].w` v `js/views/today.js`). Widget, který v poli chybí, je odebraný. Neznámé `id` se ignoruje.
- `settings.theme` (`paper`, `forest`, `mist`, `rose` nebo `lavender`) je v datech jen tehdy, když si uživatel vybral jiný barevný motiv než Výchozí. Neznámá hodnota (třeba z novější verze) se bere jako Výchozí a v datech zůstane. Režim světlý / tmavý a velikost textu v datech nejsou, jsou jen v zařízení (`uk-theme`, `uk-fs`). Kopie motivu `uk-skin` v zařízení slouží jen k tomu, aby se motiv nastavil hned při startu, bez poblikání.
- `settings.font` (`onest`, `plex`, `system`, `newsreader`, `literata` nebo `sserif`, od 4.8.0) je v datech jen tehdy, když si uživatel vybral jiné písmo než „Podle vzhledu“ (písmo motivu). Neznámá hodnota = Podle vzhledu. Písma jsou v `lib/fonts`, pravidla v konci `css/themes.css`; kopie `uk-font` v zařízení jen kvůli startu.
- `pages.*.aiCtx` (od 4.14.0): kontext pro AI u stránky (text, nejvýš 2000 znaků), jen když je vyplněný. Dědí se na podstránky (`aiCtxOf`), vlastní kontext podstránky ten zděděný přepíše. Spojení verzí ho bere jako ostatní vlastnosti stránky.
- `settings.ai` (od 4.13.0) je v datech jen tehdy, když uživatel nastavil AI: `{provider, models: {gemini|anthropic: model}, keys: {gemini|anthropic: klíč}, style, lang}` (prázdné části chybí, `style` chybí = studijní, `lang` chybí = čeština). Klíče jsou součást dat, takže se přenesou přes Disk a jsou v exportu JSON; v exportu Markdownu nejsou. Při spojení verzí se bere jako celek. Starší verze ho při uložení zachovají. Statistiky dotazů (čas, poskytovatel, model, akce, tokeny, cena) jsou jen v zařízení (`uk-ai-stats`), starší než 30 dní sloučené po dnech.
- Data zvenku (import, Disk, záloha) se před použitím kontrolují, takže podvržený soubor nemůže v aplikaci spustit kód.
- Otisk dat (oranžová tečka) nepočítá sbalení nadpisů ani časy úprav. Nové klíče se do dat přidávají jen při použití, takže starší zálohy se načtou beze změny.

### Historie verzí

Podrobný přehled změn je v `navod.html` (v aplikaci: Nastavení → Návod a novinky → Novinky).
