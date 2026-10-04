/* Úkolníček – Ukládání do zařízení (IndexedDB přes storage.js), otisk dat pro „neuloženo na Disk“, převod importovaných dat */
import { $, clamp, clone, COLORS, rid, TEXT_TYPES } from './core.js';
import { defaultSettings, S } from './state.js';
import { HIST, recordHistory } from './editor/history.js';
import { isIndex, isSchool } from './school.js';
import { renderSidebar } from './sidebar.js';
import { renderMain } from './router.js';
import { closePop, toast } from './ui.js';
import { Sync, updateSyncUI } from './sync/sync.js';
import { hideImgSel } from './editor/images.js';

/* ================= storage (IndexedDB, see storage.js) ================= */
const IMGURL=new Map();
const META={changedAt:0,syncedAt:0,remoteAt:'',remoteName:'',lastUpload:0,lastDownload:0,syncedHash:'',curHash:''};
/* Otisk dat pro „neuloženo na Disk“. Nepočítá sbalení nadpisů ani časy úprav a nerozlišuje
   „nezaškrtnuto“ od „nikdy nezaškrtnuto“, takže změna tam a zpět (i přes ⌘Z) vrátí stav na uloženo. */
function canon(v){
  if(Array.isArray(v)) return '['+v.map(canon).join(',')+']';
  if(v&&typeof v==='object') return '{'+Object.keys(v).sort().filter(k=>v[k]!=null&&v[k]!==false&&!(k==='level'&&!v[k])).map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
/* stejný řetězec jako canon() po odebrání časů úprav stránek a sbalení bloků, ale bez kopírování dat */
const HASH_SKIP=new Set(['updated','collapsed']);
function canonH(v){
  if(Array.isArray(v)) return '['+v.map(canonH).join(',')+']';
  if(v&&typeof v==='object') return '{'+Object.keys(v).sort().filter(k=>!HASH_SKIP.has(k)&&v[k]!=null&&v[k]!==false&&!(k==='level'&&!v[k])).map(k=>JSON.stringify(k)+':'+canonH(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
function fnv(str){ let h=0x811c9dc5; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193); } return (h>>>0).toString(36)+'.'+str.length; }
/* data se nemění, otisk jde počítat přímo z dataForSave() */
function hashData(d){ return fnv(canonH(d)); }
function dataHash(){ return hashData(dataForSave()); }
/* otisk dat stažených z Disku (po normalizeImport), počítaný stejně jako otisk dat v zařízení */
function hashOf(n){ return hashData(packData(n.pages,n.events,Object.assign(defaultSettings(),n.settings),n.subjects,n.semesters)); }
function isDirty(){
  if(!Object.keys(S.pages).length&&!Object.keys(S.events).length&&!Object.keys(S.subjects).length) return false;
  if(META.syncedHash&&META.curHash) return META.curHash!==META.syncedHash;
  if(!META.remoteName&&!META.syncedAt) return true;   /* data, která ještě nikdy nebyla na Disku */
  return META.changedAt>META.syncedAt;
}
/* číslo verze dat v paměti: zvýší se při každé změně (mezipaměť seznamu úkolů podle něj pozná, že je zastaralá) */
let DATA_REV=0;
const bumpRev=()=>{ DATA_REV++; };
const Store={
  t:null,broken:false,
  async init(){
    try{
      await Local.open();
      const st=await Local.loadState();
      if(st){ const d=normalizeImport(st); S.pages=d.pages||{}; S.events=d.events||{}; S.subjects=d.subjects||{}; S.semesters=d.semesters||{}; S.settings=Object.assign(defaultSettings(),d.settings||{}); Object.assign(META,st.meta||{}); }
      const imgs=await Local.allImages(); imgs.forEach(r=>{ try{ IMGURL.set(r.id,URL.createObjectURL(r.blob)); }catch(_){} });
      Local.persist();
      bumpRev(); META.curHash=dataHash();
    }catch(e){ console.error(e); this.broken=true; setTimeout(()=>toast('Místní úložiště není dostupné (soukromé okno?). Změny se neuloží.'),300); }
    onDataReady(); Sync.init();
  },
  queue(){ bumpRev(); META.changedAt=Date.now(); clearTimeout(this.t); this.t=setTimeout(()=>this.flush(),350); updateSaving(true); updateSyncUI(); },
  async flush(){
    clearTimeout(this.t); this.t=null;
    const d=dataForSave();                 /* jedna kopie dat pro otisk i uložení */
    META.curHash=hashData(d);
    if(this.broken){ updateSaving(); updateSyncUI(); return; }
    try{ await Local.saveState(Object.assign(d,{meta:clone(META)})); }
    catch(e){ toast(e&&e.name==='QuotaExceededError'?'Úložiště v zařízení je plné. Smaž nějaké obrázky nebo stránky.':'Uložení do zařízení selhalo. Zkus obnovit stránku.'); }
    updateSaving(); updateSyncUI();
  },
  flushAll(){ if(this.t) this.flush(); }
};
/* persisted html never carries image src (those are per-device object URLs) */
function stripHtml(h){ return typeof h==='string'?h.replace(/<img\b[^>]*>/gi,tag=>tag.replace(/\s(src|alt|draggable)="[^"]*"/gi,'')):h; }
function stripBlocks(blocks){
  return (blocks||[]).map(b=>{
    const o=Object.assign({},b); if(o.html) o.html=stripHtml(o.html);
    if(o.rows) o.rows=o.rows.map(r=>({cells:(r.cells||[]).map(c=>({lines:(c.lines||[]).map(l=>Object.assign({},l,{html:stripHtml(l.html)}))}))}));
    return o;
  });
}
/* Index (předměty a semestry) se do dat přidá jen když něco obsahuje,
   takže data bez Indexu mají stejný tvar i otisk jako ve starších verzích */
function packData(src,events,settings,subjects,semesters){
  const pages={}; Object.values(src||{}).forEach(p=>{ pages[p.id]=Object.assign({},p,{blocks:stripBlocks(p.blocks)}); });
  const out={pages,events:events||{},settings:settings||{}};
  if(subjects&&Object.keys(subjects).length) out.subjects=subjects;
  if(semesters&&Object.keys(semesters).length) out.semesters=semesters;
  return clone(out);
}
function dataForSave(){ return packData(S.pages,S.events,S.settings,S.subjects,S.semesters); }
function stateForStorage(){ return Object.assign(dataForSave(),{meta:clone(META)}); }
/* accept older exports: Claude version (/_blob/ images, src on block images) */
function legacyHtml(h){
  if(!h||!/<img/i.test(h)) return h;
  const t=document.createElement('template'); t.innerHTML=h;
  t.content.querySelectorAll('img').forEach(im=>{ if(!im.getAttribute('data-img')){ im.setAttribute('data-img','legacy'+rid()); im.setAttribute('data-name','Obrázek z Claude verze'); } im.removeAttribute('src'); });
  return t.innerHTML;
}
/* Data zvenku (soubor, Disk, záloha, IndexedDB) se před použitím zkontrolují: ID a typy, které se vypisují do HTML,
   musí mít bezpečný tvar. Běžná data aplikace se tím nezmění (ani jejich otisk), opraví se jen podvržené nebo poškozené hodnoty. */
const SAFE_ID=/^[A-Za-z0-9_-]{1,64}$/;
const BLOCK_TYPES=new Set([...TEXT_TYPES,'table','divider','page','image','subj']);   /* nový typ bloku je potřeba přidat i sem */
const LINE_TYPES=new Set(['p','bullet','todo']);
function idFixer(){
  const map=new Map();
  return v=>{ if(v==null||v==='') return v; v=String(v); if(SAFE_ID.test(v)) return v; if(!map.has(v)) map.set(v,'x'+rid()); return map.get(v); };
}
function normalizeImport(d){
  const fid=idFixer();
  const out={pages:{},events:{},settings:clone(d.settings||{}),subjects:{},semesters:{}};
  delete out.settings.by; delete out.settings.updated;
  if(Array.isArray(out.settings.taskHidden)) out.settings.taskHidden=out.settings.taskHidden.map(fid);
  Object.entries(d.pages||{}).forEach(([k,p])=>{
    if(!p) return; const pg=clone(p); pg.id=fid(pg.id||k); delete pg.by;
    if(pg.parent) pg.parent=fid(pg.parent);
    if(pg.color!=null&&!COLORS.includes(pg.color)) pg.color='gray';
    pg.blocks=(Array.isArray(pg.blocks)?pg.blocks:[]).filter(b=>b&&typeof b==='object').map(b=>{
      b.id=fid(b.id)||rid();
      if(!BLOCK_TYPES.has(b.type)) b.type='p';
      if(b.until) b.until=fid(b.until);
      if(b.untilVis!=null&&b.untilVis!==true) delete b.untilVis;
      if(b.pageId) b.pageId=fid(b.pageId);
      if(b.subj) b.subj=fid(b.subj);
      if(b.hl!=null&&!COLORS.includes(b.hl)) delete b.hl;
      if(b.icon!=null) b.icon=String(b.icon).slice(0,8);
      if(b.level!=null&&!(Number.isInteger(b.level)&&b.level>=0&&b.level<=4)) b.level=clamp(parseInt(b.level,10)||0,0,4);
      if(b.color!=null&&!COLORS.includes(b.color)) b.color='purple';
      if(b.align!=null&&!['left','center','right'].includes(b.align)) delete b.align;
      if(b.type==='image'&&!b.img){ b.img='legacy'+rid(); b.name=b.name||'Obrázek z Claude verze'; delete b.src; }
      if(b.img!=null&&!SAFE_ID.test(String(b.img))) b.img='legacy'+rid();
      if(b.html) b.html=legacyHtml(b.html);
      if(b.rows) b.rows.forEach(r=>(r.cells||[]).forEach(c=>(c.lines||[]).forEach(l=>{ if(!LINE_TYPES.has(l.t)) l.t='p'; l.html=legacyHtml(l.html); })));
      return b;
    });
    out.pages[pg.id]=pg;
  });
  Object.entries(d.events||{}).forEach(([k,e])=>{
    if(!e) return; const ev=clone(e); ev.id=fid(ev.id||k); delete ev.by; delete ev.updated;
    if(ev.color!=null&&ev.color!==''&&!COLORS.includes(ev.color)) delete ev.color;
    if(ev.subj) ev.subj=fid(ev.subj);
    out.events[ev.id]=ev;
  });
  Object.entries(d.subjects||{}).forEach(([k,x])=>{
    if(!x) return; const su=clone(x); su.id=fid(su.id||k);
    if(su.sem) su.sem=fid(su.sem);
    if(su.color!=null&&!COLORS.includes(su.color)) su.color='purple';
    if(Array.isArray(su.parts)) su.parts.forEach(pt=>{ if(pt&&pt.id) pt.id=fid(pt.id); });
    out.subjects[su.id]=su;
  });
  Object.entries(d.semesters||{}).forEach(([k,x])=>{ if(!x) return; const sm=clone(x); sm.id=fid(sm.id||k); ['hidden','noStats'].forEach(f=>{ if(sm[f]!=null&&sm[f]!==true) delete sm[f]; }); out.semesters[sm.id]=sm; });
  return out;
}
function updateSaving(busy){ const el=$('#save-state'); if(!el) return; el.textContent=busy?'Ukládám…':(Store.broken?'Neukládá se':'Uloženo'); el.className=busy?'busy':''; }

function savePage(pg){ if(!pg) return; recordHistory(pg); pg.updated=Date.now(); Store.queue(); }
function saveEvent(){ Store.queue(); }
function saveSettings(){ Store.queue(); }

function onDataReady(){
  S.ready=true;
  renderSidebar(); renderMain();
}
function applyData(d){ applyNormalized(normalizeImport(d)); }
function applyNormalized(n){
  n=clone(n); bumpRev();
  S.pages=n.pages||{}; S.events=n.events||{}; S.subjects=n.subjects||{}; S.semesters=n.semesters||{}; S.settings=Object.assign(defaultSettings(),n.settings);
  if((S.view.kind==='schedule'&&!isSchool())||(S.view.kind==='index'&&!isIndex())) S.view={kind:'today'};
  HIST.clear(); hideImgSel(); closePop();
  if(S.view.kind==='page'&&!S.pages[S.view.pageId]) S.view={kind:'today'};
  renderSidebar(); renderMain();
}

/* posluchače a nastavení při startu (volá main.js ve stejném pořadí jako dřív) */
export function initStore(){
  window.addEventListener('pagehide',()=>Store.flushAll());
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') Store.flushAll(); });
}

export { applyData, applyNormalized, canon, DATA_REV, dataForSave, dataHash, hashData, hashOf, IMGURL, isDirty, META, normalizeImport, packData, saveEvent, savePage, saveSettings, stateForStorage, Store, updateSaving };
