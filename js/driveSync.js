/* Úkolníček – synchronizace s Google Diskem
   - přihlášení přes Google Identity Services (token platí zhruba 1 hodinu)
   - data leží ve skryté složce aplikace (appDataFolder), soubory ukolnicek_RRRR-MM-DDTHH-MM-SS.json
   - nahrání = nový soubor, drží se posledních 10; stažení = vybraná verze
   - obrázky jako samostatné soubory ukimg_<ID> (listImages, uploadImage, downloadImage)
   - latest() = lehký dotaz jen na nejnovější soubor (název a čas na serveru Googlu), pro kontrolu při spuštění */
(function () {
  'use strict';
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const PREFIX = 'ukolnicek_';
  const IMG_PREFIX = 'ukimg_';   /* obrázky; nesmí obsahovat PREFIX, jinak by se pletly se zálohami */
  const API = 'https://www.googleapis.com/drive/v3/files';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  const K = { cid: 'uk-drive-client-id', tok: 'uk-drive-token', consent: 'uk-drive-consented', hint: 'uk-drive-account' };

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* nic */ } }
  };

  let gisPromise = null;
  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; s.remove(); reject({ code: 'gis_load' }); };
      document.head.appendChild(s);
    });
    return gisPromise;
  }

  function validToken() {
    try {
      const t = JSON.parse(ls.get(K.tok) || 'null');
      return t && t.exp > Date.now() + 60000 ? t.t : null;
    } catch (e) { return null; }
  }

  function stamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  }

  const DriveSync = {
    clientId() { return (ls.get(K.cid) || '').trim(); },

    setClientId(v) {
      v = (v || '').trim();
      if (v !== this.clientId()) { ls.set(K.tok, null); ls.set(K.consent, null); }
      ls.set(K.cid, v || null);
    },

    /* e-mail účtu Google, který se má použít: Google pak nenabízí výběr účtu (jen v tomto zařízení) */
    account() { return (ls.get(K.hint) || '').trim(); },
    setAccount(v) { ls.set(K.hint, (v || '').trim() || null); },

    /* 'off' = nepřipojeno, 'expired' = bylo připojeno, token vypršel, 'ok' = platný token */
    state() {
      if (!this.clientId()) return 'off';
      if (validToken()) return 'ok';
      return ls.get(K.consent) ? 'expired' : 'off';
    },

    /* knihovnu Googlu načteme dopředu, aby se okno přihlášení otevřelo hned po kliknutí
       (jinak ho prohlížeč může zablokovat jako vyskakovací okno) */
    preload() { if (this.clientId() && navigator.onLine) loadGis().catch(() => {}); },

    async connect() {
      const cid = this.clientId();
      if (!cid) throw { code: 'no_client' };
      await loadGis();
      return new Promise((resolve, reject) => {
        let client;
        const hint = this.account();
        try {
          client = google.accounts.oauth2.initTokenClient({
            client_id: cid,
            scope: SCOPE,
            ...(hint ? { login_hint: hint } : {}),
            callback: (r) => {
              if (r && r.access_token && google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) {
                ls.set(K.tok, JSON.stringify({ t: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 }));
                ls.set(K.consent, '1');
                resolve();
              } else {
                reject({ code: (r && r.error) || 'scope_denied' });
              }
            },
            error_callback: (e) => reject({ code: (e && e.type) || 'popup_failed_to_open' })
          });
        } catch (e) { reject({ code: 'bad_client', message: String(e && e.message || e) }); return; }
        client.requestAccessToken(Object.assign({ prompt: ls.get(K.consent) ? '' : 'consent' }, hint ? { login_hint: hint } : {}));
      });
    },

    disconnect() {
      const t = validToken();
      if (t && window.google && google.accounts && google.accounts.oauth2) {
        try { google.accounts.oauth2.revoke(t, () => {}); } catch (e) { /* nic */ }
      }
      ls.set(K.tok, null); ls.set(K.consent, null);
    },

    async api(url, opt) {
      opt = opt || {};
      const t = validToken();
      if (!t) throw { code: 'expired' };
      let r, timer = null;
      const ctl = opt.timeout && window.AbortController ? new AbortController() : null;
      if (ctl) timer = setTimeout(() => ctl.abort(), opt.timeout);
      const init = Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + t }, opt.headers || {}) }, ctl ? { signal: ctl.signal } : {});
      delete init.timeout;
      try {
        r = await fetch(url, init);
      } catch (e) { throw { code: 'network' }; }
      finally { if (timer) clearTimeout(timer); }
      if (r.status === 401) { ls.set(K.tok, null); throw { code: 'expired' }; }
      if (!r.ok) {
        let msg = '';
        try { const j = await r.json(); msg = (j.error && j.error.message) || ''; } catch (e) { /* nic */ }
        throw { code: r.status === 403 ? 'forbidden' : r.status === 404 ? 'not_found' : 'http_' + r.status, message: msg };
      }
      return r;
    },

    /* seznam záloh, nejnovější první */
    async list() {
      const q = encodeURIComponent(`name contains '${PREFIX}' and trashed = false`);
      const url = `${API}?spaces=appDataFolder&q=${q}&orderBy=${encodeURIComponent('createdTime desc')}&pageSize=100&fields=${encodeURIComponent('files(id,name,createdTime,size)')}`;
      const j = await (await this.api(url)).json();
      return (j.files || []).filter((f) => f.name.indexOf(PREFIX) === 0);
    },

    /* jen nejnovější záloha: id, název a čas vytvoření na serveru (pár set bajtů, bez obsahu) */
    async latest(opt) {
      const q = encodeURIComponent(`name contains '${PREFIX}' and trashed = false`);
      const url = `${API}?spaces=appDataFolder&q=${q}&orderBy=${encodeURIComponent('createdTime desc')}&pageSize=3&fields=${encodeURIComponent('files(id,name,createdTime)')}`;
      const j = await (await this.api(url, opt)).json();
      return (j.files || []).find((f) => f.name.indexOf(PREFIX) === 0) || null;
    },

    async upload(obj) {
      const meta = { name: PREFIX + stamp() + '.json', parents: ['appDataFolder'], mimeType: 'application/json' };
      const boundary = 'uk' + Math.random().toString(36).slice(2);
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(obj)}\r\n` +
        `--${boundary}--`;
      const r = await this.api(`${UPLOAD}?uploadType=multipart&fields=${encodeURIComponent('id,name,createdTime,size')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
        body
      });
      return await r.json();
    },

    async download(id, opt) {
      const r = await this.api(`${API}/${encodeURIComponent(id)}?alt=media`, opt);
      try { return await r.json(); } catch (e) { throw { code: e && e.name === 'SyntaxError' ? 'bad_file' : 'network' }; }
    },

    /* ---------- obrázky: každý jako samostatný soubor ukimg_<ID> ---------- */
    async listImages() {
      const out = [];
      let tok = '';
      do {
        const q = encodeURIComponent(`name contains '${IMG_PREFIX}' and trashed = false`);
        const url = `${API}?spaces=appDataFolder&q=${q}&pageSize=1000&fields=${encodeURIComponent('nextPageToken,files(id,name,createdTime,size)')}${tok ? '&pageToken=' + encodeURIComponent(tok) : ''}`;
        const j = await (await this.api(url, { timeout: 20000 })).json();
        (j.files || []).forEach((f) => { if (f.name.indexOf(IMG_PREFIX) === 0) out.push(f); });
        tok = j.nextPageToken || '';
      } while (tok);
      return out;
    },

    imgId(f) { return f.name.slice(IMG_PREFIX.length); },

    /* do 5 MB jedním požadavkem (multipart), větší přes „resumable“ (Disk multipart nad 5 MB nebere) */
    async uploadImage(id, blob) {
      const type = blob.type || 'application/octet-stream';
      const meta = { name: IMG_PREFIX + id, parents: ['appDataFolder'], mimeType: type };
      const fields = '&fields=' + encodeURIComponent('id,name,createdTime,size');
      if (blob.size <= 5e6) {
        const b = 'uk' + Math.random().toString(36).slice(2);
        const body = new Blob([
          `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${type}\r\n\r\n`,
          blob,
          `\r\n--${b}--`
        ]);
        const r = await this.api(`${UPLOAD}?uploadType=multipart${fields}`, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
        return await r.json();
      }
      const r0 = await this.api(`${UPLOAD}?uploadType=resumable${fields}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type },
        body: JSON.stringify(meta)
      });
      const loc = r0.headers.get('Location');
      if (!loc) throw { code: 'network' };
      const r = await this.api(loc, { method: 'PUT', headers: { 'Content-Type': type }, body: blob });
      return await r.json();
    },

    async downloadImage(fileId) {
      const r = await this.api(`${API}/${encodeURIComponent(fileId)}?alt=media`);
      try { return await r.blob(); } catch (e) { throw { code: 'network' }; }
    },

    async remove(id) {
      await this.api(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    /* smaže nejstarší zálohy nad limit */
    async rotate(keep) {
      const files = await this.list();
      const old = files.slice(keep || 10);
      for (const f of old) { try { await this.remove(f.id); } catch (e) { /* další pokus při příštím nahrání */ } }
      return old.length;
    },

    errText(e) {
      const c = (e && e.code) || '';
      switch (c) {
        case 'no_client': return 'Nejdřív vlož Client ID v Nastavení → Google Disk.';
        case 'bad_client': return 'Client ID nevypadá správně. Zkontroluj ho v Nastavení.';
        case 'gis_load': return 'Nepodařilo se načíst přihlášení Google. Jsi online?';
        case 'popup_closed': return 'Okno přihlášení bylo zavřené.';
        case 'popup_failed_to_open': return 'Prohlížeč zablokoval okno přihlášení. Povol pro tuto stránku vyskakovací okna.';
        case 'access_denied':
        case 'scope_denied': return 'Bez povolení přístupu k datům aplikace na Disku to nepůjde. Při přihlášení ho zaškrtni.';
        case 'expired': return 'Přihlášení vypršelo. Klepni na žlutý mráček.';
        case 'network': return 'Nepodařilo se spojit s Google Diskem.';
        case 'forbidden': return 'Google odmítl přístup' + (e.message ? ': ' + e.message : '. Je v projektu zapnuté Google Drive API?');
        case 'not_found': return 'Soubor na Disku už neexistuje. Zkus to znovu.';
        case 'bad_file': return 'Soubor na Disku není platná záloha Úkolníčku.';
        default: return 'Synchronizace selhala' + (c ? ' (' + c + ')' : '') + '.';
      }
    }
  };

  window.DriveSync = DriveSync;
})();
