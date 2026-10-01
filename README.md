# Úkolníček

Školní poznámky, úkoly a rozvrh na jednom místě. Běží jako statická webová aplikace na GitHub Pages, funguje offline (PWA) a data si umí ručně zálohovat na tvůj Google Disk.

## Soubory

| Soubor | K čemu je |
|---|---|
| `index.html` | kostra stránky |
| `style.css` | vzhled |
| `app.js` | celá aplikace (stránky, editor, rozvrh, úkoly, nastavení) |
| `storage.js` | ukládání v prohlížeči (IndexedDB): data, obrázky, místní zálohy |
| `driveSync.js` | přihlášení Google a práce se soubory na Disku |
| `navod.html` | návod a novinky (zobrazuje se v Nastavení) |
| `sw.js` | Service Worker: offline režim a nabídka nové verze |
| `manifest.webmanifest`, `icons/` | instalace na plochu |
| `import-z-claude.json` | tvoje data z Claude verze k importu (po importu ho klidně smaž, **do repozitáře ho nenahrávej**) |

## Novinky

Přehled změn a návod jsou v souboru **`navod.html`** (v aplikaci: Nastavení → Návod a novinky). Novou novinku přidáš zkopírováním bloku `<article class="g-rel new">` – postup je popsaný v komentáři na začátku souboru.

## Co umí verze 2.1

- **Zámek** 🔒 vedle šipek zpět/vpřed (zkratka ⌘⇧L): skryje tečky, plusy, přidávání a mazání bloků, řádků a sloupců. Psaní, zaškrtávání a rozvrh fungují dál. Pamatuje si ho každé zařízení zvlášť.
- **Mini kalendář** v levém panelu pod číslem týdne (dny v týdnu, volitelně čísla týdnů v roce). Zapíná se v Nastavení, klik na den otevře jeho týden v rozvrhu.
- **Rozvrh – pevný počet opakování** (např. 4×), počítá se po týdnech od zvoleného data.
- **Rozvrh – souběžné události**: najeď na pravý kraj hodiny a klikni na ＋, obě se zobrazí vedle sebe.
- **Návod** v Nastavení.

## 1. Vyzkoušení na počítači

Service Worker a přihlášení Google nefungují z otevřeného souboru (`file://`), je potřeba malý server:

```bash
cd ~/Documents/ukolnicek-webovka
python3 -m http.server 8000
```

Pak otevři `http://localhost:8000`.

## 2. Zveřejnění na GitHub Pages

1. Na GitHubu vytvoř repozitář `ukolnicek` (může být veřejný, žádná tajemství v něm nejsou).
2. Nahraj do něj obsah této složky **kromě `import-z-claude.json`** (a `.DS_Store`).
3. V repozitáři: **Settings → Pages → Build and deployment → Deploy from a branch**, větev `main`, složka `/ (root)`.
4. Za minutu poběží na `https://rozmahel.github.io/ukolnicek/`.

Instalace na plochu: v Safari na iPhonu **Sdílet → Přidat na plochu**, v Chrome ikona instalace v adresním řádku.

## 3. Nastavení Google Disku (jednorázově)

Názvy položek v Google Cloud Console se občas mění, ale postup je takový:

1. Otevři [console.cloud.google.com](https://console.cloud.google.com) a vytvoř nový projekt, např. `Ukolnicek`.
2. **APIs & Services → Library** → vyhledej **Google Drive API** → **Enable**.
3. **OAuth consent screen** (v novější konzoli **Google Auth Platform**):
   - typ aplikace **External**, název `Úkolníček`, tvůj e-mail jako kontakt,
   - stav nech **Testing** (vývojářský režim),
   - v **Test users / Audience** přidej svůj Gmail (jen přidaní uživatelé se mohou přihlásit),
   - v **Scopes / Data access** přidej `https://www.googleapis.com/auth/drive.appdata`.
4. **Credentials / Clients → Create credentials → OAuth client ID**:
   - typ **Web application**,
   - **Authorized JavaScript origins**: `https://rozmahel.github.io` a pro testování `http://localhost:8000`,
   - Redirect URI nejsou potřeba.
5. Zkopíruj **Client ID** (končí `.apps.googleusercontent.com`).
6. V Úkolníčku: **Nastavení → Synchronizace** → vlož Client ID (a volitelně e-mail účtu Google, aby se nenabízel výběr účtu) → **Přihlásit k Disku**.

Při prvním přihlášení Google ukáže varování, že aplikace není ověřená. To je u vlastních aplikací v režimu Testing normální: **Pokračovat** (případně *Advanced → Go to Úkolníček*). Pak povol přístup k datům aplikace na Disku.

Client ID není tajný klíč, bezpečnost hlídá seznam povolených adres a testovacích uživatelů v Google Cloud. Přihlašovací token se ukládá jen v tvém prohlížeči.

## 4. Jak funguje synchronizace

- Data se průběžně ukládají **v zařízení** (IndexedDB). Aplikace funguje i bez internetu.
- Synchronizace s Diskem je **ruční**:
  - **↑ Nahrát** uloží aktuální stav jako nový soubor `ukolnicek_RRRR-MM-DDTHH-MM-SS.json` do skryté složky aplikace. Na Disku se drží posledních 10 verzí, starší se mažou.
  - **↓ Stáhnout** nabídne seznam verzí a vybranou nahradí data v zařízení. Současný stav se předtím uloží do **Nastavení → Místní zálohy** (posledních 5).
- Když se chystáš nahrát, ale na Disku je novější verze z jiného zařízení, aplikace se zeptá, jestli ji nechceš nejdřív stáhnout.
- Mráček v levém panelu (na mobilu v horní liště):
  - **šedý přeškrtnutý**: Disk není připojený,
  - **žlutý**: přihlášení vypršelo (token od Googlu platí asi hodinu), klepni a připoj se znovu,
  - **zelený**: připojeno, u něj čas poslední synchronizace,
  - **oranžová tečka**: máš změny, které nejsou na Disku. Tečka u ↓ znamená, že na Disku je novější verze.
- Skrytou složku aplikace na Disku běžně nevidíš. Smazat ji jde v Disku přes **Nastavení → Správa aplikací → Úkolníček → Smazat skrytá data aplikace**.

### Obrázky

Obrázky se ukládají jen v zařízení, kde byly vloženy. Do zálohy na Disku jde jen jejich ID a název. Na jiném zařízení se místo nich ukáže rámeček *„název – obrázek není zálohovaný“*. Na původním zařízení zůstanou i po stažení zálohy.

## 5. Přechod z Claude verze

1. Spusť Úkolníček (lokálně nebo na GitHub Pages).
2. **Nastavení → Importovat ze souboru…** → vyber `import-z-claude.json`.
3. Obrázky z Claude verze se nepřenesou (jsou uložené u Claude), ukážou se jako rámeček. Vlož je znovu.

## 6. Vydání nové verze

Když změníš jakýkoli soubor, **zvyš `VERSION` na začátku `sw.js`** (např. `ukolnicek-v2.1.1`) a v `app.js` případně `APP_VERSION`. Jinak si zařízení nechají starou verzi z mezipaměti. Po nahrání na GitHub se nová verze nasadí sama: při spuštění nebo návratu do aplikace (stránka se jednou krátce obnoví), případně když aplikaci schováš. Jen když zrovna píšeš nebo máš otevřený dialog, objeví se lišta **„Je dostupná nová verze – Obnovit“**.
