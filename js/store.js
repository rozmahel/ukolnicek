/* Úkolníček – Ukládání do zařízení (IndexedDB přes storage.js), otisk dat pro „neuloženo na Disk“, převod importovaných dat */
import { $, clamp, clone, COLORS, lsGet, lsSet, rid, TEXT_TYPES } from './core.js';
import { defaultSettings, S } from './state.js';
import { applySkin } from './theme.js';
import { HIST, recordHistory } from './editor/history.js';
import { isIndex, isSchool } from './school.js';
import { renderSidebar } from './sidebar.js';
import { renderMain, restoreScroll } from './router.js';
import { closePop, toast } from './ui.js';
import { Sync, updateSyncUI } from './sync/sync.js';
import { keepFocus, mergeData, restoreFocus } from './sync/merge.js';
import { ImgSync } from './sync/images.js';
import { hideImgSel } from './editor/images.js';
import { purgeTrash } from './trash.js';

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
function hashOf(n){ return hashData(packN(n)); }
function isDirty(){
  if(!Object.keys(S.pages).length&&!Object.keys(S.events).length&&!Object.keys(S.subjects).length&&!Object.keys(S.maps).length) return false;
  if(META.syncedHash&&META.curHash) return META.curHash!==META.syncedHash;
  if(!META.remoteName&&!META.syncedAt) return true;   /* data, která ještě nikdy nebyla na Disku */
  return META.changedAt>META.syncedAt;
}
/* číslo verze dat v paměti: zvýší se při každé změně (mezipaměť seznamu úkolů podle něj pozná, že je zastaralá) */
let DATA_REV=0;
const bumpRev=()=>{ DATA_REV++; };

/* ---- víc oken najednou (nainstalovaná aplikace + karta v prohlížeči) ----
   Každý zápis do IndexedDB dostane META.wid. Před zápisem se zkontroluje, jestli mezitím nezapsalo jiné okno;
   když ano, spojí se jeho data s tímhle oknem (stejně jako při kolizi s Diskem, základ = naposledy viděný stav).
   Zápisy oken jdou po sobě (Web Locks). Ostatní okna se o zápisu dozví přes BroadcastChannel a načtou si ho. */
let lastWid='', lastSeen=null, staleTab=false;
const TAB_CH=typeof BroadcastChannel==='function'?new BroadcastChannel('ukolnicek-data'):null;
const withLock=fn=>navigator.locks&&navigator.locks.request&&!Store.unloading?navigator.locks.request('ukolnicek-store',fn):fn();
function packN(n){ return packData(n.pages,n.events,Object.assign(defaultSettings(),n.settings),n.subjects,n.semesters,n.trash,n.maps); }
/* data uložená jiným oknem (cur) + data v paměti → paměť; vrací uložený stav jiného okna (nový základ) */
function takeOther(cur){
  const R=packN(normalizeImport(cur)), L=dataForSave();
  const same=hashData(L)===hashData(R);
  const r=same||!lastSeen?{data:R,copies:0}:mergeData(L,R,lastSeen);
  const om=cur.meta||{}, changed=Math.max(META.changedAt||0,om.changedAt||0);
  Object.assign(META,om,{changedAt:changed});
  if(!same){ const keep=keepFocus(); applyNormalized(r.data); restoreFocus(keep); loadMissingImages(); }
  if(r.copies) toast(`Úprava ve dvou oknech najednou: ${r.copies} ${r.copies===1?'položka je':r.copies<5?'položky jsou':'položek je'} dvakrát (kopie).`);
  return R;
}
/* obrázky přidané v jiném okně */
async function loadMissingImages(){
  const ids=new Set(); JSON.stringify(S.pages).replace(/"img":"([A-Za-z0-9_-]+)"|data-img=\\"([A-Za-z0-9_-]+)\\"/g,(_,a,b)=>{ ids.add(a||b); return ''; });
  for(const id of ids){ if(IMGURL.has(id)) continue; try{ const r=await Local.getImage(id); if(r&&r.blob) IMGURL.set(id,URL.createObjectURL(r.blob)); }catch(_){} }
  ImgSync.refresh();
}
async function refreshFromOther(){
  if(Store.broken) return;
  if(document.visibilityState==='hidden'){ staleTab=true; return; }
  staleTab=false;
  if(Store.t){ Store.flush(); return; }   /* tady je taky rozepsané: spojí se při zápisu */
  await withLock(async()=>{
    let cur; try{ cur=await Local.loadState(); }catch(_){ return; }
    const wid=cur&&cur.meta&&cur.meta.wid||'';
    if(!cur||wid===lastWid) return;
    const R=takeOther(cur); lastWid=wid; lastSeen=R;
    META.curHash=dataHash(); updateSyncUI();
    if(hashData(dataForSave())!==hashData(R)) Store.queue();
  });
}
const Store={
  t:null,broken:false,
  async init(){
    try{
      await Local.open();
      const st=await Local.loadState();
      if(st){ const d=normalizeImport(st); applyFolds(d.pages); S.pages=d.pages||{}; S.events=d.events||{}; S.subjects=d.subjects||{}; S.semesters=d.semesters||{}; S.trash=d.trash||{}; S.maps=d.maps||{}; S.settings=Object.assign(defaultSettings(),d.settings||{}); Object.assign(META,st.meta||{}); lastWid=META.wid||''; }
      lastSeen=dataForSave();
      const imgs=await Local.allImages(); imgs.forEach(r=>{ try{ IMGURL.set(r.id,URL.createObjectURL(r.blob)); }catch(_){} });
      Local.persist();
      bumpRev(); META.curHash=dataHash(); ImgSync.refresh();
    }catch(e){ console.error(e); this.broken=true; setTimeout(()=>toast('Místní úložiště není dostupné (soukromé okno?). Změny se neuloží.'),300); }
    onDataReady(); Sync.init();
  },
  queue(){ bumpRev(); META.changedAt=Date.now(); clearTimeout(this.t); this.t=setTimeout(()=>this.flush(),350); updateSyncUI(); document.dispatchEvent(new Event('uk-change')); },
  async flush(){
    clearTimeout(this.t); this.t=null;
    if(this.broken){ const d=dataForSave(); META.curHash=hashData(d); ImgSync.refresh(d); updateSaving(); updateSyncUI(); return; }
    await withLock(async()=>{
      try{
        /* zapsalo mezitím jiné okno? nejdřív jeho data spojit s tímhle */
        const cur=await Local.loadState().catch(()=>null);
        if(cur&&cur.meta&&(cur.meta.wid||'')!==lastWid&&(cur.meta.wid||lastWid)) takeOther(cur);
        const d=dataForSave();                 /* jedna kopie dat pro otisk i uložení */
        META.curHash=hashData(d); ImgSync.refresh(d);
        META.wid=rid();
        await Local.saveState(Object.assign({},d,{meta:clone(META)})); SAVE_ERR=false;
        lastWid=META.wid; lastSeen=d;
        if(TAB_CH) try{ TAB_CH.postMessage({t:'saved',wid:lastWid}); }catch(_){}
      }
      catch(e){ SAVE_ERR=true; toast(e&&e.name==='QuotaExceededError'?'Úložiště v zařízení je plné. Pomůže odstranit některé obrázky nebo stránky.':'Uložení do zařízení selhalo. Pomůže obnovit stránku.'); }
    });
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
/* Index (předměty a semestry), koš a myšlenkové mapy se do dat přidají jen když něco obsahují,
   takže data bez nich mají stejný tvar i otisk jako ve starších verzích.
   Koš (trash) je mimo pages: starší verze ho při načtení zahodí a smazané stránky neukáže. */
const stripPage=p=>Object.assign({},p,{blocks:stripBlocks(p.blocks)});
function packData(src,events,settings,subjects,semesters,trash,maps){
  const pages={}; Object.values(src||{}).forEach(p=>{ pages[p.id]=stripPage(p); });
  const out={pages,events:events||{},settings:settings||{}};
  if(subjects&&Object.keys(subjects).length) out.subjects=subjects;
  if(semesters&&Object.keys(semesters).length) out.semesters=semesters;
  if(trash&&Object.keys(trash).length){ out.trash={}; Object.values(trash).forEach(t=>{ out.trash[t.id]=Object.assign({},t,{pages:(t.pages||[]).map(stripPage)}); }); }
  if(maps&&Object.keys(maps).length) out.maps=maps;
  return clone(out);
}
function dataForSave(){ return packData(S.pages,S.events,S.settings,S.subjects,S.semesters,S.trash,S.maps); }
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
const BLOCK_TYPES=new Set([...TEXT_TYPES,'table','divider','page','image','subj','eq']);   /* nový typ bloku je potřeba přidat i sem */
const LINE_TYPES=new Set(['p','bullet','todo']);
function idFixer(){
  const map=new Map();
  return v=>{ if(v==null||v==='') return v; v=String(v); if(SAFE_ID.test(v)) return v; if(!map.has(v)) map.set(v,'x'+rid()); return map.get(v); };
}
function normalizeImport(d){
  const fid=idFixer();
  const out={pages:{},events:{},settings:clone(d.settings||{}),subjects:{},semesters:{},trash:{},maps:{}};
  delete out.settings.by; delete out.settings.updated;
  if(Array.isArray(out.settings.taskHidden)) out.settings.taskHidden=out.settings.taskHidden.map(fid);
  const normPage=(p,k)=>{
    const pg=clone(p); pg.id=fid(pg.id||k); delete pg.by;
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
    return pg;
  };
  Object.entries(d.pages||{}).forEach(([k,p])=>{ if(!p) return; const pg=normPage(p,k); out.pages[pg.id]=pg; });
  /* koš: {ID kořenové stránky: {id, at: čas smazání, pages: [kořen, podstránky…]}} */
  out.trash={};
  Object.entries(d.trash&&typeof d.trash==='object'?d.trash:{}).forEach(([k,t])=>{
    if(!t||!Array.isArray(t.pages)) return;
    const pages=t.pages.filter(p=>p&&typeof p==='object').map(p=>normPage(p,''));
    if(!pages.length) return;
    const id=pages[0].id; out.trash[id]={id,at:Number.isFinite(+t.at)&&+t.at>0?+t.at:Date.now(),pages};
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
  /* myšlenkové mapy: opraví se jen neplatné hodnoty (běžná data zůstanou beze změny) */
  const MMK=new Set(['card','text','group']), MMC=new Set(['red','orange','yellow','green','blue','purple']), num=(v,dv)=>Number.isFinite(+v)&&v!==null&&v!==''?+v:dv;
  Object.entries(d.maps&&typeof d.maps==='object'?d.maps:{}).forEach(([k,x])=>{
    if(!x||typeof x!=='object') return; const m=clone(x); m.id=fid(m.id||k);
    if(m.title!=null&&typeof m.title!=='string') m.title=String(m.title);
    if(m.icon!=null) m.icon=String(m.icon).slice(0,8);
    m.nodes=(Array.isArray(m.nodes)?m.nodes:[]).filter(n=>n&&typeof n==='object').map(n=>{
      n.id=fid(n.id)||rid(); if(!MMK.has(n.k)) n.k='card';
      ['x','y'].forEach(f=>{ if(!Number.isFinite(n[f])) n[f]=num(n[f],0); });
      ['w','h'].forEach(f=>{ if(!Number.isFinite(n[f])||n[f]<=0) n[f]=Math.max(20,num(n[f],f==='w'?240:72)); });
      ['text','label'].forEach(f=>{ if(n[f]!=null&&typeof n[f]!=='string') n[f]=String(n[f]); });
      if(n.color!=null&&!MMC.has(n.color)) delete n.color;
      if(n.page) n.page=fid(n.page); if(n.hid) n.hid=fid(n.hid);
      return n;
    });
    const ids=new Set(m.nodes.map(n=>n.id));
    m.edges=(Array.isArray(m.edges)?m.edges:[]).filter(e=>e&&typeof e==='object').map(e=>{
      e.id=fid(e.id)||rid(); e.from=fid(e.from); e.to=fid(e.to);
      if(e.end!=null&&e.end!=='none'&&e.end!=='both') delete e.end;
      if(e.color!=null&&!MMC.has(e.color)) delete e.color;
      if(e.label!=null&&typeof e.label!=='string') e.label=String(e.label);
      return e;
    }).filter(e=>ids.has(e.from)&&ids.has(e.to));
    out.maps[m.id]=m;
  });
  Object.entries(d.semesters||{}).forEach(([k,x])=>{ if(!x) return; const sm=clone(x); sm.id=fid(sm.id||k); ['hidden','noStats'].forEach(f=>{ if(sm[f]!=null&&sm[f]!==true) delete sm[f]; }); out.semesters[sm.id]=sm; });
  return out;
}
/* vedle Nastavení se ukazuje jen chyba (úložiště nedostupné nebo uložení selhalo); běžné ukládání je tiché */
let SAVE_ERR=false;
function updateSaving(busy,err){ if(err!==undefined) SAVE_ERR=err; const el=$('#save-state'); if(!el) return; const bad=Store.broken||SAVE_ERR; el.textContent=bad?'⚠ Neukládá se':''; el.className=bad?'err':''; el.title=bad?'Změny se neukládají do tohoto zařízení':''; }

function savePage(pg){ if(!pg) return; recordHistory(pg); pg.updated=Date.now(); Store.queue(); }
function saveEvent(){ Store.queue(); }
function saveSettings(){ Store.queue(); }

function onDataReady(){
  S.ready=true; purgeTrash();
  if(S.view.kind==='trash'&&S.trash[S.view.id]) S.trashMode=true;
  applySkin();
  renderSidebar(); renderMain(); restoreScroll();
}
function applyData(d){ applyNormalized(normalizeImport(d)); }
/* sbalení nadpisů je jen v zařízení (od 4.23.0): uk-fold = {ID bloku: 1 sbaleno | 0 rozbaleno}.
   V datech `collapsed` zůstává (starší verze ho čtou), do otisku ani spojení verzí se nepočítá a data zvenku
   (Disk, jiné okno) ho tady přepíšou stavem z tohoto zařízení. */
const FOLD_KEY='uk-fold';
function noteFold(b){ if(!b||!b.id) return; const m=lsGet(FOLD_KEY,{})||{}; m[b.id]=b.collapsed?1:0; lsSet(FOLD_KEY,m); }
function applyFolds(pages){
  const m=lsGet(FOLD_KEY,null); if(!m||typeof m!=='object') return;
  const seen={};
  Object.values(pages||{}).forEach(p=>(p.blocks||[]).forEach(b=>{ if(!(b.id in m)) return; seen[b.id]=m[b.id]; if(m[b.id]) b.collapsed=true; else delete b.collapsed; }));
  if(Object.keys(seen).length!==Object.keys(m).length) lsSet(FOLD_KEY,seen);   /* bloky, které už neexistují, se zapomenou */
}
function applyNormalized(n){
  n=clone(n); bumpRev(); applyFolds(n.pages);
  S.pages=n.pages||{}; S.events=n.events||{}; S.subjects=n.subjects||{}; S.semesters=n.semesters||{}; S.trash=n.trash||{}; S.maps=n.maps||{}; S.settings=Object.assign(defaultSettings(),n.settings);
  applySkin();
  if((S.view.kind==='schedule'&&!isSchool())||(S.view.kind==='index'&&!isIndex())||(S.view.kind==='mindmap'&&!S.settings.mindmap)) S.view={kind:'today'};
  HIST.clear(); hideImgSel(); closePop();
  if(S.view.kind==='page'&&!S.pages[S.view.pageId]) S.view={kind:'today'};
  if(S.view.kind==='trash'&&!S.trash[S.view.id]) S.view={kind:'today'};
  if(S.trashMode&&!Object.keys(S.trash).length) S.trashMode=false;
  renderSidebar(); renderMain();
}

/* posluchače a nastavení při startu (volá main.js ve stejném pořadí jako dřív) */
export function initStore(){
  window.addEventListener('pagehide',()=>{ Store.unloading=true; Store.flushAll(); });
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') Store.flushAll(); else { if(staleTab) refreshFromOther(); if(S.ready&&purgeTrash()){ renderSidebar(); renderMain(); } } });
  if(TAB_CH) TAB_CH.onmessage=e=>{ if(e.data&&e.data.t==='saved'&&e.data.wid!==lastWid&&S.ready) refreshFromOther(); };
}

export { applyData, applyNormalized, canon, DATA_REV, dataForSave, dataHash, hashData, hashOf, IMGURL, isDirty, META, normalizeImport, noteFold, packData, saveEvent, savePage, saveSettings, stateForStorage, Store, updateSaving };
