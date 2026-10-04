/* Úkolníček – místní úložiště v prohlížeči (IndexedDB)
   kv/state      … stránky, rozvrh, nastavení a stav synchronizace
   kv/base       … verze naposledy společná s Diskem (pro „Ponechat obě“ při kolizi)
   images        … obrázky (Blob) podle ID; do JSONu na Disk jde jen ID a název
   backups       … posledních 5 místních záloh (vznikají před stažením z Disku a před obnovením) */
(function () {
  'use strict';
  const DB_NAME = 'ukolnicek';
  const DB_VERSION = 1;
  const KEEP_BACKUPS = 5;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB není dostupné')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
      req.onblocked = () => console.warn('IndexedDB: otevření blokováno jinou kartou');
    });
    return dbPromise;
  }

  const wrap = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  async function store(name, mode) { const db = await open(); return db.transaction(name, mode).objectStore(name); }

  const Local = {
    open,

    async loadState() {
      const s = await store('kv', 'readonly');
      const v = await wrap(s.get('state'));
      if (v) return v;
      // první spuštění: převezmi případná data ze starší verze v localStorage
      try { const l = localStorage.getItem('uk-data'); if (l) return JSON.parse(l); } catch (e) { /* nic */ }
      return null;
    },

    async saveState(state) {
      const s = await store('kv', 'readwrite');
      await wrap(s.put(state, 'state'));
    },

    /* poslední verze společná s Diskem (po nahrání / stažení); slouží ke spojení dvou verzí při kolizi */
    async loadBase() {
      const s = await store('kv', 'readonly');
      return (await wrap(s.get('base'))) || null;
    },

    async saveBase(data) {
      const s = await store('kv', 'readwrite');
      await wrap(s.put(data, 'base'));
    },

    async putImage(blob, name) {
      const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const s = await store('images', 'readwrite');
      await wrap(s.put({ id, blob, name: name || '', type: blob.type, size: blob.size, created: Date.now() }));
      return id;
    },

    async allImages() {
      const s = await store('images', 'readonly');
      return await wrap(s.getAll());
    },

    async addBackup(state, label) {
      const s = await store('backups', 'readwrite');
      await wrap(s.put({ id: Date.now(), label: label || 'Záloha', state }));
      const all = await this.listBackups();
      for (const b of all.slice(KEEP_BACKUPS)) {
        const d = await store('backups', 'readwrite');
        await wrap(d.delete(b.id));
      }
    },

    async listBackups() {
      const s = await store('backups', 'readonly');
      const all = await wrap(s.getAll());
      return all.sort((a, b) => b.id - a.id);
    },

    async getBackup(id) {
      const s = await store('backups', 'readonly');
      return await wrap(s.get(id));
    },

    // požádá prohlížeč, ať data nemaže při nedostatku místa
    async persist() {
      try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { /* nic */ }
      return false;
    }
  };

  window.Local = Local;
})();
