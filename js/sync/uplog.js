/* Úkolníček – Statistika nahrávání na Disk: kdy, kolik dat (bajty souboru zálohy) a jak dlouho to trvalo.
   - záznamy jsou jen v zařízení (IndexedDB, klíč 'uplog'), nejsou součást dat, takže nemění otisk ani oranžovou tečku
   - mažou se jen soubory na Disku (po 10), záznamy zůstávají všechny
   - délka nahrání se zapíše i k souboru na Disku (appProperties.dur), takže ji ukáže každé zařízení; když zařízení
     uvidí v seznamu záloh soubor s délkou, kterou ještě nemá, přidá si ho do statistiky (i z jiného zařízení)
   záznam: { id: ID souboru, t: čas (ms), b: velikost (B), ms: délka nahrání, dev: zařízení } */

let LOG=[], loaded=null;
const byId=new Map();
function set(list){ LOG=list.slice().sort((a,b)=>a.t-b.t); byId.clear(); LOG.forEach(e=>byId.set(e.id,e)); }
const UpLog={
  load(){ return loaded||(loaded=(async()=>{ try{ const v=window.Local&&await Local.getKv('uplog'); if(Array.isArray(v)) set(v); }catch(_){} })()); },
  all(){ return LOG; },
  durOf(f){ const p=f&&f.appProperties; const v=p&&+p.dur; if(v>0) return v; const e=f&&byId.get(f.id); return e?e.ms:0; },
  /* nové záznamy (vlastní nahrání nebo soubory se známou délkou ze seznamu); vrací počet přidaných */
  async add(list){
    await this.load();
    let cur=null; try{ cur=await Local.getKv('uplog'); }catch(_){}
    const m=new Map((Array.isArray(cur)?cur:LOG).map(e=>[e.id,e])); let n=0;
    list.forEach(e=>{ if(e&&e.id&&e.ms>0&&!m.has(e.id)){ m.set(e.id,e); n++; } });
    set([...m.values()]);
    if(n) try{ await Local.setKv('uplog',LOG); }catch(_){}
    return n;
  },
  harvest(files){
    const add=(files||[]).filter(f=>f&&f.appProperties&&+f.appProperties.dur>0&&!byId.has(f.id))
      .map(f=>({id:f.id,t:Date.parse(f.createdTime)||0,b:+f.size||0,ms:+f.appProperties.dur,dev:f.appProperties.dev||''}));
    return add.length?this.add(add):Promise.resolve(0);
  }
};
const fmtSec=ms=>{ const s=ms/1000; return (s<10?s.toFixed(1).replace('.',','):String(Math.round(s)))+' s'; };

export { fmtSec, UpLog };
