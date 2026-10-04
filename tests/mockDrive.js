/* napodobený Google Disk pro testy; stav drží v localStorage, aby přežil reload */
(function () {
  const KEY = 'mock-D';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  const D = window.__D = Object.assign({ files: [], data: {}, tok: 'ok', latency: 40, dlLatency: 0, failConnect: false, calls: [] }, load() || {});
  D.calls = [];
  const save = () => { const c = Object.assign({}, D); delete c.calls; localStorage.setItem(KEY, JSON.stringify(c)); };
  window.__saveD = save;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sorted = () => [...D.files].sort((a, b) => b.createdTime.localeCompare(a.createdTime));
  window.DriveSync = {
    clientId() { return 'test.apps.googleusercontent.com'; },
    setClientId() {}, account() { return ''; }, setAccount() {},
    state() { return D.tok === 'ok' ? 'ok' : D.tok === 'expired' ? 'expired' : 'off'; },
    preload() {},
    connect() {
      D.calls.push('connect:' + (navigator.userActivation ? navigator.userActivation.isActive : '?'));
      return sleep(80).then(() => { if (D.failConnect) throw { code: 'popup_closed' }; D.tok = 'ok'; save(); });
    },
    disconnect() { D.tok = 'off'; save(); },
    async latest() { D.calls.push('latest'); await sleep(D.latency); if (D.tok !== 'ok') throw { code: 'expired' }; const f = sorted()[0]; return f ? { id: f.id, name: f.name, createdTime: f.createdTime } : null; },
    async list() { D.calls.push('list'); await sleep(D.latency); return sorted(); },
    async upload(obj) {
      D.calls.push('upload'); await sleep(D.latency);
      const id = 'f' + (D.files.length + 1) + Math.random().toString(36).slice(2, 5);
      const last = sorted()[0]; /* čas na serveru roste vždy dopředu */
      const t = Math.max(Date.now(), last ? Date.parse(last.createdTime) + 1000 : 0);
      const f = { id, name: 'ukolnicek_' + id + '.json', createdTime: new Date(t).toISOString(), size: 100 };
      D.files.push(f); D.data[id] = JSON.parse(JSON.stringify(obj)); save(); return f;
    },
    async download(id) { D.calls.push('download'); await sleep(D.dlLatency || D.latency); return JSON.parse(JSON.stringify(D.data[id])); },
    async remove(id) { D.files = D.files.filter((f) => f.id !== id); save(); },
    async rotate() { return 0; },
    errText(e) { return 'CHYBA ' + (e && e.code); }
  };
})();
