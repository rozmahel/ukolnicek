# Úkolníček

Poznámky, úkoly a (volitelně) školní rozvrh a známky na jednom místě. Úkolníček je statická webová aplikace: běží celá v prohlížeči, funguje offline, dá se nainstalovat na plochu (PWA) a data si můžeš zálohovat na vlastní Google Disk. Žádný server ani účet u třetí strany nepotřebuje.

- **Stránky a bloky** jako v sešitu: nadpisy, odrážky, úkoly, tabulky (i s úkoly v buňkách), zvýraznění, odkazy, obrázky, podstránky. Nabídka bloků přes `/`, sbalování sekcí, zpět a znovu.
- **Úkoly ze všech stránek** v jednom přehledu. Datum v textu úkolu (třeba `5.10.`) se stane termínem.
- **Stránka Dnes** s blížícími se termíny a stavem úkolů.
- **Školní režim** (zapíná se v nastavení): týdenní rozvrh, Index předmětů po semestrech s body, známkami A–F a kredity, týden výuky (lichý a sudý) a nadpisy s předměty v poznámkách (`/předmět`).
- **Zámek** (⌘⇧L), aby se nic nepřesunulo ani nesmazalo omylem.
- **Barevné motivy** (Výchozí, Papír, Les), každý ve světlé i tmavé variantě, velikost písma 100–160 %.

Podrobný návod je přímo v aplikaci: **Nastavení → Návod a novinky** (soubor `navod.html`).

---

## Kde jsou data

- Všechno se ukládá **v prohlížeči zařízení** (IndexedDB). Aplikace funguje i bez internetu.
- Každé zařízení a každý prohlížeč má vlastní data. Mezi zařízeními je přeneseš přes Google Disk, nebo exportem a importem souboru (viz níže).
- Na Google Disk se data ukládají do **skryté složky aplikace**. Nikdo jiný k nim nemá přístup a Úkolníček nevidí ostatní soubory na tvém Disku.
- Obrázky zůstávají jen v zařízení, kde jsi je vložil. Do zálohy jde jen jejich název, na jiném zařízení se místo nich ukáže rámeček s názvem.
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
6. V Úkolníčku: **Nastavení → Synchronizace** → vlož Client ID (volitelně i e-mail účtu Google, aby se nenabízel výběr účtu) → **Přihlásit k Disku**.

Při prvním přihlášení Google upozorní, že aplikace není ověřená. U vlastní aplikace v režimu Testing je to normální: **Pokračovat** (případně *Advanced → Go to Úkolníček*) a povol přístup k datům aplikace.

Client ID není tajný klíč, bezpečnost hlídá seznam povolených adres a testovacích uživatelů. Přihlášení platí asi hodinu, potom stačí jedno klepnutí na obnovení. Token se ukládá jen v prohlížeči.

## 4. Záloha a přenos dat

### Google Disk
- **↑ Nahrát** (ručně) uloží aktuální stav jako novou zálohu. Na Disku se drží posledních 10 verzí.
- **↓ Stáhnout** nahradí data v zařízení zálohou z Disku: buď rovnou nejnovější, nebo vybranou z posledních 10 (podle nastavení).
- **Po otevření aplikace** se novější verze z Disku stáhne sama, když v zařízení nemáš neuložené změny. Když se změnilo obojí, aplikace se zeptá: verze z Disku, tvoje, nebo obě spojené. Jde to vypnout v **Nastavení → Synchronizace**.
- Mráček v levém panelu (na mobilu nahoře):
  - **šedý přeškrtnutý**: Disk není připojený,
  - **žlutý**: přihlášení vypršelo, obnoví ho první klepnutí do aplikace,
  - **zelený**: připojeno,
  - **oranžová tečka**: máš změny, které ještě nejsou na Disku.

### Co se děje při stažení, a jak se vrátit
- Před každým stažením z Disku (i automatickým), obnovením nebo importem se uloží **místní záloha**. Najdeš je v **Nastavení → Synchronizace → Místní zálohy**, kde je jedním klikem obnovíš.
- Po automatickém stažení je v oznámení tlačítko **Vrátit**.
- Po stažení stačí pokračovat v práci. Až něco změníš, objeví se oranžová tečka a změny nahraješ šipkou ↑.

### Soubor se zálohou (bez Disku)
- **Nastavení → Synchronizace → Exportovat do souboru** stáhne všechna data jako `.json`. Hodí se jako ruční záloha nebo pro přenos na jiné zařízení.
- **Importovat ze souboru…** data ze souboru přidá k těm v zařízení. Stránky, hodiny a předměty se stejným ID přepíše, ostatní nechá, nastavení převezme ze souboru. Před importem se uloží místní záloha.
- Exportovaný soubor obsahuje všechny tvoje poznámky. Nenahrávej ho do veřejného repozitáře.

### Nové zařízení
1. Otevři aplikaci a přidej si ji na plochu.
2. S Diskem: **Nastavení → Synchronizace**, vlož Client ID, přihlas se. Nejnovější záloha se stáhne sama.
3. Bez Disku: na původním zařízení **Exportovat do souboru**, na novém **Importovat ze souboru…**.
4. Obrázky se nepřenášejí. Na novém zařízení je případně vlož znovu.

### Smazání dat
- Jen školní data (předměty, semestry, rozvrh): **Nastavení → Obecné → Smazat školní data**. Poznámky a úkoly zůstanou.
- Všechno v zařízení: smaž v prohlížeči data webu (úložiště) pro adresu aplikace.
- Zálohy na Disku: v Google Disku **Nastavení → Správa aplikací → Úkolníček → Smazat skrytá data aplikace**.

---

## 5. Pro vývojáře

### Soubory

Kód je rozdělený do malých souborů podle oblastí. Prohlížeč je načte sám jako ES moduly, nic se nesestavuje ani nepřekládá.

| Soubor / složka | K čemu je |
|---|---|
| `index.html` | kostra stránky, načte styly a `js/main.js` |
| `css/` | vzhled po oblastech (na pořadí v `index.html` záleží); `themes.css` jsou barevné motivy Papír a Les, Výchozí je v `base.css` |
| `js/main.js` | start aplikace, globální kliknutí a klávesy, Service Worker |
| `js/core.js`, `state.js`, `dates.js`, `ui.js`, `router.js`, `sidebar.js`, `pages.js`, `sanitize.js`, `lock.js` | základ: pomůcky, stav v paměti, data a časy, dialogy a oznámení, přepínání pohledů, levý panel, stránky, čištění HTML, zámek |
| `js/school.js` | školní režim a předměty: výběr předmětu, propojení hodin s předměty, smazání školních dat |
| `js/theme.js` | barevný motiv: čte `settings.theme`, nastavuje `data-skin` na `<html>` a barvu lišty prohlížeče |
| `js/store.js` | ukládání do zařízení, otisk dat („neuloženo na Disk“), kontrola dat zvenku |
| `js/editor/` | editor stránek: vykreslení, klávesy, `/` menu, lišty, menu bloků, odkazy, obrázky, zpět a znovu |
| `js/views/` | pohledy: Dnes, Index, Rozvrh, Úkoly, Hledání, Nastavení |
| `js/sync/` | synchronizace s Google Diskem a spojení dvou verzí při kolizi |
| `js/storage.js` | IndexedDB: data, obrázky, místní zálohy |
| `js/driveSync.js` | přihlášení Google a práce se soubory na Disku |
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

- `npm test`: zkontroluje importy mezi moduly a spustí testy v prohlížeči bez okna (synchronizace s napodobeným Diskem, Úkoly, Index, školní režim, barevné motivy a další). Na Google se nic neposílá. Snímky obrazovky z testů jsou v `tests/shots/`. Test kompatibility se starou verzí potřebuje složku `_zaloha-v2.6.0`, bez ní poběží proti současné verzi. Test motivů porovnává Výchozí vzhled se složkou `_zaloha-v3.0.1` (bez ní se to porovnání přeskočí).
- `npm run fix-imports`: přepočítá řádky `import` a `export` ve všech modulech. Když přesuneš funkci do jiného souboru, stačí ho spustit. Nový modul přidej do seznamu `MODULES` v `tools/fix-imports.js` (určuje pořadí načítání).

### Vydání nové verze

1. Zvyš `VERSION` na začátku `sw.js` a `APP_VERSION` v `js/views/settings.js`. Jinak si zařízení nechají starou verzi z mezipaměti.
2. Nový soubor (třeba další modul v `js/`) přidej do seznamu `ASSETS` v `sw.js`, jinak nebude fungovat offline.
3. Novinku dopiš do `navod.html`: zkopíruj blok `<article class="g-rel new">`, postup je v komentáři na začátku souboru.
4. Pusť `npm test` a nahraj soubory.

Nová verze se v zařízeních nasadí sama, při spuštění nebo návratu do aplikace (stránka se jednou krátce obnoví). Když uživatel zrovna píše nebo má otevřený dialog, objeví se jen lišta **„Je dostupná nová verze – Obnovit“**.

### Formát dat

Data jsou jeden JSON: `pages`, `events`, `settings`, a když jsou použité, i `subjects` a `semesters`.

- **Stránka:** `{id, title, icon, color, parent, order, props, blocks}`. Blok má `id`, `type` (`p`, `h1`–`h3`, `bullet`, `num`, `todo`, `quote`, `callout`, `table`, `divider`, `page`, `image`, `subj`) a `html`. Nadpis může mít `collapsed`, `until` (blok, po který se sbaluje) a `untilVis` (ten blok zůstane vidět).
- **Blok předmětu** (`subj`): `subj` (ID předmětu), `html` (textová kopie názvu pro starší verze), volitelně `icon`, `it`, `un`, `st`, `hl` (emoji a formát nadpisu).
- **Hodina v rozvrhu:** `{id, title, type, day, start, end, repeat, date, count, place, who, note, color, subj}`. Prázdné `color` u hodiny s předmětem znamená barvu podle předmětu.
- **Předmět:** `{id, code, name, credits, sem, end, color, pts, parts:[{id, name, max, pts}], passed, note}`. **Semestr:** `{id, name, target, order}`, volitelně `noStats` (nepočítat do souhrnu) a `hidden` (neukazovat v seznamu Indexu).
- `settings.school` je v datech jen tehdy, když je školní režim zapnutý.
- `settings.theme` (`paper` nebo `forest`) je v datech jen tehdy, když si uživatel vybral jiný barevný motiv než Výchozí. Neznámá hodnota (třeba z novější verze) se bere jako Výchozí a v datech zůstane. Režim světlý / tmavý a velikost textu v datech nejsou, jsou jen v zařízení (`uk-theme`, `uk-fs`). Kopie motivu `uk-skin` v zařízení slouží jen k tomu, aby se motiv nastavil hned při startu, bez poblikání.
- Data zvenku (import, Disk, záloha) se před použitím kontrolují, takže podvržený soubor nemůže v aplikaci spustit kód.
- Otisk dat (oranžová tečka) nepočítá sbalení nadpisů ani časy úprav. Nové klíče se do dat přidávají jen při použití, takže starší zálohy se načtou beze změny.

### Historie verzí

Podrobný přehled změn je v `navod.html` (v aplikaci: Nastavení → Návod a novinky → Novinky).
