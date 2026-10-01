(function(){
"use strict";
/* ================= utilities ================= */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const rid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const pad=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const plain=h=>{const d=document.createElement('div');d.innerHTML=h||'';return d.textContent||'';};
const CLIENT=rid();
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};

const COLORS=['purple','pink','red','orange','yellow','green','blue','gray'];
const COLOR_CZ={purple:'Fialová',pink:'Růžová',red:'Červená',orange:'Oranžová',yellow:'Žlutá',green:'Zelená',blue:'Modrá',gray:'Šedá'};
const DAYS=['Po','Út','St','Čt','Pá','So','Ne'];
const DAYS_FULL=['pondělí','úterý','středa','čtvrtek','pátek','sobota','neděle'];
const MONTHS=['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];
const TYPES=['Přednáška','Cvičení','Laboratoř','Zkouška','Jiné'];
const TYPE_SHORT={'Přednáška':'Přednáška','Cvičení':'Cvičení','Laboratoř':'Lab','Zkouška':'Zkouška','Jiné':''};
const EMOJI=['📘','📗','📙','📕','📓','📒','🎓','⚛️','⚙️','☢️','🔬','🧪','🧮','📐','⚡','🔋','🧲','🌡️','💧','🏭','💡','📡','🖥️','🗓️','📅','📌','📝','🗂️','📊','🧠','🎯','✅','🔥','⭐','🧭','🏃','☕','🎒'];
const CALLOUT_IC=['💡','📌','⚠️','🗓️','✅','❗','📎','🔴'];
const TEXT_TYPES=['p','h1','h2','h3','bullet','num','todo','quote','callout'];
const LIST_TYPES=['bullet','num','todo'];
const TYPE_ICON={link:'🔗',p:'T',h1:'H1',h2:'H2',h3:'H3',bullet:'•',num:'1.',todo:'☐',quote:'❝',callout:'!',table:'▦',divider:'—',page:'↗',image:'▣'};
const TYPE_LABEL={link:'Odkaz',p:'Text',h1:'Nadpis 1',h2:'Nadpis 2',h3:'Nadpis 3',bullet:'Odrážky',num:'Číslovaný seznam',todo:'Úkol',quote:'Citace',callout:'Zvýrazněný blok',table:'Tabulka',divider:'Oddělovač',page:'Podstránka',image:'Obrázek'};
const SLASH=[
  {k:'p',hint:'Obyčejný odstavec',kw:'text odstavec paragraph'},
  {k:'h1',hint:'Velký nadpis sekce',kw:'nadpis heading h1'},
  {k:'h2',hint:'Střední nadpis',kw:'nadpis heading h2'},
  {k:'h3',hint:'Malý nadpis',kw:'nadpis heading h3'},
  {k:'todo',hint:'Zaškrtávací políčko',kw:'ukol todo checkbox zaskrtavaci'},
  {k:'bullet',hint:'Seznam s odrážkami',kw:'odrazky seznam bullet list'},
  {k:'num',hint:'Seznam 1, 2, 3',kw:'cislovany seznam number list'},
  {k:'table',hint:'Řádky a sloupce, v buňkách odrážky i úkoly',kw:'tabulka table mrizka'},
  {k:'callout',hint:'Barevný rámeček s ikonou',kw:'zvyrazneny callout upozorneni info poznamka'},
  {k:'quote',hint:'Odsazený citát',kw:'citace quote'},
  {k:'divider',hint:'Vodorovná čára',kw:'oddelovac cara divider'},
  {k:'image',hint:'Ze souboru; v úkolu či odrážce se vloží do textu',kw:'obrazek image foto fotka picture screenshot'},
  {k:'link',hint:'Webová adresa s vlastním názvem',kw:'odkaz link url web adresa hypertext'},
  {k:'page',hint:'Nová stránka uvnitř této',kw:'podstranka stranka page'}
];
const PH={p:'Piš, nebo stiskni / pro příkazy',h1:'Nadpis 1',h2:'Nadpis 2',h3:'Nadpis 3',bullet:'Odrážka',num:'Položka',todo:'Úkol',quote:'Citace',callout:'Poznámka'};

const ICONS={
  today:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  schedule:'<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8 13.5h3M8 17h6"/></svg>',
  tasks:'<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
  settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
};

/* ================= state ================= */
function defaultSettings(){return {name:'Úkolníček',semesterStart:'',showWeekend:false,dayStart:7,dayEnd:20,miniCal:true,miniCalWeeks:true,showHidden:true,hourScale:1};}
const S={ready:false,pages:{},events:{},settings:defaultSettings(),view:lsGet('uk-view',{kind:'today'}),weekOffset:0,calOffset:0,taskFilter:'open',expanded:lsGet('uk-exp',{}),pop:null,modal:null,deferRemote:false};
const MONTHS_NOM=['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];
const IS_MAC=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);
const LOCK_KEY=IS_MAC?'⌘⇧L':'Ctrl+Shift+L';

/* ================= zámek (globální, pamatuje si ho zařízení) ================= */
let LOCK=!!lsGet('uk-lock',false);
function lockSvg(on){ return `<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9.5" rx="2.2"/>${on?'<path d="M8 11V8a4 4 0 0 1 8 0v3"/>':'<path d="M8 11V8a4 4 0 0 1 7.6-1.8"/>'}</svg>`; }
function applyLock(){
  document.body.classList.toggle('locked',LOCK);
  const b=$('#lock-btn'); if(!b) return;
  b.classList.toggle('on',LOCK); b.innerHTML=lockSvg(LOCK); b.setAttribute('aria-pressed',String(LOCK));
  const t=(LOCK?'Odemknout rozložení':'Zamknout rozložení')+` (${LOCK_KEY})`; b.title=t; b.setAttribute('aria-label',t);
}
function toggleLock(){
  LOCK=!LOCK; lsSet('uk-lock',LOCK); closePop(); hideImgSel(); closeSlash(); applyLock();
  toast(LOCK?'Zamčeno: bloky, řádky a sloupce drží na místě, psát a zaškrtávat můžeš dál.':'Odemčeno: můžeš zase přidávat, přesouvat a mazat.');
}

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
function fnv(str){ let h=0x811c9dc5; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193); } return (h>>>0).toString(36)+'.'+str.length; }
function dataHash(){
  const d=dataForSave();
  Object.values(d.pages).forEach(p=>{ delete p.updated; (p.blocks||[]).forEach(b=>{ delete b.collapsed; }); });
  return fnv(canon(d));
}
function isDirty(){
  if(!Object.keys(S.pages).length) return false;
  if(META.syncedHash&&META.curHash) return META.curHash!==META.syncedHash;
  return META.changedAt>META.syncedAt;
}
const Store={
  mode:'local',t:null,broken:false,
  async init(){
    try{
      await Local.open();
      const st=await Local.loadState();
      if(st){ const d=normalizeImport(st); S.pages=d.pages||{}; S.events=d.events||{}; S.settings=Object.assign(defaultSettings(),d.settings||{}); Object.assign(META,st.meta||{}); }
      const imgs=await Local.allImages(); imgs.forEach(r=>{ try{ IMGURL.set(r.id,URL.createObjectURL(r.blob)); }catch(_){} });
      Local.persist();
      META.curHash=dataHash();
    }catch(e){ console.error(e); this.broken=true; setTimeout(()=>toast('Místní úložiště není dostupné (soukromé okno?). Změny se neuloží.'),300); }
    onDataReady(); Sync.init();
  },
  queue(){ META.changedAt=Date.now(); clearTimeout(this.t); this.t=setTimeout(()=>this.flush(),350); updateSaving(true); updateSyncUI(); },
  async flush(){
    clearTimeout(this.t); this.t=null;
    META.curHash=dataHash();
    if(this.broken){ updateSaving(); updateSyncUI(); return; }
    try{ await Local.saveState(stateForStorage()); }
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
function dataForSave(){
  const pages={}; Object.values(S.pages).forEach(p=>{ pages[p.id]=Object.assign({},p,{blocks:stripBlocks(p.blocks)}); });
  return clone({pages,events:S.events,settings:S.settings});
}
function stateForStorage(){ return Object.assign(dataForSave(),{meta:clone(META)}); }
/* accept older exports: Claude version (/_blob/ images, src on block images) */
function legacyHtml(h){
  if(!h||!/<img/i.test(h)) return h;
  const t=document.createElement('template'); t.innerHTML=h;
  t.content.querySelectorAll('img').forEach(im=>{ if(!im.getAttribute('data-img')){ im.setAttribute('data-img','legacy'+rid()); im.setAttribute('data-name','Obrázek z Claude verze'); } im.removeAttribute('src'); });
  return t.innerHTML;
}
function normalizeImport(d){
  const out={pages:{},events:clone(d.events||{}),settings:clone(d.settings||{})};
  delete out.settings.by; delete out.settings.updated;
  Object.entries(d.pages||{}).forEach(([k,p])=>{
    if(!p) return; const pg=clone(p); pg.id=pg.id||k; delete pg.by;
    pg.blocks=(pg.blocks||[]).map(b=>{
      if(b.type==='image'&&!b.img){ b.img='legacy'+rid(); b.name=b.name||'Obrázek z Claude verze'; delete b.src; }
      if(b.html) b.html=legacyHtml(b.html);
      if(b.rows) b.rows.forEach(r=>(r.cells||[]).forEach(c=>(c.lines||[]).forEach(l=>{ l.html=legacyHtml(l.html); })));
      return b;
    });
    out.pages[pg.id]=pg;
  });
  Object.values(out.events).forEach(ev=>{ delete ev.by; delete ev.updated; });
  return out;
}
function updateSaving(busy){ const el=$('#save-state'); if(!el) return; el.textContent=busy?'Ukládám…':(Store.broken?'Neukládá se':'Uloženo'); el.className=busy?'busy':''; }
window.addEventListener('pagehide',()=>Store.flushAll());
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') Store.flushAll(); });

function savePage(pg){ if(!pg) return; recordHistory(pg); pg.updated=Date.now(); Store.queue(); }
/* undo / redo */
const HIST=new Map(); let typingNow=false, histMute=false;
function snap(pg){ return JSON.stringify({title:pg.title||'',icon:pg.icon||'',color:pg.color||'',wide:!!pg.wide,props:pg.props||[],blocks:pg.blocks||[]}); }
function hist(pg){ let h=HIST.get(pg.id); if(!h){ h={undo:[],redo:[],last:snap(pg),t:0,t0:0,typing:false}; HIST.set(pg.id,h); } return h; }
function recordHistory(pg){
  if(histMute) return;
  const h=HIST.get(pg.id); if(!h){ hist(pg); return; }
  const cur=snap(pg); if(cur===h.last) return;
  const now=Date.now();
  const coalesce=typingNow&&h.typing&&now-h.t<1500&&now-h.t0<5000;
  if(!coalesce){ h.undo.push(h.last); if(h.undo.length>200) h.undo.shift(); h.t0=now; }
  h.redo=[]; h.last=cur; h.t=now; h.typing=typingNow;
  updateUndoBtns();
}
function updateUndoBtns(){
  const pg=curPage(), u=$('#undo-btn'), r=$('#redo-btn'); if(!u||!r) return;
  const h=pg&&HIST.get(pg.id);
  u.disabled=!(h&&h.undo.length); r.disabled=!(h&&h.redo.length);
}
function applySnap(pg,str,before){
  const o=JSON.parse(str);
  Object.assign(pg,{title:o.title,icon:o.icon,color:o.color,wide:o.wide,props:o.props,blocks:o.blocks});
  histMute=true; savePage(pg,300); histMute=false;
  const st=$('#main').scrollTop; closePop(); closeSlash(); hideFmt(); hideCellbar(); hideImgSel();
  renderSidebar(); renderPage(pg); $('#main').scrollTop=st;
  const old=JSON.parse(before).blocks||[]; const oldMap=new Map(old.map(b=>[b.id,JSON.stringify(b)]));
  const ch=pg.blocks.find(b=>oldMap.get(b.id)!==JSON.stringify(b));
  if(ch){ const el=$(`#blocks .blk[data-id="${ch.id}"]`); if(el){ const t=$('.txt',el); if(t&&TEXT_TYPES.includes(ch.type)) focusEl(t,'end'); const r=el.getBoundingClientRect(); if(r.top<80||r.bottom>innerHeight-40) el.scrollIntoView({block:'center'}); el.classList.add('flash'); } }
}
function undo(){ const pg=curPage(); if(!pg) return; const h=hist(pg); if(!h.undo.length) return toast('Není co vracet.'); const cur=snap(pg); const prev=h.undo.pop(); h.redo.push(cur); h.last=prev; h.typing=false; applySnap(pg,prev,cur); updateUndoBtns(); }
function redo(){ const pg=curPage(); if(!pg) return; const h=hist(pg); if(!h.redo.length) return; const cur=snap(pg); const nx=h.redo.pop(); h.undo.push(cur); h.last=nx; h.typing=false; applySnap(pg,nx,cur); updateUndoBtns(); }
function saveEvent(){ Store.queue(); }
function saveSettings(){ Store.queue(); }

function onDataReady(){
  S.ready=true;
  renderSidebar(); renderMain();
}
function remoteChanged(kind,ids){
  renderSidebar();
  const v=S.view;
  if(kind==='pages'&&v.kind==='page'&&!ids.has(v.pageId)&&S.pages[v.pageId]) return;
  const docEl=$('#doc');
  if(docEl&&docEl.contains(document.activeElement)){ S.deferRemote=true; return; }
  if(S.modal) { S.deferRemote=true; return; }
  renderMain();
}

/* ================= dates ================= */
const parseD=s=>{ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const sod=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
function mondayOf(d){ const x=sod(d); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
function weekNo(d){ const st=parseD(S.settings.semesterStart); if(!st) return null; return Math.round((mondayOf(d)-mondayOf(st))/(7*864e5))+1; }
function weekInfo(d){ const n=weekNo(d); if(n==null) return null; return {n,odd:n%2!==0,parity:n%2!==0?'lichý':'sudý'}; }
const toMin=t=>{ const [h,m]=(t||'0:0').split(':').map(Number); return h*60+(m||0); };
const fromMin=m=>`${pad(Math.floor(m/60))}:${pad(m%60)}`;
const shortDate=d=>`${d.getDate()}. ${d.getMonth()+1}.`;
function isoWeek(d){ const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const dn=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-dn); const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1)); return Math.ceil(((t-y0)/864e5+1)/7); }
const weeksBetween=(a,b)=>Math.round((mondayOf(b)-mondayOf(a))/(7*864e5));
/* pevný počet opakování: kolikátá hodina to je (1…count), jinak 0 */
function occIndex(ev,d){
  if(ev.repeat!=='count'||!ev.date) return 0;
  const k=weeksBetween(parseD(ev.date),d);
  return k>=0&&k<(+ev.count||1)?k+1:0;
}
function lastOcc(ev){ const d=parseD(ev.date); if(!d) return null; d.setDate(d.getDate()+7*((+ev.count||1)-1)); return d; }
function eventsOnDate(d){
  const wd=(d.getDay()+6)%7, n=weekNo(d), key=ymd(d);
  return Object.values(S.events).filter(ev=>{
    if(ev.repeat==='once') return ev.date===key;
    if(+ev.day!==wd) return false;
    if(ev.repeat==='count') return occIndex(ev,d)>0;
    if(ev.repeat==='odd') return n!=null&&n%2!==0;
    if(ev.repeat==='even') return n!=null&&n%2===0;
    return true;
  }).sort((a,b)=>toMin(a.start)-toMin(b.start));
}
function acadYear(mo){
  const base=parseD(S.settings.semesterStart)||new Date(); const by=base.getFullYear(), bm=base.getMonth()+1;
  if(bm>=8) return mo>=8?by:by+1;
  return by;
}
function parseDue(txt){
  const m=String(txt).match(/(?:^|[^\d.,])(\d{1,2})\.\s?(\d{1,2})(?![\d\p{L}])\.?(?:\s?(\d{4}))?/u);
  if(!m) return null;
  const d=+m[1],mo=+m[2]; if(d<1||d>31||mo<1||mo>12) return null;
  const y=m[3]?+m[3]:acadYear(mo); const dt=new Date(y,mo-1,d);
  return dt.getMonth()===mo-1?dt:null;
}
function relDay(dt){
  const n=Math.round((sod(dt)-sod(new Date()))/864e5);
  if(n===0) return 'dnes'; if(n===1) return 'zítra'; if(n===-1) return 'včera';
  if(n>1) return `za ${n} ${n<5?'dny':'dní'}`;
  return `před ${-n} dny`;
}
function dueChip(dt,done){
  const n=Math.round((sod(dt)-sod(new Date()))/864e5);
  const cls=done?'':n<0?'late':n===0?'today':n<=3?'soon':'';
  return `<span class="chip ${cls}" title="${shortDate(dt)}${dt.getFullYear()}">${shortDate(dt)} · ${relDay(dt)}</span>`;
}

/* ================= pages helpers ================= */
const curPage=()=>S.view.kind==='page'?S.pages[S.view.pageId]:null;
const kids=pid=>Object.values(S.pages).filter(p=>(p.parent||null)===(pid||null)).sort((a,b)=>(a.order||0)-(b.order||0)||String(a.title).localeCompare(b.title));
function descendants(id){ let out=[]; kids(id).forEach(k=>{ out.push(k.id); out=out.concat(descendants(k.id)); }); return out; }
function flatPages(pid=null,depth=0,out=[]){ kids(pid).forEach(p=>{ out.push({p,depth}); flatPages(p.id,depth+1,out); }); return out; }
const pTitle=p=>p?(p.title||'Bez názvu'):'Smazaná stránka';
const pIcon=p=>p&&p.icon?`<span class="ti-ic">${esc(p.icon)}</span>`:`<span class="ti-ic"><span class="ti-dot hl-${esc((p&&p.color)||'gray')}"></span></span>`;
function newBlock(type='p',extra){ return Object.assign({id:rid(),type,html:''},extra||{}); }
function emptyCell(){ return {lines:[{t:'p',html:''}]}; }
function newTable(r=3,c=3){ return newBlock('table',{rows:Array.from({length:r},()=>({cells:Array.from({length:c},()=>emptyCell())})),hrow:false,hcol:false}); }
function createPage(parent,opts){
  const sib=kids(parent||null);
  const pg=Object.assign({id:rid(),title:'',icon:'',color:COLORS[Object.keys(S.pages).length%COLORS.length],parent:parent||null,order:(sib.length?Math.max(...sib.map(s=>s.order||0)):0)+1,props:[],blocks:[newBlock('p')]},opts||{});
  S.pages[pg.id]=pg; savePage(pg,0);
  if(parent){ S.expanded[parent]=true; lsSet('uk-exp',S.expanded); }
  return pg;
}

/* ================= sanitize ================= */
const ALLOWED=new Set(['B','STRONG','I','EM','U','S','STRIKE','MARK','BR','CODE','IMG','A']);
/* odkazy: přijme jakoukoli adresu. Odstraní neviditelné znaky, které se přidávají při kopírování,
   bez schématu doplní https:// (e-mail dostane mailto:). Blokuje jen javascript:/data:/vbscript:, které by šly zneužít. */
function normUrl(u){
  u=String(u||'').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').replace(/\u00A0/g,' ').trim().replace(/\s+/g,'%20');
  if(!u) return '';
  if(/^(javascript|data|vbscript):/i.test(u)) return '';
  if(/^[a-z][a-z0-9+.-]*:\/\//i.test(u)||/^(mailto|tel|sms):/i.test(u)) return u;
  if(/^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/.test(u)) return 'mailto:'+u;
  return 'https://'+u.replace(/^\/+/,'');
}
function urlLabel(u){ try{ if(/^mailto:/i.test(u)) return u.slice(7); const x=new URL(u); return x.hostname.replace(/^www\./,'')+(x.pathname.length>1?x.pathname:''); }catch(_){ return u; } }
function placeholderSrc(name){
  const n=String(name||'obrázek').replace(/[<>&"]/g,'').slice(0,40);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120"><rect x="1" y="1" width="358" height="118" rx="10" fill="#EEEDF2" stroke="#A8A2B6" stroke-dasharray="6 5"/><text x="180" y="52" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="600" fill="#4A4556">${n}</text><text x="180" y="78" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12.5" fill="#77718A">Obrázek není zálohovaný – je jen na zařízení, kde byl vložen</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
function imgSrc(id,name){ return IMGURL.get(id)||placeholderSrc(name); }
function sanitize(html){
  if(!html) return '';
  const t=document.createElement('template'); t.innerHTML=html;
  (function walk(node){
    [...node.childNodes].forEach(ch=>{
      if(ch.nodeType===3) return;
      if(ch.nodeType!==1){ ch.remove(); return; }
      walk(ch);
      if(!ALLOWED.has(ch.tagName)){ const f=document.createDocumentFragment(); if(ch.tagName==='DIV'||ch.tagName==='P') f.appendChild(document.createElement('br')); while(ch.firstChild) f.appendChild(ch.firstChild); ch.replaceWith(f); return; }
      if(ch.tagName==='A'){
        const href=normUrl(ch.getAttribute('href'));
        [...ch.attributes].forEach(a=>ch.removeAttribute(a.name));
        if(!href||!ch.textContent){ const f=document.createDocumentFragment(); while(ch.firstChild) f.appendChild(ch.firstChild); ch.replaceWith(f); return; }
        ch.setAttribute('href',href); ch.setAttribute('class','lnk'); ch.setAttribute('target','_blank'); ch.setAttribute('rel','noopener noreferrer');
        return;
      }
      if(ch.tagName==='IMG'){
        const id=ch.getAttribute('data-img')||''; if(!/^[A-Za-z0-9_-]{4,64}$/.test(id)){ ch.remove(); return; }
        const name=(ch.getAttribute('data-name')||'').slice(0,120), w=ch.getAttribute('width')||'', cls=(ch.getAttribute('class')||'').replace(/\s*missing/,'').trim();
        [...ch.attributes].forEach(a=>ch.removeAttribute(a.name));
        ch.setAttribute('data-img',id); if(name) ch.setAttribute('data-name',name);
        if(/^\d{1,4}$/.test(w)) ch.setAttribute('width',w);
        ch.setAttribute('class',/^im( al-(left|center|right|inline))?$/.test(cls)?cls:'im al-left');
        if(!IMGURL.has(id)) ch.classList.add('missing');
        ch.setAttribute('src',imgSrc(id,name)); ch.setAttribute('alt',''); ch.setAttribute('draggable','false');
        return;
      }
      [...ch.attributes].forEach(a=>{ if(!(a.name==='class'&&ch.tagName==='MARK'&&/^hl-[a-z]+$/.test(a.value))) ch.removeAttribute(a.name); });
    });
  })(t.content);
  let out=t.innerHTML.replace(/^<br>/,'');
  if(out==='<br>') out='';
  return out;
}
const isBlank=h=>!plain(h).trim()&&!/<img/i.test(h||'');
const isBlankEl=el=>!el.textContent&&!el.querySelector('img');
function unwrap(el){ const p=el.parentNode; while(el.firstChild) p.insertBefore(el.firstChild,el); p.removeChild(el); }

/* ================= caret helpers ================= */
function nodeAt(el,off){
  const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); let n,acc=0,last=null;
  while((n=w.nextNode())){ const L=n.nodeValue.length; if(acc+L>=off) return [n,off-acc]; acc+=L; last=n; }
  return last?[last,last.nodeValue.length]:[el,0];
}
function setCaret(el,off){ const [n,o]=nodeAt(el,off); const r=document.createRange(); r.setStart(n,o); r.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
function caretOffset(el){ const s=getSelection(); if(!s.rangeCount) return 0; const r=s.getRangeAt(0); if(!el.contains(r.startContainer)&&r.startContainer!==el) return 0; const pre=document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer,r.startOffset); return pre.toString().length; }
function isCollapsed(){ const s=getSelection(); return s.rangeCount&&s.isCollapsed; }
function deleteOffsets(el,a,b){ const [n1,o1]=nodeAt(el,a),[n2,o2]=nodeAt(el,b); const r=document.createRange(); r.setStart(n1,o1); r.setEnd(n2,o2); r.deleteContents(); }
function splitAtCaret(el){
  const s=getSelection(); const r=s.getRangeAt(0); r.deleteContents();
  const tail=document.createRange(); tail.selectNodeContents(el); tail.setStart(r.startContainer,r.startOffset);
  const d=document.createElement('div'); d.appendChild(tail.extractContents());
  if(isBlankEl(el)) el.innerHTML='';
  return (d.textContent||d.querySelector('img'))?sanitize(d.innerHTML):'';
}
function caretAtStart(el){
  if(!isCollapsed()) return false; const r=getSelection().getRangeAt(0); const pre=document.createRange(); pre.selectNodeContents(el);
  try{ pre.setEnd(r.startContainer,r.startOffset); }catch(_){ return false; }
  return pre.toString().length===0&&!pre.cloneContents().querySelector('img');
}
function caretAtEnd(el){
  if(!isCollapsed()) return false; const r=getSelection().getRangeAt(0); const post=document.createRange(); post.selectNodeContents(el);
  try{ post.setStart(r.endContainer,r.endOffset); }catch(_){ return false; }
  return post.toString().length===0&&!post.cloneContents().querySelector('img');
}
function caretRect(){ const s=getSelection(); if(!s.rangeCount) return null; const r=s.getRangeAt(0).cloneRange(); r.collapse(true); const rc=r.getClientRects()[0]; return rc&&rc.height?rc:null; }
function lineH(el){ return parseFloat(getComputedStyle(el).lineHeight)||22; }
function onFirstLine(el){ const rc=caretRect(); if(!rc) return true; return rc.top-el.getBoundingClientRect().top<lineH(el)*.9; }
function onLastLine(el){ const rc=caretRect(); if(!rc) return true; return el.getBoundingClientRect().bottom-rc.bottom<lineH(el)*.9; }
function focusEl(el,pos){ if(!el) return; el.focus({preventScroll:true}); const len=el.textContent.length; setCaret(el,pos==='end'?len:pos==='start'||pos==null?0:Math.min(pos,len)); const r=el.getBoundingClientRect(); if(r.bottom>innerHeight-40||r.top<60) el.scrollIntoView({block:'center'}); }
function focusBlock(id,pos){ focusEl($(`#blocks .blk[data-id="${id}"] .txt`),pos); }
function focusLine(bid,r,c,l,pos){ focusEl($(`#blocks .blk[data-id="${bid}"] td[data-r="${r}"][data-c="${c}"] .ln[data-l="${l}"] .txt`),pos); }

/* ================= sidebar ================= */
function renderSidebar(){
  const side=$('#side'); const wk=weekInfo(new Date());
  const open=allTasks().filter(t=>!t.done).length;
  const v=S.view;
  const nav=(k,label,extra='')=>`<button class="nv ${v.kind===k?'on':''}" data-act="nav" data-v="${k}">${ICONS[k]}<span>${label}</span>${extra}</button>`;
  const tree=(pid,d)=>kids(pid).map(p=>{
    const ch=kids(p.id).length, open=S.expanded[p.id]!==false;
    return `<div class="ti ${v.kind==='page'&&v.pageId===p.id?'on':''}" style="--d:${d}">
      <button class="ti-tog ${ch?'':'none'} ${open?'open':''}" data-act="tog" data-id="${p.id}" aria-label="${open?'Sbalit':'Rozbalit'}"></button>
      <button class="ti-main" data-act="open" data-id="${p.id}">${pIcon(p)}<span class="ti-t">${esc(pTitle(p))}</span></button>
      <span class="ti-acts"><button class="icon-btn" data-act="page-menu" data-id="${p.id}" aria-label="Možnosti" data-popanchor>⋯</button><button class="icon-btn" data-act="new-sub" data-id="${p.id}" aria-label="Přidat podstránku">+</button></span>
    </div>${ch&&open?tree(p.id,d+1):''}`;
  }).join('');
  side.innerHTML=`
    <div class="ws"><div class="ws-name">${esc(S.settings.name||'Úkolníček')}</div>
      ${!S.ready?'':wk?`<div class="ws-week"><b>${wk.n}.</b> týden výuky · ${wk.parity}</div>`:`<button class="linkbtn" data-act="settings">Nastav začátek semestru</button>`}
      ${S.ready&&S.settings.miniCal?renderMiniCal():''}</div>
    <nav class="nav">
      ${nav('today','Dnes')}
      ${nav('schedule','Rozvrh')}
      ${nav('tasks','Úkoly',open?`<span class="badge">${open}</span>`:'')}
      <button class="nv" data-act="search">${ICONS.search}<span>Hledat</span><kbd>⌘K</kbd></button>
    </nav>
    <div class="sec-h"><span>Projekty</span><button class="icon-btn" data-act="new-page" aria-label="Nový projekt">+</button></div>
    <div class="tree">${Object.keys(S.pages).length?tree(null,0):`<div class="tree-empty">Zatím žádné projekty.<br><button class="linkbtn" data-act="new-page">Vytvořit první projekt</button></div>`}</div>
    <div class="syncbar" id="sync-box"></div>
    <div class="side-foot"><button class="nv" data-act="settings">${ICONS.settings}<span>Nastavení</span></button><span id="save-state"></span></div>`;
  updateSaving(); updateSyncUI();
}

/* mini kalendář v bočním panelu: měsíc, dny v týdnu a (volitelně) číslo týdne v roce;
   týden výuky je v řádku nad kalendářem a v bublině po najetí na číslo */
function renderMiniCal(){
  const now=new Date(), base=new Date(now.getFullYear(),now.getMonth()+S.calOffset,1);
  const y=base.getFullYear(), mo=base.getMonth();
  const start=mondayOf(base), weeks=weeksBetween(start,new Date(y,mo+1,0))+1;
  const sem=!!parseD(S.settings.semesterStart), today=ymd(now), wk=S.settings.miniCalWeeks!==false;
  let h=`<div class="mc" aria-label="Kalendář">
    <div class="mc-h"><button class="mc-nav" data-act="mc-prev" aria-label="Předchozí měsíc">‹</button><button class="mc-t ${S.calOffset?'':'cur'}" data-act="mc-now" title="Zpět na tento měsíc">${MONTHS_NOM[mo]} ${y}</button><button class="mc-nav" data-act="mc-next" aria-label="Další měsíc">›</button></div>
    <div class="mc-g ${wk?'':'nowk'}">${wk?'<span class="mc-wk mc-dh" title="Kalendářní týden v roce">KT</span>':''}${DAYS.map((d,i)=>`<span class="mc-dh ${i>4?'we':''}">${d}</span>`).join('')}`;
  for(let w=0;w<weeks;w++){
    const mon=new Date(start); mon.setDate(start.getDate()+w*7);
    if(wk){
      const kt=isoWeek(mon), n=sem?weekNo(mon):null, cur=weeksBetween(now,mon)===0;
      h+=`<span class="mc-wk ${cur?'cur':''}" title="${kt}. týden v roce${n>=1&&n<=20?` · ${n}. týden výuky (${n%2?'lichý':'sudý'})`:''}">${kt}</span>`;
    }
    for(let i=0;i<7;i++){
      const d=new Date(mon); d.setDate(mon.getDate()+i);
      h+=`<button class="mc-d ${d.getMonth()===mo?'':'out'} ${ymd(d)===today?'today':''} ${i>4?'we':''}" data-act="mc-day" data-date="${ymd(d)}" title="${DAYS_FULL[i]} ${d.getDate()}. ${d.getMonth()+1}. · otevřít v rozvrhu">${d.getDate()}</button>`;
    }
  }
  return h+'</div></div>';
}

/* ================= routing ================= */
function go(view){
  Store.flushAll();
  S.view=view; lsSet('uk-view',view);
  closeSide(); closePop(); hideFmt(); hideCellbar(); hideImgSel();
  renderSidebar(); renderMain();
  $('#main').scrollTop=0;
}
function renderMain(){
  S.deferRemote=false;
  const v=S.view, view=$('#view');
  if(!S.ready){ view.innerHTML='<div class="loading">Načítám tvoje stránky…</div>'; return; }
  let title='Úkolníček';
  if(v.kind==='page'){
    const pg=S.pages[v.pageId];
    if(!pg){ S.view={kind:'today'}; return renderMain(); }
    renderPage(pg); title=pTitle(pg);
  } else if(v.kind==='schedule'){ renderSchedule(); title='Rozvrh'; }
  else if(v.kind==='tasks'){ renderTasks(); title='Úkoly'; }
  else { renderToday(); title='Dnes'; }
  $('#tb-t').textContent=title;
}

/* ================= page editor ================= */
function isHeading(t){ return t==='h1'||t==='h2'||t==='h3'; }
function hLevel(t){ return isHeading(t)?+t[1]:0; }
function numLabel(blocks,i){
  const lv=blocks[i].level||0; let n=1;
  for(let j=i-1;j>=0;j--){ const b=blocks[j], l=b.level||0; if(l>lv) continue; if(l<lv) break; if(b.type==='num') n++; else break; }
  return lv%2?('abcdefghijklmnopqrstuvwxyz'[(n-1)%26]+'.'):n+'.';
}
function renderPage(pg){
  const crumbs=[]; let p=S.pages[pg.parent];
  while(p){ crumbs.unshift(p); p=S.pages[p.parent]; }
  const isEmpty=(pg.blocks||[]).length<=1&&isBlank((pg.blocks[0]||{}).html)&&!(pg.props||[]).length&&(!pg.blocks[0]||TEXT_TYPES.includes(pg.blocks[0].type));
  $('#view').innerHTML=`
  <article class="doc ${pg.wide?'wide':''}" id="doc" data-page="${pg.id}">
    <div class="pagebar">
      <div class="crumbs">${crumbs.map(c=>`<button data-act="open" data-id="${c.id}">${esc(c.icon||'')} ${esc(pTitle(c))}</button><span>/</span>`).join('')}<span>${esc(pg.icon||'')} ${esc(pTitle(pg))}</span></div>
      <div class="pb-acts">${pg.icon?'':`<button class="ghost-btn" data-act="icon" data-popanchor>☺ Ikona</button>`}<button class="ghost-btn" data-act="prop-add">＋ Vlastnost</button><button class="ghost-btn" data-act="wide">${pg.wide?'↤ Užší':'↔ Celá šířka'}</button>
        <span class="pb-sep"></span>
        <button class="icon-btn" id="undo-btn" data-act="undo" title="Zpět (⌘Z)" aria-label="Zpět"><svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></button>
        <button class="icon-btn" id="redo-btn" data-act="redo" title="Znovu (⇧⌘Z)" aria-label="Znovu"><svg viewBox="0 0 24 24"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg></button>
        <button class="icon-btn lock-btn" id="lock-btn" data-act="lock"></button>
      </div>
    </div>
    <div class="doc-head">
      <div class="title-row">${pg.icon?`<button class="page-icon" data-act="icon" data-popanchor aria-label="Změnit ikonu">${esc(pg.icon)}</button>`:''}<h1 class="page-title" id="page-title" contenteditable="true" spellcheck="false" data-ph="Bez názvu">${esc(pg.title)}</h1></div>
      <div class="props" id="props">${renderProps(pg)}</div>
    </div>
    ${isEmpty?`<div class="tpl"><span>Začít šablonou:</span><button data-act="tpl" data-v="subject">Předmět</button><button data-act="tpl" data-v="weeks">Přehled týdnů</button><button data-act="tpl" data-v="info">Obecné informace</button></div>`:''}
    <div class="blocks" id="blocks">${renderBlocks(pg)}</div>
    <div class="doc-tail" data-act="tail"></div>
  </article>`;
  hist(pg); updateUndoBtns(); applyLock();
}
function renderProps(pg){
  const props=pg.props||[];
  if(!props.length) return '';
  return props.map((pr,i)=>`<div class="prop" data-i="${i}"><div class="pk" contenteditable="true" data-ph="Vlastnost" spellcheck="false">${esc(pr.k)}</div><div class="pv" contenteditable="true" data-ph="Prázdné">${esc(pr.v)}</div><button class="icon-btn" data-act="prop-del" data-i="${i}" aria-label="Odebrat vlastnost">×</button></div>`).join('')+`<div><button class="add-prop" data-act="prop-add">＋ Přidat vlastnost</button></div>`;
}
function defaultEnd(bl,i){ const hl=hLevel(bl[i].type); for(let j=i+1;j<bl.length;j++){ const l=hLevel(bl[j].type); if(l&&l<=hl) return j; } return bl.length; }
function sectionEnd(bl,i){
  const b=bl[i]; let end=defaultEnd(bl,i);
  if(b.until){ const k=bl.findIndex(x=>x.id===b.until); if(k>i) end=k+1; }
  return end;
}
function renderBlocks(pg){
  const bl=pg.blocks||[]; const hidden=new Array(bl.length).fill(false); const counts={};
  for(let i=0;i<bl.length;i++){
    if(hidden[i]||!hLevel(bl[i].type)||!bl[i].collapsed) continue;
    const e=sectionEnd(bl,i); let n=0; for(let j=i+1;j<e;j++){ if(!hidden[j]){ hidden[j]=true; n++; } } counts[bl[i].id]=n;
  }
  let out='';
  bl.forEach((b,i)=>{
    if(hidden[i]) return;
    out+=renderBlock(b,i,bl);
    const n=counts[b.id]; if(n&&S.settings.showHidden!==false) out+=`<div class="hidden-count">${n} ${n===1?'skrytý blok':n<5?'skryté bloky':'skrytých bloků'}</div>`;
  });
  return out;
}
function renderBlock(b,i,bl){
  const lv=b.level||0; let inner;
  if(b.type==='divider') inner='<div class="divider"><hr></div>';
  else if(b.type==='table') inner=renderTable(b);
  else if(b.type==='image') inner=`<figure class="imgfig"><img class="bimg ${IMGURL.has(b.img)?'':'missing'}" src="${esc(imgSrc(b.img,b.name))}" alt="${esc(b.caption||'')}" draggable="false">${(b.caption||b.capOn)?`<figcaption class="cap" contenteditable="true" data-ph="Popisek obrázku">${esc(b.caption||'')}</figcaption>`:''}</figure>`;
  else if(b.type==='page'){ const p=S.pages[b.pageId]; inner=`<button class="pagelink" data-act="open" data-id="${esc(b.pageId)}">${p?pIcon(p):'<span class="pl-ic">↗</span>'}<span class="pl-t">${esc(pTitle(p))}</span></button>`; }
  else{
    let mk='';
    if(b.type==='bullet') mk=`<span class="mk bullet" aria-hidden="true">${['•','◦','▪'][lv%3]}</span>`;
    else if(b.type==='num') mk=`<span class="mk num">${numLabel(bl,i)}</span>`;
    else if(b.type==='todo') mk=`<button class="mk check ${b.done?'on':''}" data-act="check" role="checkbox" aria-checked="${!!b.done}" aria-label="Hotovo"></button>`;
    else if(isHeading(b.type)) mk=`<button class="mk caret ${b.collapsed?'closed':''}" data-act="collapse" aria-label="${b.collapsed?'Rozbalit sekci':'Sbalit sekci'}"></button>`;
    else if(b.type==='callout') mk=`<button class="mk callout-ic" data-act="blk-menu" data-popanchor aria-label="Změnit ikonu a barvu">${esc(b.icon||'💡')}</button>`;
    inner=`<div class="row">${mk}<div class="txt t-${b.type} ${b.type==='todo'&&b.done?'done':''}" contenteditable="true" data-ph="${PH[b.type]||''}">${sanitize(b.html)}</div></div>`;
  }
  const extra=b.type==='image'?` al-${b.align||'center'}`:'';
  return `<div class="blk b-${b.type} ${b.type==='callout'?'hl-'+(b.color||'purple'):''}${extra}" data-id="${b.id}" style="--lv:${b.type==='image'?0:lv}${b.type==='image'?`;--w:${+b.w||480}px`:''}">
    <div class="gut"><button class="g-add" data-act="add-after" aria-label="Přidat blok pod">+</button><button class="g-drag" data-act="blk-menu" data-popanchor draggable="true" aria-label="Přetáhni, nebo klikni pro menu">⋮⋮</button></div>${inner}</div>`;
}
function renderTable(b){
  let h=`<div class="tbl-wrap"><table class="tbl ${b.hrow?'hrow':''} ${b.hcol?'hcol':''}"><tbody>`;
  b.rows.forEach((row,r)=>{
    h+='<tr>';
    row.cells.forEach((cell,c)=>{
      h+=`<td data-r="${r}" data-c="${c}">${c===0?`<button class="rh" data-act="row-menu" data-popanchor aria-label="Možnosti řádku">⋮</button>`:''}${r===0?`<button class="ch" data-act="col-menu" data-popanchor aria-label="Možnosti sloupce">⋯</button>`:''}${cell.lines.map((ln,l)=>{
        const mk=ln.t==='bullet'?'<span class="mk bullet" aria-hidden="true">•</span>':ln.t==='todo'?`<button class="mk check ${ln.done?'on':''}" data-act="lcheck" role="checkbox" aria-checked="${!!ln.done}" aria-label="Hotovo"></button>`:'';
        return `<div class="ln l-${ln.t} ${ln.t==='todo'&&ln.done?'done':''}" data-l="${l}">${mk}<div class="txt cell-txt" contenteditable="true">${sanitize(ln.html)}</div></div>`;
      }).join('')}</td>`;
    });
    h+='</tr>';
  });
  return h+`</tbody></table></div><div class="tbl-tools"><button data-act="add-row">＋ Řádek</button><button data-act="add-col">＋ Sloupec</button></div>`;
}
function rerenderBlocks(){ const pg=curPage(); if(!pg) return; if(imgSel) hideImgSel(); const el=$('#blocks'); if(el) el.innerHTML=renderBlocks(pg); const tpl=$('.tpl'); if(tpl&&!((pg.blocks||[]).length<=1&&isBlank((pg.blocks[0]||{}).html))) tpl.remove(); }
function rerenderProps(){ const pg=curPage(); if(pg) $('#props').innerHTML=renderProps(pg); }

function ctxOf(el){
  const pg=curPage(); if(!pg) return null;
  const blkEl=el.closest('.blk'); if(!blkEl) return null;
  const bi=pg.blocks.findIndex(b=>b.id===blkEl.dataset.id); if(bi<0) return null;
  const b=pg.blocks[bi]; const td=el.closest('td');
  if(td&&b.type==='table'){
    const r=+td.dataset.r,c=+td.dataset.c,cell=b.rows[r].cells[c];
    const lnEl=el.closest('.ln'); const l=lnEl?+lnEl.dataset.l:0;
    return {pg,b,bi,blkEl,r,c,cell,l,line:cell.lines[l],td};
  }
  return {pg,b,bi,blkEl};
}

/* ---- templates ---- */
function applyTemplate(pg,k){
  const tx=(type,html,extra)=>newBlock(type,Object.assign({html:html||''},extra||{}));
  if(k==='subject'){
    pg.icon=pg.icon||'📘';
    pg.props=[{k:'Garant',v:''},{k:'Kredity',v:''},{k:'Ukončení',v:''}];
    const t=newTable(4,3); t.hrow=true;
    ['Test','Termín','Body'].forEach((x,i)=>t.rows[0].cells[i].lines[0].html=x);
    pg.blocks=[tx('h2','Úkoly'),tx('todo',''),tx('h2','Body a testy'),t,tx('h2','Poznámky'),tx('p','')];
  } else if(k==='weeks'){
    pg.icon=pg.icon||'🗓️'; pg.wide=true;
    const t=newTable(4,6); t.hcol=true;
    ['','1. týden','2. týden','3. týden','4. týden','Zkouškový'].forEach((x,i)=>t.rows[0].cells[i].lines[0].html=x);
    t.hrow=true;
    [['purple','První měsíc'],['green','Druhý měsíc'],['blue','Třetí měsíc']].forEach(([c,x],i)=>t.rows[i+1].cells[0].lines[0].html=`<mark class="hl-${c}">${x}</mark>`);
    pg.blocks=[t,tx('p','')];
  } else {
    pg.icon=pg.icon||'📌';
    pg.blocks=[tx('h2','Kontakty'),tx('bullet',''),tx('h2','Důležité odkazy a pravidla'),tx('bullet',''),tx('h2','Termíny zkoušek'),tx('todo','')];
  }
  savePage(pg,0); renderSidebar(); renderPage(pg);
}

/* ---- conversions ---- */
function setType(pg,b,k){
  if(!TEXT_TYPES.includes(k)) return;
  b.type=k; if(k!=='todo') delete b.done; if(!isHeading(k)) delete b.collapsed;
  if(k==='callout'){ b.color=b.color||'purple'; b.icon=b.icon||'💡'; }
}
function insertTypeAt(pg,bi,k,replace){
  const b=pg.blocks[bi];
  if(k==='page'){
    const child=createPage(pg.id);
    const link=newBlock('page',{pageId:child.id});
    if(replace) pg.blocks.splice(bi,1,link); else pg.blocks.splice(bi+1,0,link);
    savePage(pg,0); renderSidebar();
    go({kind:'page',pageId:child.id}); setTimeout(()=>$('#page-title')&&$('#page-title').focus(),30);
    return;
  }
  if(k==='divider'||k==='table'){
    const nb=k==='table'?newTable():newBlock('divider');
    if(replace) pg.blocks.splice(bi,1,nb); else pg.blocks.splice(bi+1,0,nb);
    const ni=pg.blocks.indexOf(nb);
    let next=pg.blocks[ni+1];
    if(!next||!TEXT_TYPES.includes(next.type)){ next=newBlock('p'); pg.blocks.splice(ni+1,0,next); }
    savePage(pg); rerenderBlocks();
    if(k==='table') focusLine(nb.id,0,0,0,0); else focusBlock(next.id,0);
    return;
  }
  if(replace){ setType(pg,b,k); savePage(pg); rerenderBlocks(); focusBlock(b.id,'end'); }
  else { const nb=newBlock('p',{level:b.level||0}); setType(pg,nb,k); pg.blocks.splice(bi+1,0,nb); savePage(pg); rerenderBlocks(); focusBlock(nb.id,0); }
}

/* ---- slash menu ---- */
let slash={open:false};
function openSlash(el,bid,start,mode){ slash={open:true,el,bid,start,mode,idx:0,items:SLASH.slice()}; drawSlash(); }
function closeSlash(){ if(slash.open){ slash.open=false; const p=$('#slash'); if(p) p.remove(); } }
function slashQuery(){
  if(!slash.el||!document.contains(slash.el)) return null;
  const t=slash.el.textContent, off=caretOffset(slash.el);
  if(slash.mode==='plus') return t.slice(0,off);
  if(t[slash.start]!=='/'||off<=slash.start) return null;
  return t.slice(slash.start+1,off);
}
function updateSlash(){
  const q=slashQuery(); if(q==null||q.length>24){ closeSlash(); return; }
  const nq=norm(q.trim());
  slash.items=SLASH.filter(it=>!nq||norm(TYPE_LABEL[it.k]+' '+it.kw).includes(nq));
  if(!slash.items.length&&/\s$/.test(q)){ closeSlash(); return; }
  slash.idx=clamp(slash.idx,0,Math.max(0,slash.items.length-1));
  drawSlash();
}
function drawSlash(){
  let p=$('#slash');
  if(!p){ p=document.createElement('div'); p.id='slash'; p.className='pop'; p.setAttribute('role','listbox'); document.body.appendChild(p);
    p.addEventListener('mousedown',e=>e.preventDefault());
    p.addEventListener('click',e=>{ const b=e.target.closest('[data-i]'); if(b) chooseSlash(slash.items[+b.dataset.i]); });
  }
  p.innerHTML=slash.items.length?`<div class="pop-h">Bloky</div>`+slash.items.map((it,i)=>`<button class="pop-item ${i===slash.idx?'act':''}" data-i="${i}" role="option"><span class="pi-ic">${TYPE_ICON[it.k]}</span><span>${TYPE_LABEL[it.k]}<small>${it.hint}</small></span></button>`).join(''):`<div class="empty" style="padding:10px">Nic nenalezeno</div>`;
  const rc=caretRect()||slash.el.getBoundingClientRect();
  placePop(p,{left:rc.left,right:rc.right,top:rc.top,bottom:rc.bottom});
  const act=p.querySelector('.act'); if(act) act.scrollIntoView({block:'nearest'});
}
function chooseSlash(it){
  if(!it) return closeSlash();
  const el=slash.el, off=caretOffset(el), from=slash.mode==='plus'?0:slash.start;
  deleteOffsets(el,from,Math.max(from,off));
  closeSlash();
  const pg=curPage(); const bi=pg.blocks.findIndex(b=>b.id===slash.bid); if(bi<0) return;
  const b=pg.blocks[bi]; b.html=isBlankEl(el)?'':sanitize(el.innerHTML);
  if(it.k==='link'){ const s=getSelection(); openLinkDialog(el,s.rangeCount?s.getRangeAt(0).cloneRange():null); return; }
  if(it.k==='image'){
    if(b.type==='p'&&isBlank(b.html)){ savePage(pg); pickImageBlock(pg.id,b.id,true); }
    else { const s=getSelection(); pickImageInline(el,s.rangeCount?s.getRangeAt(0).cloneRange():null); }
    return;
  }
  insertTypeAt(pg,bi,it.k,isBlank(b.html));
}
function slashKey(e){
  if(!slash.open) return false;
  if(!slash.el||!document.contains(slash.el)){ closeSlash(); return false; }
  if(e.key==='ArrowDown'){ e.preventDefault(); slash.idx=(slash.idx+1)%Math.max(1,slash.items.length); drawSlash(); return true; }
  if(e.key==='ArrowUp'){ e.preventDefault(); slash.idx=(slash.idx-1+slash.items.length)%Math.max(1,slash.items.length); drawSlash(); return true; }
  if(e.key==='Enter'||e.key==='Tab'){ e.preventDefault(); chooseSlash(slash.items[slash.idx]); return true; }
  if(e.key==='Escape'){ e.preventDefault(); closeSlash(); return true; }
  return false;
}

/* ---- markdown shortcuts ---- */
const MD=[[/^###[\s ]/,'h3'],[/^##[\s ]/,'h2'],[/^#[\s ]/,'h1'],[/^[-*•][\s ]/,'bullet'],[/^\[[\s ]?\][\s ]/,'todo'],[/^1[.)][\s ]/,'num'],[/^>[\s ]/,'quote'],[/^![\s ]/,'callout']];
function mdBlock(x,t){
  const txt=t.textContent;
  if(txt==='---'){ const pg=x.pg; x.b.type='divider'; x.b.html=''; let next=pg.blocks[x.bi+1]; if(!next||!TEXT_TYPES.includes(next.type)){ next=newBlock('p'); pg.blocks.splice(x.bi+1,0,next);} savePage(pg); rerenderBlocks(); focusBlock(next.id,0); return true; }
  if(x.b.type!=='p') return false;
  for(const [re,k] of MD){ const m=txt.match(re); if(m&&caretOffset(t)===m[0].length){ deleteOffsets(t,0,m[0].length); x.b.html=sanitize(t.innerHTML); setType(x.pg,x.b,k); savePage(x.pg); rerenderBlocks(); focusBlock(x.b.id,0); return true; } }
  return false;
}
function mdLine(x,t){
  if(x.line.t!=='p') return false;
  const txt=t.textContent; let k=null,m;
  if((m=txt.match(/^[-*•][\s ]/))) k='bullet'; else if((m=txt.match(/^\[[\s ]?\][\s ]/))) k='todo';
  if(!k||caretOffset(t)!==m[0].length) return false;
  deleteOffsets(t,0,m[0].length); x.line.html=sanitize(t.innerHTML); x.line.t=k; savePage(x.pg); rerenderBlocks(); focusLine(x.b.id,x.r,x.c,x.l,0); return true;
}

/* ---- key handling ---- */
function blockKeys(e,x,t){
  const {pg,b,bi,blkEl}=x;
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){
    e.preventDefault();
    if(isBlankEl(t)&&['bullet','num','todo','quote','callout'].includes(b.type)){
      if((b.level||0)>0) b.level--; else setType(pg,b,'p');
      savePage(pg); rerenderBlocks(); focusBlock(b.id,0); return;
    }
    const off=caretOffset(t);
    const nt=LIST_TYPES.includes(b.type)?b.type:'p';
    if(off===0&&t.textContent.length){
      const nb=newBlock(nt,{level:b.level||0}); pg.blocks.splice(bi,0,nb);
      savePage(pg); rerenderBlocks(); focusBlock(b.id,0); return;
    }
    const tail=splitAtCaret(t); b.html=sanitize(t.innerHTML);
    const nb=newBlock(nt,{html:tail,level:b.level||0});
    let at=bi+1;
    if(isHeading(b.type)&&b.collapsed) at=sectionEnd(pg.blocks,bi);
    pg.blocks.splice(at,0,nb);
    savePage(pg); rerenderBlocks(); focusBlock(nb.id,0); return;
  }
  if(e.key==='Backspace'&&caretAtStart(t)){
    if(b.type!=='p'){ e.preventDefault(); setType(pg,b,'p'); savePage(pg); rerenderBlocks(); focusBlock(b.id,0); return; }
    if((b.level||0)>0){ e.preventDefault(); b.level--; savePage(pg); rerenderBlocks(); focusBlock(b.id,0); return; }
    const prevEl=blkEl.previousElementSibling&&blkEl.previousElementSibling.classList.contains('blk')?blkEl.previousElementSibling:(blkEl.previousElementSibling&&blkEl.previousElementSibling.previousElementSibling);
    if(!prevEl||!prevEl.classList||!prevEl.classList.contains('blk')) return;
    const pi=pg.blocks.findIndex(q=>q.id===prevEl.dataset.id); const prev=pg.blocks[pi]; if(!prev) return;
    e.preventDefault();
    if((prev.type==='divider'||prev.type==='page')&&LOCK) return;
    if(prev.type==='divider'||prev.type==='page'){ pg.blocks.splice(pi,1); savePage(pg); rerenderBlocks(); focusBlock(b.id,0); return; }
    if(prev.type==='table'||prev.type==='image'){ if(isBlankEl(t)){ pg.blocks.splice(bi,1); savePage(pg); rerenderBlocks(); const last=$$(`#blocks .blk[data-id="${prev.id}"] .txt`).pop(); focusEl(last,'end'); } return; }
    const len=plain(prev.html).length; prev.html=(prev.html||'')+(b.html||''); pg.blocks.splice(bi,1);
    savePage(pg); rerenderBlocks(); focusBlock(prev.id,len); return;
  }
  if(e.key==='Delete'&&caretAtEnd(t)){
    const nextEl=blkEl.nextElementSibling; if(!nextEl||!nextEl.classList.contains('blk')) return;
    const ni=pg.blocks.findIndex(q=>q.id===nextEl.dataset.id); const nx=pg.blocks[ni];
    if(!nx||!TEXT_TYPES.includes(nx.type)) return;
    e.preventDefault(); const len=t.textContent.length; b.html=sanitize(t.innerHTML)+(nx.html||''); pg.blocks.splice(ni,1); savePage(pg); rerenderBlocks(); focusBlock(b.id,len); return;
  }
  if(e.key==='Tab'){
    e.preventDefault(); const off=caretOffset(t);
    b.level=clamp((b.level||0)+(e.shiftKey?-1:1),0,4); savePage(pg); rerenderBlocks(); focusBlock(b.id,off); return;
  }
  if((e.key==='ArrowUp'&&onFirstLine(t))||(e.key==='ArrowDown'&&onLastLine(t))){
    if(e.shiftKey) return;
    const all=$$('#page-title, #blocks .txt'); const i=all.indexOf(t); const tgt=all[e.key==='ArrowUp'?i-1:i+1];
    if(tgt){ e.preventDefault(); focusEl(tgt,e.key==='ArrowUp'?'end':'start'); }
  }
}
function lineKeys(e,x,t){
  const {pg,b,r,c,cell,l,line}=x;
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){
    e.preventDefault();
    if(isBlankEl(t)&&line.t!=='p'){ line.t='p'; delete line.done; savePage(pg); rerenderBlocks(); focusLine(b.id,r,c,l,0); return; }
    const tail=splitAtCaret(t); line.html=sanitize(t.innerHTML);
    cell.lines.splice(l+1,0,{t:line.t,html:tail});
    savePage(pg); rerenderBlocks(); focusLine(b.id,r,c,l+1,0); return;
  }
  if(e.key==='Backspace'&&caretAtStart(t)){
    if(line.t!=='p'){ e.preventDefault(); line.t='p'; delete line.done; savePage(pg); rerenderBlocks(); focusLine(b.id,r,c,l,0); return; }
    if(l>0){ e.preventDefault(); const prev=cell.lines[l-1]; const len=plain(prev.html).length; prev.html=(prev.html||'')+(line.html||''); cell.lines.splice(l,1); savePage(pg); rerenderBlocks(); focusLine(b.id,r,c,l-1,len); }
    return;
  }
  if(e.key==='Tab'){
    e.preventDefault();
    const cols=b.rows[0].cells.length, rows=b.rows.length; let idx=r*cols+c+(e.shiftKey?-1:1);
    if(idx>=rows*cols){ b.rows.push({cells:Array.from({length:cols},()=>emptyCell())}); savePage(pg); rerenderBlocks(); }
    idx=clamp(idx,0,b.rows.length*cols-1);
    focusLine(b.id,Math.floor(idx/cols),idx%cols,0,'end'); return;
  }
}

/* ---- document events ---- */
const viewEl=$('#view');
viewEl.addEventListener('input',e=>{ typingNow=!!e.inputType&&!/^history/.test(e.inputType); },true);
document.addEventListener('input',()=>{ typingNow=false; });
viewEl.addEventListener('input',e=>{
  const t=e.target; const pg=curPage(); if(!pg) return;
  if(t.id==='page-title'){
    if(t.innerHTML==='<br>') t.innerHTML='';
    pg.title=t.textContent.replace(/\s+/g,' ').trim(); savePage(pg);
    const it=$(`.ti-main[data-id="${pg.id}"] .ti-t`); if(it) it.textContent=pTitle(pg);
    $('#tb-t').textContent=pTitle(pg); return;
  }
  if(t.classList.contains('cap')){ const x=ctxOf(t); if(x){ x.b.caption=t.textContent; savePage(pg); } return; }
  if(t.classList.contains('pk')||t.classList.contains('pv')){
    const i=+t.closest('.prop').dataset.i; const pr=pg.props[i]; if(!pr) return;
    pr[t.classList.contains('pk')?'k':'v']=t.textContent; savePage(pg); return;
  }
  if(!t.classList.contains('txt')) return;
  if(t.innerHTML==='<br>') t.innerHTML='';
  const x=ctxOf(t); if(!x) return;
  const typed=e.inputType==='insertText';
  if(x.line){ x.line.html=t.innerHTML; if(typed&&mdLine(x,t)) return; savePage(pg); return; }
  x.b.html=t.innerHTML;
  if(typed&&mdBlock(x,t)) return;
  if(slash.open) updateSlash();
  else if(typed&&e.data==='/'){ const off=caretOffset(t); const before=t.textContent.slice(0,off-1); if(!before||/\s$/.test(before)) openSlash(t,x.b.id,off-1,'slash'); }
  savePage(pg);
});
viewEl.addEventListener('keydown',e=>{
  const t=e.target;
  if(slashKey(e)) return;
  if(t.id==='page-title'){
    if(e.key==='Enter'||(e.key==='ArrowDown'&&onLastLine(t))){ e.preventDefault(); const pg=curPage(); if(!pg.blocks.length){ pg.blocks.push(newBlock('p')); rerenderBlocks(); } const first=$('#blocks .txt'); if(first) focusEl(first,'start'); else { pg.blocks.unshift(newBlock('p')); rerenderBlocks(); focusEl($('#blocks .txt'),0);} }
    return;
  }
  if(t.classList.contains('cap')){ if(e.key==='Enter'){ e.preventDefault(); const x=ctxOf(t); if(!x) return; let nx=x.pg.blocks[x.bi+1]; if(!nx||!TEXT_TYPES.includes(nx.type)){ nx=newBlock('p'); x.pg.blocks.splice(x.bi+1,0,nx); savePage(x.pg); rerenderBlocks(); } focusBlock(nx.id,0); } return; }
  if(t.classList.contains('pk')||t.classList.contains('pv')){ if(e.key==='Enter'){ e.preventDefault(); if(t.classList.contains('pk')) focusEl(t.nextElementSibling,'end'); else t.blur(); } return; }
  if(!t.classList.contains('txt')) return;
  if((e.metaKey||e.ctrlKey)&&!e.altKey){
    const k=e.key.toLowerCase();
    if(k==='b'||k==='i'||k==='u'){ e.preventDefault(); document.execCommand({b:'bold',i:'italic',u:'underline'}[k]); return; }
    if(k==='e'){ e.preventDefault(); applyMark('hl-purple'); return; }
  }
  const x=ctxOf(t); if(!x) return;
  if(x.line) lineKeys(e,x,t); else blockKeys(e,x,t);
});
viewEl.addEventListener('paste',e=>{
  const t=e.target.closest&&e.target.closest('.txt, #page-title, .pk, .pv, .cap'); if(!t) return;
  e.preventDefault();
  const imgs=[...(e.clipboardData.files||[])].filter(f=>f.type.startsWith('image/'));
  if(imgs.length&&t.classList.contains('txt')){ const s=getSelection(); handleImageFiles(imgs,t,s.rangeCount?s.getRangeAt(0).cloneRange():null); return; }
  const text=(e.clipboardData.getData('text/plain')||'').replace(/\r/g,'');
  if(!t.classList.contains('txt')||!text.includes('\n')){ document.execCommand('insertText',false,text.replace(/\n+/g,' ')); return; }
  const x=ctxOf(t); if(!x) return;
  const lines=text.split('\n').filter(s=>s.trim().length);
  if(!lines.length) return;
  const parse=raw=>{
    const ind=(raw.match(/^[\t ]*/)[0]).replace(/\t/g,'  ').length; let s=raw.trim(), type='p', done=false, m;
    if((m=s.match(/^\[([ xX]?)\]\s*/))){ type='todo'; done=/x/i.test(m[1]); s=s.slice(m[0].length); }
    else if((m=s.match(/^[☐☑✅✔]\s*/))){ type='todo'; done=m[0].trim()!=='☐'; s=s.slice(m[0].length); }
    else if((m=s.match(/^[-*•◦▪]\s+/))){ type='bullet'; s=s.slice(m[0].length); }
    else if((m=s.match(/^(#{1,3})\s+/))){ type='h'+m[1].length; s=s.slice(m[0].length); }
    else if((m=s.match(/^\d+[.)]\s+/))){ type='num'; s=s.slice(m[0].length); }
    return {type,done,html:esc(s),level:Math.min(4,Math.floor(ind/2))};
  };
  const tail=splitAtCaret(t);
  const first=parse(lines[0]);
  document.execCommand('insertText',false,plain(first.html));
  const rest=lines.slice(1).map(parse);
  const pg=x.pg;
  if(x.line){
    x.line.html=sanitize(t.innerHTML);
    const nl=rest.map(p=>({t:p.type==='todo'?'todo':p.type==='bullet'?'bullet':'p',html:p.html,done:p.done||undefined}));
    if(nl.length){ nl[nl.length-1].html+=tail; } else x.line.html+=tail;
    x.cell.lines.splice(x.l+1,0,...nl);
    savePage(pg); rerenderBlocks(); focusLine(x.b.id,x.r,x.c,x.l+nl.length,'end'); return;
  }
  x.b.html=sanitize(t.innerHTML);
  const nbs=rest.map(p=>{ const nb=newBlock('p',{html:p.html,level:p.level}); setType(pg,nb,p.type); if(p.type==='todo'&&p.done) nb.done=true; return nb; });
  if(nbs.length) nbs[nbs.length-1].html+=tail; else x.b.html+=tail;
  pg.blocks.splice(x.bi+1,0,...nbs);
  savePage(pg); rerenderBlocks();
  const last=nbs.length?nbs[nbs.length-1]:x.b; focusBlock(last.id,plain(last.html).length-plain(tail).length);
});
viewEl.addEventListener('focusin',e=>{
  const t=e.target;
  if(t.classList&&t.classList.contains('cell-txt')) showCellbar(t); else hideCellbar();
});
viewEl.addEventListener('focusout',()=>{
  setTimeout(()=>{
    const a=document.activeElement;
    if(!a||!a.classList||!a.classList.contains('cell-txt')) hideCellbar();
    if(S.deferRemote&&!S.modal&&!($('#doc')&&$('#doc').contains(a))) renderMain();
  },80);
});

/* ---- drag & drop ---- */
let dragId=null;
viewEl.addEventListener('dragstart',e=>{
  const h=e.target.closest&&e.target.closest('.g-drag'); if(!h){ return; }
  if(LOCK){ e.preventDefault(); return; }
  const blk=h.closest('.blk'); dragId=blk.dataset.id;
  e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','');
  try{ e.dataTransfer.setDragImage(blk,16,12); }catch(_){}
  requestAnimationFrame(()=>blk.classList.add('dragging'));
});
const hasFiles=e=>e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files');
viewEl.addEventListener('dragover',e=>{
  if(!dragId&&hasFiles(e)&&$('#doc')){ e.preventDefault(); e.dataTransfer.dropEffect='copy'; return; }
  if(!dragId) return; const blk=e.target.closest('#blocks .blk'); if(!blk) return;
  e.preventDefault(); $$('.drop-before,.drop-after').forEach(x=>x.classList.remove('drop-before','drop-after'));
  const rc=blk.getBoundingClientRect(); blk.classList.add(e.clientY<rc.top+rc.height/2?'drop-before':'drop-after');
});
viewEl.addEventListener('drop',e=>{
  if(!dragId&&hasFiles(e)&&$('#doc')){
    e.preventDefault();
    const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')||/\.(heic|heif)$/i.test(f.name));
    if(!files.length) return toast('Sem jde přetáhnout jen obrázek.');
    const host=e.target.closest&&e.target.closest('#doc .txt');
    if(host){ handleImageFiles(files,host,rangeFromPoint(e.clientX,e.clientY)); return; }
    const pg=curPage(); const blk=e.target.closest&&e.target.closest('#blocks .blk');
    const after=blk?blk.dataset.id:(pg.blocks.length?pg.blocks[pg.blocks.length-1].id:null);
    if(!after){ const nb=newBlock('p'); pg.blocks.push(nb); pickImageBlock(pg.id,nb.id,true,files[0]); return; }
    pickImageBlock(pg.id,after,false,files[0]); return;
  }
  if(!dragId) return; e.preventDefault();
  const tgt=$('.drop-before,.drop-after'); const pg=curPage();
  if(tgt&&pg&&tgt.dataset.id!==dragId){
    const after=tgt.classList.contains('drop-after');
    const from=pg.blocks.findIndex(b=>b.id===dragId); const [blk]=pg.blocks.splice(from,1);
    let to=pg.blocks.findIndex(b=>b.id===tgt.dataset.id); if(after) to++;
    pg.blocks.splice(to,0,blk); savePage(pg);
  }
  endDrag(); rerenderBlocks();
});
viewEl.addEventListener('dragend',endDrag);
function endDrag(){ dragId=null; $$('.drop-before,.drop-after,.dragging').forEach(x=>x.classList.remove('drop-before','drop-after','dragging')); }

/* ---- format toolbar ---- */
const fmt=$('#fmt');
fmt.innerHTML=`<button data-f="bold" aria-label="Tučně"><b>B</b></button><button data-f="italic" aria-label="Kurzíva"><i>I</i></button><button data-f="underline" aria-label="Podtržení"><u>U</u></button><button data-f="strikeThrough" aria-label="Přeškrtnutí"><s>S</s></button><button data-f="link" aria-label="Odkaz" title="Udělat z textu odkaz">🔗</button><span class="sep"></span>${COLORS.map(c=>`<button class="sw hl-${c}" data-f="hl-${c}" aria-label="Zvýraznit: ${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}<span class="sep"></span><button data-f="clear" aria-label="Zrušit formátování" title="Zrušit formátování">⌫</button>`;
fmt.addEventListener('mousedown',e=>e.preventDefault());
fmt.addEventListener('click',e=>{
  const b=e.target.closest('[data-f]'); if(!b) return; const f=b.dataset.f;
  if(f==='link'){ const s=getSelection(); if(!s.rangeCount) return; const r=s.getRangeAt(0); const n=r.commonAncestorContainer; const host=(n.nodeType===1?n:n.parentElement).closest('.txt'); if(host){ hideFmt(); openLinkDialog(host,r.cloneRange(),true); } return; }
  if(f.startsWith('hl-')) applyMark(f);
  else if(f==='clear'){ document.execCommand('removeFormat'); applyMark(null); }
  else document.execCommand(f);
  updateFmt();
});
function applyMark(cls){
  const s=getSelection(); if(!s.rangeCount||s.isCollapsed) return;
  const r=s.getRangeAt(0); const ca=r.commonAncestorContainer; const caEl=ca.nodeType===1?ca:ca.parentElement;
  const host=caEl.closest('.txt'); if(!host) return;
  const anc=caEl.closest('mark');
  if(anc&&host.contains(anc)){ if(cls) anc.className=cls; else unwrap(anc); }
  else{
    const frag=r.extractContents(); frag.querySelectorAll('mark').forEach(unwrap);
    if(cls){ const m=document.createElement('mark'); m.className=cls; m.appendChild(frag); r.insertNode(m); const nr=document.createRange(); nr.selectNodeContents(m); s.removeAllRanges(); s.addRange(nr); }
    else r.insertNode(frag);
  }
  host.dispatchEvent(new Event('input',{bubbles:true}));
}
let fmtT=null;
document.addEventListener('selectionchange',()=>{ clearTimeout(fmtT); fmtT=setTimeout(updateFmt,80); });
function updateFmt(){
  const s=getSelection();
  if(!s.rangeCount||s.isCollapsed){ hideFmt(); return; }
  const n=s.anchorNode; const el=n&&(n.nodeType===1?n:n.parentElement); const host=el&&el.closest('.txt');
  if(!host||!host.closest('#doc')||!host.contains(s.focusNode)){ hideFmt(); return; }
  const rc=s.getRangeAt(0).getBoundingClientRect(); if(!rc.width&&!rc.height){ hideFmt(); return; }
  fmt.hidden=false; hideCellbar();
  const w=fmt.offsetWidth,h=fmt.offsetHeight;
  fmt.style.left=clamp(rc.left+rc.width/2-w/2,8,innerWidth-w-8)+'px';
  fmt.style.top=(rc.top-h-8<8?rc.bottom+8:rc.top-h-8)+'px';
}
function hideFmt(){ fmt.hidden=true; }

/* ---- table cell line-type bar ---- */
const cellbar=$('#cellbar'); let cellTarget=null;
cellbar.addEventListener('mousedown',e=>e.preventDefault());
cellbar.addEventListener('click',e=>{
  const b=e.target.closest('[data-lt]'); if(!b||!cellTarget) return;
  if(b.dataset.lt==='link'){ const s=getSelection(); openLinkDialog(cellTarget,s.rangeCount&&cellTarget.contains(s.getRangeAt(0).startContainer)?s.getRangeAt(0).cloneRange():null,!s.isCollapsed); return; }
  if(b.dataset.lt==='img'){ const s=getSelection(); pickImageInline(cellTarget,s.rangeCount&&cellTarget.contains(s.getRangeAt(0).startContainer)?s.getRangeAt(0).cloneRange():null); return; }
  const x=ctxOf(cellTarget); if(!x||!x.line) return;
  const off=caretOffset(cellTarget);
  x.line.t=b.dataset.lt; if(x.line.t!=='todo') delete x.line.done;
  savePage(x.pg); rerenderBlocks(); focusLine(x.b.id,x.r,x.c,x.l,off);
});
function showCellbar(t){
  const x=ctxOf(t); if(!x||!x.line){ hideCellbar(); return; }
  cellTarget=t; cellbar.hidden=false;
  $$('button',cellbar).forEach(b=>b.classList.toggle('on',b.dataset.lt===x.line.t));
  if(!cellbar.hidden&&imgSel) hideImgSel();
  const rc=x.td.getBoundingClientRect(); const w=cellbar.offsetWidth;
  cellbar.style.left=clamp(rc.right-w,8,innerWidth-w-8)+'px';
  cellbar.style.top=Math.max(8,rc.top-cellbar.offsetHeight-4)+'px';
}
function hideCellbar(){ cellbar.hidden=true; cellTarget=null; }
document.addEventListener('dragover',e=>{ if(hasFiles(e)) e.preventDefault(); });
document.addEventListener('drop',e=>{ if(hasFiles(e)) e.preventDefault(); });
viewEl.addEventListener('error',e=>{ if(e.target.tagName==='IMG') e.target.classList.add('broken'); },true);
$('#main').addEventListener('scroll',()=>{ $('#main').classList.toggle('scrolled',$('#main').scrollTop>4); placeFrame(); if(!fmt.hidden) updateFmt(); if(slash.open) drawSlash(); },{passive:true});

/* ================= popovers, modal, toast ================= */
function placePop(p,rc){
  const w=p.offsetWidth,h=p.offsetHeight;
  let x=clamp(rc.left,8,innerWidth-w-8), y=rc.bottom+6;
  if(y+h>innerHeight-8) y=Math.max(8,rc.top-h-6);
  p.style.left=x+'px'; p.style.top=y+'px';
}
function openPop(anchor,html,handler){
  closePop();
  const p=document.createElement('div'); p.className='pop'; p.innerHTML=html; document.body.appendChild(p);
  placePop(p,anchor.getBoundingClientRect());
  p.addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(b){ const keep=handler(b.dataset.v,b,p); if(keep!==true) closePop(); } });
  S.pop=p; S.popAnchor=anchor; return p;
}
function closePop(){ if(S.pop){ S.pop.remove(); S.pop=null; S.popAnchor=null; } }
document.addEventListener('mousedown',e=>{
  const inFrame=e.target.closest&&e.target.closest('#imgframe');
  if(S.pop&&!inFrame&&!S.pop.contains(e.target)&&!(S.popAnchor&&S.popAnchor.contains(e.target))) closePop();
  if(imgSel&&!inFrame&&e.target!==imgSel.img&&!(S.pop&&S.pop.contains(e.target))) hideImgSel();
  if(slash.open&&!e.target.closest('#slash')&&e.target!==slash.el) closeSlash();
},true);

function openModal(title,body,cls){
  closeModal(); closePop();
  const ov=document.createElement('div'); ov.className='ov';
  ov.innerHTML=`<div class="modal ${cls||''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">${title?`<div class="m-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Zavřít">×</button></div>`:''}${body}</div>`;
  document.body.appendChild(ov);
  ov.addEventListener('mousedown',e=>{ if(e.target===ov) closeModal(); });
  ov.addEventListener('click',e=>{ if(e.target.closest('[data-close]')) closeModal(); });
  S.modal=ov; return ov.firstElementChild;
}
function closeModal(){ if(S.modal){ S.modal.remove(); S.modal=null; if(S.deferRemote) renderMain(); } }
let toastT=null;
function toast(msg,actLabel,act){
  let t=$('.toast'); if(t) t.remove(); clearTimeout(toastT);
  t=document.createElement('div'); t.className='toast'; t.setAttribute('role','status');
  t.innerHTML=`<span>${esc(msg)}</span>${actLabel?`<button>${esc(actLabel)}</button>`:''}`;
  document.body.appendChild(t);
  if(act) t.querySelector('button').addEventListener('click',()=>{ act(); t.remove(); });
  toastT=setTimeout(()=>t.remove(),act?7000:4000);
}

/* ================= menus ================= */
function openBlockMenu(anchor,pg,b){
  let h='';
  if(LOCK){
    /* zamčeno: u zvýrazněného bloku jde jen změnit ikonu a barvu, nic se nepřesouvá ani nemaže */
    if(b.type!=='callout') return;
    h=`<div class="pop-h">Ikona</div><div class="swatches">${CALLOUT_IC.map(ic=>`<button class="pop-item" style="width:auto;padding:4px 6px;font-size:17px" data-v="icon:${ic}">${ic}</button>`).join('')}</div>
      <div class="pop-h">Barva</div><div class="swatches">${COLORS.map(c=>`<button class="sw hl-${c} ${b.color===c?'on':''}" data-v="color:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>`;
    openPop(anchor,h,v=>{ if(v.startsWith('color:')) b.color=v.slice(6); else if(v.startsWith('icon:')) b.icon=v.slice(5); savePage(pg); rerenderBlocks(); });
    return;
  }
  if(TEXT_TYPES.includes(b.type)) h+=`<div class="pop-h">Převést na</div>`+TEXT_TYPES.map(k=>`<button class="pop-item ${b.type===k?'act':''}" data-v="type:${k}"><span class="pi-ic">${TYPE_ICON[k]}</span>${TYPE_LABEL[k]}</button>`).join('');
  if(b.type==='callout'){
    h+=`<div class="pop-h">Ikona</div><div class="swatches">${CALLOUT_IC.map(ic=>`<button class="pop-item" style="width:auto;padding:4px 6px;font-size:17px" data-v="icon:${ic}">${ic}</button>`).join('')}</div>`;
    h+=`<div class="pop-h">Barva</div><div class="swatches">${COLORS.map(c=>`<button class="sw hl-${c} ${b.color===c?'on':''}" data-v="color:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>`;
  }
  if(b.type==='table') h+=`<div class="pop-h">Tabulka</div><button class="pop-item" data-v="hrow"><span class="pi-ic">${b.hrow?'✓':''}</span>První řádek jako záhlaví</button><button class="pop-item" data-v="hcol"><span class="pi-ic">${b.hcol?'✓':''}</span>První sloupec jako záhlaví</button>`;
  {
    const bl=pg.blocks, xi=bl.indexOf(b); let sec='';
    for(let i=xi-1;i>=0;i--){
      const hb=bl[i]; if(!hLevel(hb.type)) continue;
      const inDef=defaultEnd(bl,i)>xi, isEnd=hb.until===b.id;
      if(!inDef&&!isEnd) continue;
      const nm=esc(plain(hb.html).trim().slice(0,34)||'Nadpis')+(plain(hb.html).trim().length>34?'…':'');
      sec+=isEnd?`<button class="pop-item act" data-v="until-x:${hb.id}"><span class="pi-ic">✓</span><span>„${nm}“ se sbaluje až sem<small>Klikni pro zrušení (zpět po další nadpis)</small></span></button>`
               :`<button class="pop-item" data-v="until:${hb.id}"><span class="pi-ic">⤓</span><span>Sbalovat „${nm}“ až sem<small>Tento blok se schová, další zůstanou vidět</small></span></button>`;
    }
    if(isHeading(b.type)&&b.until){ sec+=`<button class="pop-item" data-v="until-x:${b.id}"><span class="pi-ic">↺</span><span>Sbalovat automaticky<small>Až po další nadpis stejné úrovně</small></span></button>`; }
    if(sec) h+=`${h?'<div class="pop-sep"></div>':''}<div class="pop-h">Sbalování sekce</div>`+sec;
  }
  h+=`${h?'<div class="pop-sep"></div>':''}<button class="pop-item" data-v="up"><span class="pi-ic">↑</span>Posunout nahoru</button><button class="pop-item" data-v="down"><span class="pi-ic">↓</span>Posunout dolů</button><button class="pop-item" data-v="dup"><span class="pi-ic">⧉</span>Duplikovat</button><button class="pop-item danger" data-v="del"><span class="pi-ic">×</span>Smazat</button>`;
  openPop(anchor,h,v=>{
    const bi=pg.blocks.indexOf(b); if(bi<0) return;
    if(v.startsWith('type:')){ setType(pg,b,v.slice(5)); }
    else if(v.startsWith('color:')) b.color=v.slice(6);
    else if(v.startsWith('icon:')) b.icon=v.slice(5);
    else if(v.startsWith('until:')){ const hb=pg.blocks.find(q=>q.id===v.slice(6)); if(hb) hb.until=b.id; }
    else if(v.startsWith('until-x:')){ const hb=pg.blocks.find(q=>q.id===v.slice(8)); if(hb) delete hb.until; }
    else if(v==='hrow') b.hrow=!b.hrow;
    else if(v==='hcol') b.hcol=!b.hcol;
    else if(v==='up'&&bi>0){ pg.blocks.splice(bi,1); pg.blocks.splice(bi-1,0,b); }
    else if(v==='down'&&bi<pg.blocks.length-1){ pg.blocks.splice(bi,1); pg.blocks.splice(bi+1,0,b); }
    else if(v==='dup'){ const c=clone(b); c.id=rid(); pg.blocks.splice(bi+1,0,c); }
    else if(v==='del'){
      pg.blocks.splice(bi,1); savePage(pg); rerenderBlocks();
      toast('Blok smazán','Vrátit',()=>{ pg.blocks.splice(Math.min(bi,pg.blocks.length),0,b); savePage(pg); rerenderBlocks(); });
      return;
    }
    savePage(pg); rerenderBlocks();
    if(TEXT_TYPES.includes(b.type)) focusBlock(b.id,'end');
  });
}
function openTableMenu(anchor,pg,b,kind,idx){
  const h=kind==='row'
    ?`<button class="pop-item" data-v="above"><span class="pi-ic">↑</span>Vložit řádek nad</button><button class="pop-item" data-v="below"><span class="pi-ic">↓</span>Vložit řádek pod</button><button class="pop-item danger" data-v="del"><span class="pi-ic">×</span>Smazat řádek</button>`
    :`<button class="pop-item" data-v="left"><span class="pi-ic">←</span>Vložit sloupec vlevo</button><button class="pop-item" data-v="right"><span class="pi-ic">→</span>Vložit sloupec vpravo</button><button class="pop-item danger" data-v="del"><span class="pi-ic">×</span>Smazat sloupec</button>`;
  openPop(anchor,h,v=>{
    const cols=b.rows[0].cells.length;
    if(kind==='row'){
      if(v==='del'){ if(b.rows.length<=1) return toast('Tabulka musí mít aspoň jeden řádek.'); b.rows.splice(idx,1); }
      else b.rows.splice(v==='above'?idx:idx+1,0,{cells:Array.from({length:cols},()=>emptyCell())});
    } else {
      if(v==='del'){ if(cols<=1) return toast('Tabulka musí mít aspoň jeden sloupec.'); b.rows.forEach(r=>r.cells.splice(idx,1)); }
      else b.rows.forEach(r=>r.cells.splice(v==='left'?idx:idx+1,0,emptyCell()));
    }
    savePage(pg); rerenderBlocks();
  });
}
function openIconPop(anchor,pg){
  const h=`<div class="pop-h">Ikona</div><div class="emoji-grid">${EMOJI.map(e=>`<button data-v="e:${e}" aria-label="${e}">${e}</button>`).join('')}</div>
    <div class="emoji-in"><input class="inp" id="emoji-custom" placeholder="Vlastní emoji" maxlength="8" aria-label="Vlastní emoji"><button class="btn" data-v="custom">Použít</button></div>
    <div class="pop-h">Barva stránky</div><div class="swatches">${COLORS.map(c=>`<button class="sw hl-${c} ${pg.color===c?'on':''}" data-v="c:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>
    <div class="pop-sep"></div><button class="pop-item" data-v="none"><span class="pi-ic">∅</span>Odebrat ikonu</button>`;
  openPop(anchor,h,(v,btn,p)=>{
    if(v.startsWith('e:')) pg.icon=v.slice(2);
    else if(v.startsWith('c:')){ pg.color=v.slice(2); savePage(pg); renderSidebar(); $$('.sw',p).forEach(s=>s.classList.toggle('on',s.dataset.v===v)); return true; }
    else if(v==='custom'){ const val=$('#emoji-custom',p).value.trim(); if(!val) return true; pg.icon=val; }
    else if(v==='none') pg.icon='';
    savePage(pg); renderSidebar(); renderPage(pg);
  });
}
function openPageMenu(anchor,pg){
  const h=`<button class="pop-item" data-v="sub"><span class="pi-ic">+</span>Přidat podstránku</button><button class="pop-item" data-v="up"><span class="pi-ic">↑</span>Posunout nahoru</button><button class="pop-item" data-v="down"><span class="pi-ic">↓</span>Posunout dolů</button>${pg.parent?'<button class="pop-item" data-v="top"><span class="pi-ic">⇤</span>Přesunout na nejvyšší úroveň</button>':''}<button class="pop-item" data-v="dup"><span class="pi-ic">⧉</span>Duplikovat</button><div class="pop-sep"></div><button class="pop-item danger" data-v="del"><span class="pi-ic">×</span>Smazat</button>`;
  openPop(anchor,h,v=>{
    if(v==='sub'){ const c=createPage(pg.id); renderSidebar(); go({kind:'page',pageId:c.id}); setTimeout(()=>$('#page-title')&&$('#page-title').focus(),30); return; }
    if(v==='up'||v==='down'){
      const sib=kids(pg.parent||null); sib.forEach((s,i)=>{ if(s.order!==i+1){ s.order=i+1; savePage(s,0);} });
      const i=sib.indexOf(pg), j=v==='up'?i-1:i+1; if(j<0||j>=sib.length) return;
      const o=sib[j].order; sib[j].order=pg.order; pg.order=o; savePage(sib[j],0); savePage(pg,0); renderSidebar(); return;
    }
    if(v==='top'){ pg.parent=null; const sib=kids(null); pg.order=(sib.length?Math.max(...sib.map(s=>s.order||0)):0)+1; savePage(pg,0); renderSidebar(); if(curPage()===pg) renderPage(pg); return; }
    if(v==='dup'){
      const c=clone(pg); c.id=rid(); c.title=(pg.title||'Bez názvu')+' (kopie)'; c.order=(pg.order||0)+.5;
      c.blocks.forEach(b=>b.id=rid()); S.pages[c.id]=c; savePage(c,0); renderSidebar(); go({kind:'page',pageId:c.id}); return;
    }
    if(v==='del') deletePage(pg.id);
  });
}
function deletePage(id){
  const ids=[id,...descendants(id)]; const backup=ids.map(i=>clone(S.pages[i])); const title=pTitle(S.pages[id]);
  ids.forEach(i=>{ delete S.pages[i]; }); Store.queue();
  if(S.view.kind==='page'&&ids.includes(S.view.pageId)) go({kind:'today'}); else { renderSidebar(); renderMain(); }
  toast(`Stránka „${title}“ smazána${ids.length>1?` i s ${ids.length-1} podstránkami`:''}`,'Vrátit',()=>{
    backup.forEach(p=>{ S.pages[p.id]=p; savePage(p,0); }); renderSidebar(); renderMain();
  });
}

/* nadpisy H1 = předměty (stejně jako u úkolů) */
function allH1(){
  const out=[];
  flatPages().forEach(({p})=>(p.blocks||[]).forEach(b=>{ if(b.type!=='h1') return; const text=plain(b.html).replace(/\s+/g,' ').trim(); if(!text) return;
    out.push({key:p.id+'|'+b.id,pageId:p.id,blockId:b.id,text,short:text.split(/\s+[—–-]\s+/)[0].replace(/^[^\p{L}\p{N}]+/u,'').trim()||text}); }));
  return out;
}
/* otevře stránku, rozbalí sekce nad blokem (a u nadpisu i jeho sekci) a doskroluje k němu */
function revealBlock(pageId,blockId,openSelf){
  const pg=S.pages[pageId]; if(!pg) return toast('Stránka už neexistuje.');
  const bl=pg.blocks, idx=bl.findIndex(b=>b.id===blockId); if(idx<0) return toast('Nadpis už na stránce není.');
  go({kind:'page',pageId});
  let opened=false;
  for(let i=idx-1;i>=0;i--){ if(isHeading(bl[i].type)&&bl[i].collapsed&&sectionEnd(bl,i)>idx){ bl[i].collapsed=false; opened=true; } }
  if(openSelf&&bl[idx].collapsed){ bl[idx].collapsed=false; opened=true; }
  if(opened) savePage(pg);
  rerenderBlocks();
  setTimeout(()=>{ const el=$(`#blocks .blk[data-id="${blockId}"]`); if(el){ el.scrollIntoView({block:openSelf?'start':'center'}); el.classList.add('flash'); } },30);
}

/* ================= schedule ================= */
function weekDates(){ const base=mondayOf(new Date()); base.setDate(base.getDate()+S.weekOffset*7); const n=S.settings.showWeekend?7:5; return Array.from({length:n},(_,i)=>{ const d=new Date(base); d.setDate(base.getDate()+i); return d; }); }
function hourRange(dates){
  let a=+S.settings.dayStart||7, b=+S.settings.dayEnd||20;
  dates.forEach(d=>eventsOnDate(d).forEach(ev=>{ a=Math.min(a,Math.floor(toMin(ev.start)/60)); b=Math.max(b,Math.ceil(toMin(ev.end)/60)); }));
  return [clamp(a,0,23),clamp(Math.max(b,a+1),1,24)];
}
function layoutDay(evs){
  const items=evs.map(ev=>({ev,s:toMin(ev.start),e:Math.max(toMin(ev.end),toMin(ev.start)+20)}));
  let cl=[],cur=[],end=-1;
  items.forEach(it=>{ if(cur.length&&it.s>=end){ cl.push(cur); cur=[]; end=-1; } cur.push(it); end=Math.max(end,it.e); });
  if(cur.length) cl.push(cur);
  cl.forEach(c=>{ const cols=[]; c.forEach(it=>{ let i=cols.findIndex(e=>e<=it.s); if(i<0){ i=cols.length; cols.push(it.e);} else cols[i]=it.e; it.col=i; }); c.forEach(it=>it.n=cols.length); });
  return items;
}
function evColor(ev){ const p=S.pages[ev.pageId]; return ev.color||(p&&p.color)||'purple'; }
function evMeta(ev){ return [ev.place,ev.who].filter(Boolean).map(esc).join(' · '); }
/* krátký štítek: typ · L/S · 2/4 */
function evRep(ev,d){ if(ev.repeat==='odd') return 'L'; if(ev.repeat==='even') return 'S'; if(ev.repeat==='count'&&d){ const k=occIndex(ev,d); return k?`${k}/${+ev.count||1}`:''; } return ''; }
function evKind(ev,d){ return [TYPE_SHORT[ev.type],evRep(ev,d)].filter(Boolean).join(' · '); }
const HOUR_SCALES=[1,1.25,1.5,1.75,2];
/* bublina s celými informacemi po najetí myší na hodinu (u krátkých se nevejdou) */
const evtip=document.createElement('div'); evtip.className='evtip'; evtip.hidden=true; document.body.appendChild(evtip);
let evtipT=null, evtipFor=null;
function hideEvTip(){ clearTimeout(evtipT); evtipT=null; evtipFor=null; evtip.hidden=true; }
function showEvTip(btn){
  const ev=S.events[btn.dataset.id]; if(!ev) return;
  const d=parseD(btn.dataset.date), h=allH1().find(x=>x.key===ev.sec);
  const rep=ev.repeat==='odd'?'lichý týden':ev.repeat==='even'?'sudý týden':ev.repeat==='once'?'jednorázově':ev.repeat==='count'?`${occIndex(ev,d)}. z ${+ev.count||1}`:'každý týden';
  evtip.className='evtip hl-'+evColor(ev);
  evtip.innerHTML=`<div class="et-k">${esc([ev.type,rep].filter(Boolean).join(' · '))}</div><div class="et-t">${esc(ev.title||'Bez názvu')}</div>
    <div class="et-r">🕘 ${esc(ev.start)}–${esc(ev.end)}${d?` · ${DAYS_FULL[(d.getDay()+6)%7]} ${shortDate(d)}`:''}</div>
    ${ev.place?`<div class="et-r">📍 ${esc(ev.place)}</div>`:''}${ev.who?`<div class="et-r">👤 ${esc(ev.who)}</div>`:''}
    ${h?`<div class="et-r">📘 ${esc(h.short)}</div>`:''}${ev.note?`<div class="et-n">${esc(ev.note.length>180?ev.note.slice(0,180)+'…':ev.note)}</div>`:''}`;
  evtip.hidden=false;
  const r=btn.getBoundingClientRect(), w=evtip.offsetWidth, hgt=evtip.offsetHeight;
  let x=r.right+8; if(x+w>innerWidth-8) x=r.left-w-8; if(x<8) x=clamp(r.left,8,innerWidth-w-8);
  const y=clamp(r.top,8,innerHeight-hgt-8);
  evtip.style.left=x+'px'; evtip.style.top=y+'px';
}
if(matchMedia('(hover: hover)').matches){
  document.addEventListener('mouseover',e=>{
    const b=e.target.closest&&e.target.closest('#sg .ev');
    if(!b){ if(evtipFor) hideEvTip(); return; }
    if(b===evtipFor) return;
    hideEvTip(); evtipFor=b; evtipT=setTimeout(()=>{ if(evtipFor===b&&document.contains(b)) showEvTip(b); },320);
  });
  document.addEventListener('mousedown',hideEvTip,true);
  document.addEventListener('scroll',hideEvTip,true);
}
function renderSchedule(){
  hideEvTip();
  const dates=weekDates(), today=ymd(new Date()), wi=weekInfo(dates[0]);
  const [h0,h1]=hourRange(dates), hours=h1-h0, hh=Math.round(52*(HOUR_SCALES.includes(+S.settings.hourScale)?+S.settings.hourScale:1));
  const L=16.5*(+lsGet('uk-fs',1)||1); /* výška jednoho řádku textu v hodině */
  const last=dates[dates.length-1];
  const hasAny=Object.keys(S.events).length>0;
  let grid=`<div class="sg" style="--days:${dates.length};--hours:${hours};--hh:${hh}px" id="sg" data-h0="${h0}" data-hh="${hh}">
    <div class="sg-head"><div></div>${dates.map((d,i)=>`<div class="dh ${ymd(d)===today?'today':''}"><span>${DAYS[i]}</span><b>${d.getDate()}.</b></div>`).join('')}</div>
    <div class="sg-body"><div class="sg-times">${Array.from({length:hours},(_,i)=>`<span style="top:${i*hh}px">${h0+i}:00</span>`).join('')}</div>
    ${dates.map((d,i)=>{
      const items=layoutDay(eventsOnDate(d));
      let col=`<div class="sg-col ${ymd(d)===today?'today':''}" data-day="${i}" data-date="${ymd(d)}">`;
      items.forEach(it=>{
        const top=(it.s-h0*60)/60*hh, height=Math.max(22,(it.e-it.s)/60*hh-2), ev=it.ev, kind=evKind(ev,d);
        const size=height<2*L+12?'ev-xs':height<3*L+14?'ev-s':'';
        col+=`<div class="ev-w" style="top:${top}px;height:${height}px;left:calc(${it.col}*100%/${it.n} + 3px);width:calc(100%/${it.n} - 6px)">
          <button class="ev hl-${evColor(ev)} ${size}" data-act="ev" data-id="${ev.id}" data-date="${ymd(d)}">
          ${kind?`<span class="ev-k">${esc(kind)}</span>`:''}<span class="ev-t">${esc(ev.title||'Bez názvu')}</span><span class="ev-m mono">${esc(ev.start)}–${esc(ev.end)}</span>${evMeta(ev)?`<span class="ev-m">${evMeta(ev)}</span>`:''}</button>
          <button class="ev-add" data-act="ev-par" data-id="${ev.id}" data-date="${ymd(d)}" title="Přidat další událost ve stejný čas" aria-label="Přidat další událost ve stejný čas">+</button></div>`;
      });
      if(ymd(d)===today){ const nm=new Date().getHours()*60+new Date().getMinutes(); if(nm>=h0*60&&nm<=h1*60) col+=`<div class="now" style="top:${(nm-h0*60)/60*hh}px"></div>`; }
      return col+'<div class="ghost" hidden></div></div>';
    }).join('')}</div></div>`;
  const agenda=`<div class="agenda">${dates.map((d,i)=>{ const evs=eventsOnDate(d);
    return `<div class="ag-day"><div class="ag-dh ${ymd(d)===today?'today':''}"><span>${DAYS_FULL[i][0].toUpperCase()+DAYS_FULL[i].slice(1)} <span class="mono">${shortDate(d)}</span></span><button class="icon-btn" data-act="day-add" data-day="${i}" data-date="${ymd(d)}" aria-label="Přidat událost">+</button></div>
      ${evs.length?evs.map(ev=>evRow(ev,d)).join(''):'<div class="ag-empty">Nic naplánováno</div>'}</div>`; }).join('')}</div>`;
  $('#view').innerHTML=`<div class="view">
    <div class="v-head"><div><div class="eyebrow">${wi?`${wi.n}. týden výuky · ${wi.parity}`:'Týdenní rozvrh'}</div><h1 class="v-title">Rozvrh</h1></div>
      <div class="v-tools">
        <button class="navbtn" data-act="wk-prev" aria-label="Předchozí týden">‹</button>
        <button class="btn" data-act="wk-today">Tento týden</button>
        <button class="navbtn" data-act="wk-next" aria-label="Další týden">›</button>
        <span class="wk-label"><span>${shortDate(dates[0])} – ${shortDate(last)} ${last.getFullYear()}</span></span>
        <button class="btn pri" data-act="ev-add">＋ Přidat</button>
      </div></div>
    ${grid}${agenda}
    <p class="sched-hint">${hasAny?'Klikni do volného místa pro novou hodinu, klikni na hodinu pro úpravu.':'Rozvrh je zatím prázdný. Klikni do mřížky na den a čas, kdy máš hodinu, nebo použij ＋ Přidat.'} ${S.settings.semesterStart?'':'Pro liché a sudé týdny si v Nastavení zadej začátek semestru.'}</p>
  </div>`;
  const sg=$('#sg');
  sg.addEventListener('mousemove',e=>{
    const col=e.target.closest('.sg-col'); $$('.ghost',sg).forEach(g=>{ if(!col||g.parentElement!==col) g.hidden=true; });
    if(!col||e.target!==col) { if(col) $('.ghost',col).hidden=true; return; }
    const g=$('.ghost',col); const y=e.clientY-col.getBoundingClientRect().top; const m=h0*60+Math.floor(y/hh*2)/2*60;
    g.hidden=false; g.style.top=((m-h0*60)/60*hh)+'px'; g.style.height=(hh*1.5)+'px'; g.textContent='＋ '+fromMin(m);
  });
  sg.addEventListener('mouseleave',()=>$$('.ghost',sg).forEach(g=>g.hidden=true));
}
function evRow(ev,d){
  const rep=ev.repeat==='count'&&d&&occIndex(ev,d)?`${occIndex(ev,d)}. z ${+ev.count||1}`:'';
  return `<button class="ev-row hl-${evColor(ev)}" data-act="ev" data-id="${ev.id}"><span class="t">${esc(ev.start)}–${esc(ev.end)}</span><span class="dot"></span><span><b>${esc(ev.title||'Bez názvu')}</b><small>${[TYPE_SHORT[ev.type]?ev.type:'',rep,ev.place,ev.who].filter(Boolean).map(esc).join(' · ')}</small></span></button>`;
}
function openEventModal(ev,preset){
  const isNew=!ev;
  ev=ev?clone(ev):Object.assign({id:rid(),title:'',type:'Přednáška',day:0,start:'08:00',end:'09:50',repeat:'weekly',date:ymd(new Date()),count:4,place:'',who:'',note:'',color:'',sec:''},preset||{});
  if(!ev.date) ev.date=ymd(new Date()); if(!ev.count) ev.count=4;
  const heads=allH1(), secOf=v=>heads.find(h=>h.key===v);
  if(ev.sec&&!secOf(ev.sec)) ev.sec='';
  const m=openModal(isNew?'Nová událost':'Upravit událost',`<form class="m-body" id="evf" novalidate>
    <div class="fld"><label for="ev-title">Co</label><input id="ev-title" list="ev-dl" value="${esc(ev.title)}" placeholder="Předmět nebo akce" autocomplete="off"><datalist id="ev-dl">${[...new Set(heads.map(h=>h.short))].map(t=>`<option value="${esc(t)}"></option>`).join('')}</datalist></div>
    <div class="fld"><span class="lbl">Typ</span><div class="seg" id="ev-type">${TYPES.map(t=>`<button type="button" class="${t===ev.type?'on':''}" data-t="${t}">${t}</button>`).join('')}</div></div>
    <div class="grid2">
      <div class="fld"><label for="ev-repeat">Opakování</label><select id="ev-repeat">${[['weekly','Každý týden'],['odd','Lichý týden'],['even','Sudý týden'],['count','Pevný počet týdnů'],['once','Jednorázově']].map(([v,l])=>`<option value="${v}" ${ev.repeat===v?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="fld" id="f-day"><label for="ev-day">Den</label><select id="ev-day">${DAYS_FULL.map((d,i)=>`<option value="${i}" ${+ev.day===i?'selected':''}>${d}</option>`).join('')}</select></div>
      <div class="fld" id="f-date"><label for="ev-date" id="l-date">Datum</label><input type="date" id="ev-date" value="${esc(ev.date)}"></div>
      <div class="fld" id="f-count"><label for="ev-count">Kolikrát</label><div class="cnt"><input type="number" id="ev-count" min="1" max="52" step="1" value="${+ev.count||4}" inputmode="numeric"><span>×</span></div></div>
    </div>
    <p class="note" id="ev-cnt-note" hidden></p>
    <div class="grid2"><div class="fld"><label for="ev-start">Od</label><input type="time" id="ev-start" value="${esc(ev.start)}" step="300"></div><div class="fld"><label for="ev-end">Do</label><input type="time" id="ev-end" value="${esc(ev.end)}" step="300"></div></div>
    <div class="grid2"><div class="fld"><label for="ev-place">Kde</label><input id="ev-place" value="${esc(ev.place)}" placeholder="Místnost nebo budova"></div><div class="fld"><label for="ev-who">S kým</label><input id="ev-who" value="${esc(ev.who)}" placeholder="Vyučující, spolužáci"></div></div>
    <div class="fld"><label for="ev-sec">Předmět (nadpis H1)</label><select id="ev-sec"><option value="">Žádný</option>${flatPages().filter(({p})=>heads.some(h=>h.pageId===p.id)).map(({p})=>`<optgroup label="${esc((p.icon?p.icon+' ':'')+pTitle(p))}">${heads.filter(h=>h.pageId===p.id).map(h=>`<option value="${esc(h.key)}" ${ev.sec===h.key?'selected':''}>${esc(h.text)}</option>`).join('')}</optgroup>`).join('')}</select>${heads.length?'':'<p class="note">Na stránkách zatím nemáš žádný nadpis H1.</p>'}</div>
    <div class="fld"><span class="lbl">Barva</span><div class="swatches" id="ev-color" style="padding-left:0">${COLORS.map(c=>`<button type="button" class="sw hl-${c} ${evColor(ev)===c?'on':''}" data-c="${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div></div>
    <div class="fld"><label for="ev-note">Poznámky</label><textarea id="ev-note" rows="3" placeholder="Co si vzít, co se probírá…">${esc(ev.note)}</textarea></div>
    <p class="err" id="ev-err" hidden></p>
    <div class="m-actions">${isNew?'':'<button type="button" class="btn danger" id="ev-del">Smazat</button>'}<span class="sp"></span><button type="button" class="btn" id="ev-open" ${ev.sec?'':'hidden'}>Otevřít předmět</button><button type="button" class="btn" data-close>Zrušit</button><button type="submit" class="btn pri">${isNew?'Přidat':'Uložit'}</button></div>
  </form>`);
  let type=ev.type, color=evColor(ev);
  const cntNote=()=>{
    const n=$('#ev-cnt-note',m); if($('#ev-repeat',m).value!=='count'){ n.hidden=true; return; }
    const d=parseD($('#ev-date',m).value), c=clamp(parseInt($('#ev-count',m).value,10)||0,0,52);
    if(!d||!c){ n.hidden=true; return; }
    const last=new Date(d); last.setDate(d.getDate()+7*(c-1));
    n.textContent=c===1?`Jen jednou: ${DAYS_FULL[(d.getDay()+6)%7]} ${shortDate(d)}`:`Každý ${['pondělí','úterý','středu','čtvrtek','pátek','sobotu','neděli'][(d.getDay()+6)%7]} ${c}×: od ${shortDate(d)} do ${shortDate(last)} ${last.getFullYear()} (počítá se po týdnech, bez ohledu na svátky).`;
    n.hidden=false;
  };
  const syncRepeat=()=>{
    const r=$('#ev-repeat',m).value, byDate=r==='once'||r==='count';
    $('#f-day',m).hidden=byDate; $('#f-date',m).hidden=!byDate; $('#f-count',m).hidden=r!=='count';
    $('#l-date',m).textContent=r==='count'?'První hodina':'Datum';
    cntNote();
  };
  syncRepeat(); $('#ev-repeat',m).addEventListener('change',syncRepeat);
  $('#ev-date',m).addEventListener('input',cntNote); $('#ev-count',m).addEventListener('input',cntNote);
  $('#ev-type',m).addEventListener('click',e=>{ const b=e.target.closest('[data-t]'); if(!b) return; type=b.dataset.t; $$('#ev-type button',m).forEach(x=>x.classList.toggle('on',x===b)); });
  const setColor=c=>{ color=c; $$('#ev-color .sw',m).forEach(x=>x.classList.toggle('on',x.dataset.c===c)); };
  $('#ev-color',m).addEventListener('click',e=>{ const b=e.target.closest('[data-c]'); if(b) setColor(b.dataset.c); });
  const syncOpen=()=>{ $('#ev-open',m).hidden=!$('#ev-sec',m).value; };
  $('#ev-title',m).addEventListener('change',e=>{ const v=norm(e.target.value.trim()); const h=v&&heads.find(h=>norm(h.short)===v||norm(h.text)===v); if(h&&!$('#ev-sec',m).value){ $('#ev-sec',m).value=h.key; syncOpen(); } });
  $('#ev-sec',m).addEventListener('change',e=>{ const h=secOf(e.target.value); if(h&&!$('#ev-title',m).value.trim()) $('#ev-title',m).value=h.short; syncOpen(); });
  $('#ev-start',m).addEventListener('change',e=>{ const s=toMin(e.target.value), en=toMin($('#ev-end',m).value); if(e.target.value&&en<=s) $('#ev-end',m).value=fromMin(Math.min(s+110,23*60+59)); });
  const del=$('#ev-del',m); if(del) del.addEventListener('click',()=>{ const old=S.events[ev.id]; delete S.events[ev.id]; saveEvent({id:ev.id}); closeModal(); renderMain(); toast('Událost smazána','Vrátit',()=>{ S.events[old.id]=old; saveEvent(old); renderMain(); }); });
  $('#ev-open',m).addEventListener('click',()=>{ const h=secOf($('#ev-sec',m).value); if(!h) return; closeModal(); revealBlock(h.pageId,h.blockId,true); });
  $('#evf',m).addEventListener('submit',e=>{
    e.preventDefault();
    const out=Object.assign(ev,{title:$('#ev-title',m).value.trim(),type,repeat:$('#ev-repeat',m).value,day:+$('#ev-day',m).value,date:$('#ev-date',m).value,count:parseInt($('#ev-count',m).value,10)||0,start:$('#ev-start',m).value,end:$('#ev-end',m).value,place:$('#ev-place',m).value.trim(),who:$('#ev-who',m).value.trim(),sec:$('#ev-sec',m).value,note:$('#ev-note',m).value,color});
    delete out.pageId;
    const err=$('#ev-err',m); let msg='';
    if(!out.title) msg='Napiš, co to je (třeba název předmětu).';
    else if(!out.start||!out.end) msg='Vyplň čas od a do.';
    else if(toMin(out.end)<=toMin(out.start)) msg='Konec musí být po začátku.';
    else if((out.repeat==='once'||out.repeat==='count')&&!out.date) msg=out.repeat==='count'?'Vyber datum první hodiny.':'Vyber datum.';
    else if(out.repeat==='count'&&(out.count<1||out.count>52)) msg='Počet opakování musí být 1 až 52.';
    if(msg){ err.textContent=msg; err.hidden=false; return; }
    if(out.repeat==='once'||out.repeat==='count'){ const d=parseD(out.date); out.day=(d.getDay()+6)%7; }
    if(out.repeat!=='count') delete out.count;
    S.events[out.id]=out; saveEvent(out); closeModal(); renderMain();
    toast(isNew?'Událost přidána':'Změny uloženy');
  });
  setTimeout(()=>{ const ti=$('#ev-title',m); if(ti&&!ti.value) ti.focus(); },20);
}

/* ================= tasks ================= */
function allTasks(){
  const out=[];
  Object.values(S.pages).forEach(pg=>{ let h1='',h2='';
    (pg.blocks||[]).forEach(b=>{
    if(b.type==='h1'){ h1=plain(b.html).trim(); h2=''; return; }
    if(b.type==='h2'&&!h1){ h2=plain(b.html).trim(); return; }
    const sec=h1||h2;
    if(b.type==='todo') out.push({key:`${pg.id}|${b.id}`,pg,b,html:b.html,done:!!b.done,sec});
    else if(b.type==='table') (b.rows||[]).forEach((row,r)=>(row.cells||[]).forEach((cell,c)=>(cell.lines||[]).forEach((ln,l)=>{ if(ln.t==='todo') out.push({key:`${pg.id}|${b.id}|${r}|${c}|${l}`,pg,b,ln,html:ln.html,done:!!ln.done,inTable:true,sec}); })));
  }); });
  out.forEach(t=>t.due=parseDue(plain(t.html)));
  return out;
}
function taskByKey(k){ return allTasks().find(t=>t.key===k); }
function taskRow(t,showPage){
  return `<div class="task ${t.done?'done':''}"><button class="mk check ${t.done?'on':''}" data-act="task-check" data-k="${esc(t.key)}" role="checkbox" aria-checked="${t.done}" aria-label="Hotovo"></button>
    <div><div class="task-t">${sanitize(t.html)||'<span class="muted">Bez textu</span>'}</div>${showPage?`<button class="task-pg" data-act="goto-task" data-k="${esc(t.key)}">${esc(t.pg.icon||'')} ${esc(pTitle(t.pg))}${t.sec?' › '+esc(t.sec):''}${t.inTable?' · v tabulce':''}</button>`:''}</div>
    ${t.due?dueChip(t.due,t.done):'<span></span>'}</div>`;
}
function renderTasks(){
  const all=allTasks(); const list=S.taskFilter==='open'?all.filter(t=>!t.done):all;
  const dated=list.filter(t=>t.due).sort((a,b)=>a.due-b.due);
  const undated=list.filter(t=>!t.due);
  const groups={}; undated.forEach(t=>{ const g=t.pg.id+'|'+(t.sec||''); (groups[g]=groups[g]||[]).push(t); });
  const openN=all.filter(t=>!t.done).length;
  $('#view').innerHTML=`<div class="view" style="max-width:860px">
    <div class="v-head"><div><div class="eyebrow">Ze všech stránek</div><h1 class="v-title">Úkoly</h1></div>
      <div class="filters"><button class="${S.taskFilter==='open'?'on':''}" data-act="tfilter" data-v="open">Nesplněné · ${openN}</button><button class="${S.taskFilter==='all'?'on':''}" data-act="tfilter" data-v="all">Vše · ${all.length}</button></div></div>
    ${!list.length?`<div class="card"><div class="empty" style="padding:18px">${all.length?'Všechno hotovo. ':''}Úkol přidáš na libovolné stránce: napiš <b>[]</b> a mezeru, nebo <b>/úkol</b>. Když do textu dáš datum jako <span class="mono">5.10.</span>, objeví se tu s termínem.</div></div>`:''}
    ${dated.length?`<section class="t-sec"><h2>S termínem</h2><div class="card">${dated.map(t=>taskRow(t,true)).join('')}</div></section>`:''}
    ${Object.keys(groups).map(g=>{ const t0=groups[g][0], pg=t0.pg; return `<section class="t-sec"><h2><button class="task-pg" style="font:inherit;color:var(--fg);text-align:left" data-act="goto-task" data-k="${esc(t0.key)}">${t0.sec?esc(t0.sec):esc((pg.icon||'')+' '+pTitle(pg))}</button></h2>${t0.sec?`<p class="note" style="margin:-4px 0 8px">${esc(pTitle(pg))}</p>`:''}<div class="card">${groups[g].map(t=>taskRow(t,false)).join('')}</div></section>`; }).join('')}
  </div>`;
}
function toggleTask(k){
  const t=taskByKey(k); if(!t) return;
  if(t.ln) t.ln.done=!t.ln.done; else t.b.done=!t.b.done;
  savePage(t.pg,300); renderSidebar(); renderMain();
}

/* ================= today ================= */
function renderToday(){
  const now=new Date(), wi=weekInfo(now);
  const evs=eventsOnDate(now); const tm=new Date(now); tm.setDate(tm.getDate()+1); const evT=eventsOnDate(tm);
  const tasks=allTasks(); const t0=sod(now);
  const upcoming=tasks.filter(t=>!t.done&&t.due&&(t.due-t0)/864e5<=14).sort((a,b)=>a.due-b.due);
  const subj=[]; flatPages().forEach(({p})=>{ const secs=[]; tasks.filter(t=>t.pg.id===p.id).forEach(t=>{ let s=secs.find(x=>x.sec===t.sec); if(!s){ s={p,sec:t.sec,key:t.key,total:0,done:0}; secs.push(s);} s.total++; if(t.done) s.done++; }); subj.push(...secs); });
  const nm=now.getHours()*60+now.getMinutes();
  const wd=(now.getDay()+6)%7;
  if(!Object.keys(S.pages).length&&!Object.keys(S.events).length){
    $('#view').innerHTML=`<div class="view"><div class="welcome"><div class="eyebrow">Úkolníček</div><h1>Tvůj školní sešit na jednom místě</h1><p class="muted">Projekty pro semestry a poznámky s úkoly a tabulkami, týdenní rozvrh a přehled termínů. Začni prvním projektem nebo si vyplň rozvrh.</p><div class="m-actions" style="justify-content:center"><button class="btn pri" data-act="new-page">＋ Nový projekt</button><button class="btn" data-act="nav" data-v="schedule">Otevřít rozvrh</button></div></div></div>`;
    return;
  }
  $('#view').innerHTML=`<div class="view">
    <div class="v-head"><div><div class="eyebrow">${DAYS_FULL[wd]}${wi?` · ${wi.n}. týden výuky (${wi.parity})`:''}</div><h1 class="v-title">${now.getDate()}. ${MONTHS[now.getMonth()]}</h1></div></div>
    <div class="cards">
      <div style="display:grid;gap:18px">
        <section class="card"><div class="card-h"><h2>Dnes v rozvrhu</h2><button class="btn" data-act="nav" data-v="schedule">Rozvrh</button></div>
          <div class="card-body">${evs.length?evs.map(ev=>evRow(ev,now).replace('class="ev-row',`class="ev-row ${toMin(ev.start)<=nm&&nm<toMin(ev.end)?'now-ev':''}`)).join(''):`<div class="empty">Dnes nemáš v rozvrhu nic. <button class="linkbtn" data-act="day-add" data-day="${wd}" data-date="${ymd(now)}">Přidat událost</button></div>`}</div></section>
        <section class="card"><div class="card-h"><h2>Zítra</h2></div>
          <div class="card-body">${evT.length?evT.map(ev=>evRow(ev,tm)).join(''):'<div class="empty">Zítra volno.</div>'}</div></section>
      </div>
      <div style="display:grid;gap:18px">
        <section class="card"><div class="card-h"><h2>Blížící se termíny</h2><button class="btn" data-act="nav" data-v="tasks">Všechny úkoly</button></div>
          <div class="card-body">${upcoming.length?upcoming.map(t=>taskRow(t,true)).join(''):'<div class="empty">Na příštích 14 dní nic. Datum jako <span class="mono">5.10.</span> v textu úkolu se tu ukáže samo.</div>'}</div></section>
        ${subj.length?`<section class="card"><div class="card-h"><h2>Stav úkolů podle předmětů</h2></div><div class="card-body">${subj.map(({p,sec,key,total,done})=>`<button class="subj hl-${p.color||'gray'}" data-act="goto-task" data-k="${esc(key)}">${sec?'<span class="ti-ic"><span class="ti-dot"></span></span>':pIcon(p)}<span class="nm">${esc(sec||pTitle(p))}</span><span class="n">${done}/${total}</span><span class="bar"><i style="width:${Math.round(done/total*100)}%"></i></span></button>`).join('')}</div></section>`:''}
      </div>
    </div></div>`;
}

/* ================= search ================= */
function openSearch(){
  const m=openModal('',`<input class="q-in" id="q" placeholder="Hledat stránky a poznámky…" autocomplete="off" aria-label="Hledat"><div class="q-res" id="qres"></div>`);
  let idx=0, res=[];
  const draw=()=>{
    const q=norm($('#q',m).value.trim());
    res=Object.values(S.pages).map(p=>{
      const tt=norm(pTitle(p)); let snip='', score=0;
      if(!q) score=1; else if(tt.includes(q)) score=3;
      else { const txt=(p.blocks||[]).map(b=>b.type==='table'?(b.rows||[]).map(r=>r.cells.map(c=>c.lines.map(l=>plain(l.html)).join(' ')).join(' ')).join(' '):plain(b.html)).join(' · ')+' '+(p.props||[]).map(x=>x.k+' '+x.v).join(' ');
        const i=norm(txt).indexOf(q); if(i>=0){ score=2; snip=txt.slice(Math.max(0,i-30),i+60); } }
      return {p,score,snip};
    }).filter(r=>r.score).sort((a,b)=>b.score-a.score).slice(0,12);
    idx=clamp(idx,0,Math.max(0,res.length-1));
    $('#qres',m).innerHTML=res.length?res.map((r,i)=>`<button class="q-item ${i===idx?'act':''}" data-i="${i}">${pIcon(r.p)}<span>${esc(pTitle(r.p))}${r.snip?`<small>…${esc(r.snip)}…</small>`:''}</span></button>`).join(''):`<div class="empty" style="padding:14px">Nic nenalezeno.</div>`;
  };
  draw();
  $('#q',m).addEventListener('input',()=>{ idx=0; draw(); });
  $('#q',m).addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); idx++; draw(); } else if(e.key==='ArrowUp'){ e.preventDefault(); idx--; draw(); }
    else if(e.key==='Enter'&&res[idx]){ e.preventDefault(); closeModal(); go({kind:'page',pageId:res[idx].p.id}); }
  });
  $('#qres',m).addEventListener('click',e=>{ const b=e.target.closest('[data-i]'); if(b){ closeModal(); go({kind:'page',pageId:res[+b.dataset.i].p.id}); } });
  setTimeout(()=>$('#q',m).focus(),20);
}

/* ================= settings ================= */
const APP_VERSION='2.3.0';
function fmtTime(ts){ if(!ts) return ''; const d=new Date(ts); const t=`${d.getHours()}:${pad(d.getMinutes())}`; return sod(d).getTime()===sod(new Date()).getTime()?t:`${shortDate(d)} ${t}`; }
function downloadFile(name,text){
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'application/json'})); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500);
}
function applyData(d){
  const n=normalizeImport(d);
  S.pages=n.pages; S.events=n.events; S.settings=Object.assign(defaultSettings(),n.settings);
  HIST.clear(); hideImgSel(); closePop();
  if(S.view.kind==='page'&&!S.pages[S.view.pageId]) S.view={kind:'today'};
  renderSidebar(); renderMain();
}
/* ---- vzhled jen pro toto zařízení (do zálohy na Disk nejde) ---- */
const FS_STEPS=[1,1.15,1.3,1.45,1.6];
function applyTheme(){
  const t=lsGet('uk-theme','auto'), root=document.documentElement;
  if(t==='light'||t==='dark') root.setAttribute('data-theme',t); else root.removeAttribute('data-theme');
  const dark=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);
  $$('meta[name="theme-color"]').forEach(mt=>mt.setAttribute('content',dark?'#18161D':'#FCFBFE'));
}
function applyFontScale(){
  const f=+lsGet('uk-fs',1); const v=FS_STEPS.includes(f)?f:1;
  if(v===1) document.documentElement.style.removeProperty('--fs'); else document.documentElement.style.setProperty('--fs',v);
  requestAnimationFrame(()=>placeFrame());
}
try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme); }catch(_){}

/* ---- nastavení po kategoriích ---- */
const SET_TABS=[['general','Obecné','⚙️'],['look','Vzhled','🎨'],['sync','Synchronizace','☁️'],['help','Návod a novinky','📖']];
async function openSettings(focus){
  const st=S.settings, cid=DriveSync.clientId(), ds=DriveSync.state();
  let backups=[]; try{ backups=await Local.listBackups(); }catch(_){}
  const tab=focus==='drive'?'sync':(S.setTab||'general');
  const theme=lsGet('uk-theme','auto'), fs=+lsGet('uk-fs',1);
  const seg=(id,opts,cur)=>`<div class="seg" id="${id}">${opts.map(([v,l])=>`<button type="button" class="${String(v)===String(cur)?'on':''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const m=openModal('Nastavení',`<div class="set">
    <nav class="set-nav" role="tablist">${SET_TABS.map(([k,l,ic])=>`<button type="button" role="tab" data-tab="${k}" class="${k===tab?'on':''}"><span aria-hidden="true">${ic}</span>${l}</button>`).join('')}</nav>
    <form class="set-body" id="stf" novalidate>

    <section class="set-pane" data-pane="general">
      <div class="fld"><label for="st-name">Název</label><input id="st-name" value="${esc(st.name)}" placeholder="Úkolníček"></div>
      <div class="fld"><label for="st-start">Začátek výuky (pondělí 1. týdne)</label><input type="date" id="st-start" value="${esc(st.semesterStart)}"><p class="note">Podle něj se počítá číslo týdne a lichý/sudý týden.</p></div>
      <div class="grid2"><div class="fld"><label for="st-h0">Rozvrh od</label><select id="st-h0">${Array.from({length:14},(_,i)=>i+5).map(h=>`<option ${+st.dayStart===h?'selected':''}>${h}</option>`).join('')}</select></div><div class="fld"><label for="st-h1">Rozvrh do</label><select id="st-h1">${Array.from({length:12},(_,i)=>i+13).map(h=>`<option ${+st.dayEnd===h?'selected':''}>${h}</option>`).join('')}</select></div></div>
      <div class="fld"><label for="st-hs">Výška hodiny v rozvrhu</label><select id="st-hs">${HOUR_SCALES.map(v=>`<option value="${v}" ${(+st.hourScale||1)===v?'selected':''}>${String(v).replace('.',',')}×</option>`).join('')}</select><p class="note">Vyšší políčka = u krátkých hodin se vejde víc textu. Celé informace ukáže najetí myší na hodinu.</p></div>
      <label class="chk"><input type="checkbox" id="st-we" ${st.showWeekend?'checked':''}> Zobrazovat v rozvrhu i víkend</label>
    </section>

    <section class="set-pane" data-pane="look">
      <div class="fld"><span class="lbl">Motiv</span>${seg('st-theme',[['auto','Podle zařízení'],['light','☀︎ Světlý'],['dark','☾ Tmavý']],theme)}</div>
      <div class="fld"><span class="lbl">Velikost textu</span>${seg('st-fs',FS_STEPS.map(v=>[v,Math.round(v*100)+' %']),FS_STEPS.includes(fs)?fs:1)}
        <p class="note">Motiv a velikost textu platí jen pro toto zařízení a nenahrávají se na Disk.</p></div>
      <div class="set-sep"></div>
      <label class="chk"><input type="checkbox" id="st-mc" ${st.miniCal?'checked':''}> Mini kalendář v levém panelu pod číslem týdne</label>
      <label class="chk sub"><input type="checkbox" id="st-mcw" ${st.miniCalWeeks!==false?'checked':''} ${st.miniCal?'':'disabled'}> V kalendáři ukazovat čísla týdnů v roce</label>
      <label class="chk"><input type="checkbox" id="st-hid" ${st.showHidden!==false?'checked':''}> U sbaleného nadpisu ukazovat, kolik bloků je skrytých</label>
    </section>

    <section class="set-pane" data-pane="sync">
      <div class="fld" id="st-drive"><span class="lbl">Google Disk</span>
        <div class="drive-state ${ds==='ok'?'cl-ok':ds==='expired'?'cl-exp':'cl-off'}">${cloudSvg(ds==='off')}<span>${ds==='ok'?`Připojeno. ${META.lastUpload?'Naposledy nahráno '+fmtTime(META.lastUpload)+'.':'Zatím nic nenahráno.'}`:ds==='expired'?'Přihlášení vypršelo. Připoj se znovu.':'Nepřipojeno.'}</span></div>
        <label for="st-cid" class="note">OAuth Client ID (typ „Webová aplikace“) z Google Cloud. Ukládá se jen v tomto prohlížeči.</label>
        <input id="st-cid" value="${esc(cid)}" placeholder="123456789-abc….apps.googleusercontent.com" autocomplete="off" spellcheck="false">
        <label for="st-acc" class="note">Účet Google (nepovinné). Když ho vyplníš, Google při přihlášení nenabízí výběr účtu. Platí jen pro toto zařízení.</label>
        <input id="st-acc" type="email" value="${esc(DriveSync.account())}" placeholder="tvuj.ucet@gmail.com" autocomplete="email" spellcheck="false">
        <div class="m-actions">
          ${ds==='ok'?`<button type="button" class="btn" id="st-up">↑ Nahrát na Disk</button><button type="button" class="btn" id="st-down">↓ Stáhnout z Disku…</button><span class="sp"></span><button type="button" class="btn danger" id="st-disc">Odpojit</button>`
            :`<button type="button" class="btn pri" id="st-conn">${ds==='expired'?'Připojit znovu':'Přihlásit k Disku'}</button>`}
        </div>
        <p class="note">Synchronizace je ruční: ↑ uloží aktuální stav jako novou zálohu (drží se posledních 10), ↓ nahradí data v tomto zařízení vybranou verzí. Obrázky se nezálohují, na jiném zařízení se ukážou jako rámeček s názvem.</p>
        <label class="chk"><input type="checkbox" id="st-dll" ${lsGet('uk-dl-latest',false)?'checked':''}> Šipka ↓ stáhne rovnou nejnovější verzi (bez výběru z 10)</label>
        <p class="note" style="margin-top:-8px;padding-left:26px">Starší verzi pak vybereš po kliknutí na mráček → „Vybrat starší verzi…“. Platí jen pro toto zařízení.</p>
      </div>
      <div class="set-sep"></div>
      <div class="fld"><span class="lbl">Soubor se zálohou</span>
        <div class="m-actions"><button type="button" class="btn" id="st-exp">Exportovat do souboru</button><label class="btn" for="st-imp" style="cursor:pointer">Importovat ze souboru…</label><input type="file" id="st-imp" accept=".json,application/json" hidden></div>
        <p class="note">Import přidá stránky a události ze souboru (i ze zálohy z Claude verze). Stejné stránky přepíše.</p></div>
      <div class="fld"><span class="lbl">Místní zálohy</span>
        ${backups.length?`<div class="bk-list scroll">${backups.map(b=>`<div class="bk"><span><b>${esc(fmtTime(b.id))}</b> · ${esc(b.label||'Záloha')}</span><button type="button" class="btn" data-bk="${b.id}">Obnovit</button></div>`).join('')}</div>`:'<p class="note">Zatím žádné. Vytvoří se samy před každým stažením z Disku nebo obnovením.</p>'}
      </div>
    </section>

    <section class="set-pane" data-pane="help">
      <button type="button" class="guide-link" data-guide="navod"><span class="gl-ic" aria-hidden="true">📖</span><span><b>Návod</b><small>Základní funkce Úkolníčku v kostce</small></span><span class="gl-arr" aria-hidden="true">›</span></button>
      <button type="button" class="guide-link" data-guide="novinky"><span class="gl-ic" aria-hidden="true">✨</span><span><b>Novinky</b><small>Co přibylo v posledních verzích</small></span><span class="gl-arr" aria-hidden="true">›</span></button>
    </section>
    <p class="set-foot">Úkolníček ${APP_VERSION} · <a href="#" class="set-news" id="st-news">co je nového</a></p>
    </form></div>`,'set-m');

  /* přepínání kategorií */
  const showTab=k=>{ S.setTab=k; $$('.set-nav [data-tab]',m).forEach(b=>{ b.classList.toggle('on',b.dataset.tab===k); b.setAttribute('aria-selected',String(b.dataset.tab===k)); }); $$('.set-pane',m).forEach(p=>p.hidden=p.dataset.pane!==k); };
  showTab(tab);
  $('.set-nav',m).addEventListener('click',e=>{ const b=e.target.closest('[data-tab]'); if(b) showTab(b.dataset.tab); });
  $('#stf',m).addEventListener('submit',e=>e.preventDefault());

  /* obecné a vzhled se ukládají hned při změně */
  const commit=()=>{
    Object.assign(S.settings,{name:$('#st-name',m).value.trim()||'Úkolníček',semesterStart:$('#st-start',m).value,dayStart:+$('#st-h0',m).value,dayEnd:+$('#st-h1',m).value,showWeekend:$('#st-we',m).checked,miniCal:$('#st-mc',m).checked,miniCalWeeks:$('#st-mcw',m).checked,showHidden:$('#st-hid',m).checked,hourScale:+$('#st-hs',m).value});
    if(S.settings.semesterStart){ const d=parseD(S.settings.semesterStart); if(d.getDay()!==1){ S.settings.semesterStart=ymd(mondayOf(d)); $('#st-start',m).value=S.settings.semesterStart; } }
    $('#st-mcw',m).disabled=!S.settings.miniCal;
    saveSettings(); renderSidebar(); renderMain();
  };
  ['#st-name','#st-start','#st-h0','#st-h1','#st-hs','#st-we','#st-mc','#st-mcw','#st-hid'].forEach(sel=>$(sel,m).addEventListener('change',commit));
  $('#st-theme',m).addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(!b) return; lsSet('uk-theme',b.dataset.v); applyTheme(); $$('#st-theme button',m).forEach(x=>x.classList.toggle('on',x===b)); });
  $('#st-fs',m).addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(!b) return; lsSet('uk-fs',+b.dataset.v); applyFontScale(); $$('#st-fs button',m).forEach(x=>x.classList.toggle('on',x===b)); });
  $$('[data-guide]',m).forEach(b=>b.addEventListener('click',()=>openGuide(b.dataset.guide)));

  const saveCid=()=>{ const v=$('#st-cid',m).value.trim(); if(v!==DriveSync.clientId()){ DriveSync.setClientId(v); DriveSync.preload(); updateSyncUI(); } };
  $('#st-cid',m).addEventListener('change',saveCid);
  $('#st-acc',m).addEventListener('change',e=>{ DriveSync.setAccount(e.target.value); });
  $('#st-dll',m).addEventListener('change',e=>{ lsSet('uk-dl-latest',e.target.checked); updateSyncUI(); });
  $('#st-news',m).addEventListener('click',e=>{ e.preventDefault(); openGuide('novinky'); });
  const conn=$('#st-conn',m); if(conn) conn.addEventListener('click',async()=>{
    saveCid(); DriveSync.setAccount($('#st-acc',m).value);
    if(!DriveSync.clientId()){ toast('Nejdřív vlož Client ID.'); $('#st-cid',m).focus(); return; }
    if(await Sync.ensure()){ toast('Připojeno k Google Disku'); closeModal(); openSettings('drive'); }
  });
  const up=$('#st-up',m); if(up) up.addEventListener('click',()=>{ closeModal(); Sync.upload(); });
  const down=$('#st-down',m); if(down) down.addEventListener('click',()=>{ closeModal(); Sync.openDownload(); });
  const disc=$('#st-disc',m); if(disc) disc.addEventListener('click',()=>{ DriveSync.disconnect(); updateSyncUI(); closeModal(); toast('Odpojeno od Google Disku. Data v zařízení zůstala.'); });
  $('#st-exp',m).addEventListener('click',()=>{
    downloadFile(`ukolnicek-zaloha-${ymd(new Date())}.json`,JSON.stringify(Object.assign({app:'ukolnicek',version:2,exported:new Date().toISOString()},dataForSave()),null,1));
  });
  $('#st-imp',m).addEventListener('change',e=>{
    const f=e.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=async()=>{
      try{
        const d=JSON.parse(rd.result); if(!d||typeof d.pages!=='object') throw 0;
        await Local.addBackup(stateForStorage(),'Před importem ze souboru');
        const n=normalizeImport(d);
        Object.assign(S.pages,n.pages); Object.assign(S.events,n.events);
        if(d.settings) S.settings=Object.assign(defaultSettings(),n.settings);
        HIST.clear(); Store.queue();
        closeModal(); renderSidebar(); renderMain(); const np=Object.keys(n.pages).length, ne=Object.keys(n.events).length; toast(`Importováno: ${np} ${np===1?'stránka':np<5&&np>0?'stránky':'stránek'}, ${ne} ${ne===1?'událost':ne<5&&ne>0?'události':'událostí'}`);
      }catch(_){ toast('Soubor se nepodařilo načíst. Vyber zálohu exportovanou z Úkolníčku.'); }
    };
    rd.readAsText(f);
  });
  $$('[data-bk]',m).forEach(b=>b.addEventListener('click',async()=>{
    const bk=await Local.getBackup(+b.dataset.bk); if(!bk) return;
    await Local.addBackup(stateForStorage(),'Před obnovením místní zálohy');
    applyData(bk.state); Store.queue(); closeModal(); toast('Záloha z '+fmtTime(bk.id)+' obnovena');
  }));
  if(focus==='drive'&&!DriveSync.clientId()) setTimeout(()=>$('#st-cid',m).focus(),30);
}

/* ================= návod a novinky (obsah je v souboru navod.html) ================= */
let GUIDE=null;
async function loadGuide(){
  if(GUIDE) return GUIDE;
  const res=await fetch('navod.html',{cache:'no-cache'}).catch(()=>null) || await caches.match('navod.html').catch(()=>null);
  if(!res||!res.ok) throw new Error('navod');
  const doc=new DOMParser().parseFromString(await res.text(),'text/html');
  const secs=$$('#navod > section[data-tab]',doc).map(sc=>({k:sc.dataset.tab,title:sc.dataset.title||sc.dataset.tab,html:sc.innerHTML}));
  if(!secs.length) throw new Error('navod');
  GUIDE=secs; return secs;
}
async function openGuide(tab){
  const m=openModal('Návod a novinky','<div class="m-body guide"><div class="loading">Načítám…</div></div>','guide-m');
  let secs; try{ secs=await loadGuide(); }catch(_){ $('.guide',m).innerHTML='<p class="note">Návod se nepodařilo načíst. Zkus to znovu, až budeš online.</p>'; return; }
  if(S.modal!==m.parentElement) return;
  const k0=secs.some(s=>s.k===tab)?tab:secs[0].k;
  $('.guide',m).innerHTML=`<div class="g-tabs" role="tablist">${secs.map(s=>`<button type="button" role="tab" data-k="${esc(s.k)}">${esc(s.title)}</button>`).join('')}</div>${secs.map(s=>`<div class="g-pane" data-k="${esc(s.k)}">${s.html}</div>`).join('')}`;
  const show=k=>{ $$('.g-tabs button',m).forEach(b=>{ b.classList.toggle('on',b.dataset.k===k); b.setAttribute('aria-selected',String(b.dataset.k===k)); }); $$('.g-pane',m).forEach(p=>p.hidden=p.dataset.k!==k); $('.guide',m).scrollTop=0; };
  show(k0);
  $('.g-tabs',m).addEventListener('click',e=>{ const b=e.target.closest('[data-k]'); if(b) show(b.dataset.k); });
}

/* ================= Google Drive sync (UI; transport in driveSync.js) ================= */
function cloudSvg(off){ return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.6 4.5 4.5 0 0 0 7 18.5Z"/>${off?'<path d="M4 4l16 16"/>':''}</svg>`; }
function deviceName(){ const u=navigator.userAgent; return /iPhone/.test(u)?'iPhone':/iPad/.test(u)?'iPad':/Android/.test(u)?'Android':/Mac/.test(u)?'Mac':/Windows/.test(u)?'Windows':'Prohlížeč'; }
const Sync={
  busy:false,remoteNewer:false,
  init(){
    DriveSync.preload(); updateSyncUI();
    if(DriveSync.state()==='ok') this.peek();
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ updateSyncUI(); if(DriveSync.state()==='ok') this.peek(); } });
    window.addEventListener('online',updateSyncUI); window.addEventListener('offline',updateSyncUI);
    setInterval(updateSyncUI,60000);
  },
  setBusy(b){ this.busy=b; updateSyncUI(); },
  async ensure(){
    if(!navigator.onLine){ toast('Jsi offline. Synchronizace půjde, až budeš připojený.'); return false; }
    if(!DriveSync.clientId()){ openSettings('drive'); return false; }
    if(DriveSync.state()==='ok') return true;
    try{ await DriveSync.connect(); updateSyncUI(); return true; }
    catch(e){ updateSyncUI(); toast(DriveSync.errText(e)); return false; }
  },
  async peek(){
    try{ const files=await DriveSync.list(); const top=files[0]; this.remoteNewer=!!(top&&top.name!==META.remoteName&&(!META.remoteAt||top.createdTime>META.remoteAt)); }
    catch(_){}
    updateSyncUI();
  },
  async upload(force){
    if(this.busy) return;
    if(!await this.ensure()) return;
    this.setBusy(true);
    try{
      const files=await DriveSync.list(); const top=files[0];
      if(!force&&top&&top.name!==META.remoteName&&(!META.remoteAt||top.createdTime>META.remoteAt)){ this.setBusy(false); return confirmNewerRemote(top); }
      await Store.flush();
      const sentHash=dataHash();
      const f=await DriveSync.upload(Object.assign({app:'ukolnicek',version:2,savedAt:new Date().toISOString(),device:deviceName()},dataForSave()));
      META.remoteAt=f.createdTime||new Date().toISOString(); META.remoteName=f.name; META.syncedAt=META.changedAt; META.syncedHash=sentHash; META.lastUpload=Date.now(); this.remoteNewer=false;
      await Store.flush();
      await DriveSync.rotate(10).catch(()=>0);
      toast('Nahráno na Disk');
    }catch(e){ toast(DriveSync.errText(e)); }
    finally{ this.setBusy(false); }
  },
  /* ↓ v levém panelu: podle volby v nastavení rovnou nejnovější verze, jinak výběr z posledních 10 */
  download(){ return lsGet('uk-dl-latest',false)?this.downloadLatest():this.openDownload(); },
  async downloadLatest(){
    if(this.busy) return;
    if(!await this.ensure()) return;
    this.setBusy(true); let files;
    try{ files=await DriveSync.list(); }catch(e){ this.setBusy(false); return toast(DriveSync.errText(e)); }
    this.setBusy(false);
    if(!files.length) return toast('Na Disku zatím nic není. Nejdřív nahraj data tlačítkem ↑.');
    const top=files[0], dirty=isDirty(), when=fmtTime(Date.parse(top.createdTime));
    if(top.name===META.remoteName&&!dirty){ this.remoteNewer=false; updateSyncUI(); return toast('Už máš nejnovější verzi z Disku ('+when+').'); }
    if(!dirty) return this.fetchVersion(top);
    const m=openModal('Stáhnout nejnovější verzi?',`<div class="m-body">
      <p class="warn">V tomto zařízení máš změny, které nejsou na Disku (poslední úprava ${esc(fmtTime(META.changedAt))}). Stažení verze z <b>${esc(when)}</b> je nahradí. Současný stav se předtím uloží do Nastavení → Místní zálohy.</p>
      <div class="m-actions"><button type="button" class="btn" id="dq-up">Nejdřív nahrát moje změny</button><span class="sp"></span><button type="button" class="btn" data-close>Zrušit</button><button type="button" class="btn pri" id="dq-go">Stáhnout a nahradit</button></div></div>`);
    $('#dq-up',m).addEventListener('click',()=>{ closeModal(); this.upload(); });
    $('#dq-go',m).addEventListener('click',()=>{ closeModal(); this.fetchVersion(top); });
  },
  async fetchVersion(f){
    this.setBusy(true);
    try{
      const d=await DriveSync.download(f.id);
      if(!d||typeof d.pages!=='object') throw {code:'bad_file'};
      await Store.flush();
      await Local.addBackup(stateForStorage(),'Před stažením z Disku');
      applyData(d);
      META.remoteAt=f.createdTime; META.remoteName=f.name; META.changedAt=META.syncedAt=Date.now(); META.syncedHash=META.curHash=dataHash(); META.lastDownload=Date.now(); this.remoteNewer=false;
      await Store.flush();
      toast('Staženo z Disku · verze '+fmtTime(Date.parse(f.createdTime)));
    }catch(err){ toast(err&&err.code==='bad_file'?'Soubor na Disku není platná záloha Úkolníčku.':DriveSync.errText(err)); }
    finally{ this.setBusy(false); }
  },
  async openDownload(){
    if(this.busy) return;
    if(!await this.ensure()) return;
    this.setBusy(true); let files;
    try{ files=await DriveSync.list(); }catch(e){ this.setBusy(false); return toast(DriveSync.errText(e)); }
    this.setBusy(false);
    if(!files.length) return toast('Na Disku zatím nic není. Nejdřív nahraj data tlačítkem ↑.');
    const dirty=isDirty();
    const m=openModal('Stáhnout z Disku',`<form class="m-body" id="dlf">
      ${dirty?`<p class="warn">V tomto zařízení máš změny, které nejsou na Disku (poslední úprava ${esc(fmtTime(META.changedAt))}). Stažení je nahradí. Současný stav se předtím uloží do Nastavení → Místní zálohy.</p>`:'<p class="note">Data v tomto zařízení se nahradí vybranou verzí. Současný stav se předtím uloží do místních záloh.</p>'}
      <div class="bk-list scroll">${files.map((f,i)=>`<label class="bk ${i===0?'on':''}"><span><input type="radio" name="dlv" value="${esc(f.id)}" ${i===0?'checked':''}> <b>${esc(fmtTime(Date.parse(f.createdTime)))}</b>${i===0?' · nejnovější':''}${f.name===META.remoteName?' · tvoje poslední synchronizace':''}</span><span class="note">${f.size?Math.max(1,Math.round(f.size/1024))+' kB':''}</span></label>`).join('')}</div>
      <div class="m-actions">${dirty?'<button type="button" class="btn" id="dl-up">Nejdřív nahrát moje změny</button>':''}<span class="sp"></span><button type="button" class="btn" data-close>Zrušit</button><button type="submit" class="btn pri">Stáhnout a nahradit</button></div>
    </form>`);
    $$('input[name=dlv]',m).forEach(r=>r.addEventListener('change',()=>$$('.bk',m).forEach(b=>b.classList.toggle('on',b.contains(r)&&r.checked))));
    const du=$('#dl-up',m); if(du) du.addEventListener('click',()=>{ closeModal(); this.upload(); });
    $('#dlf',m).addEventListener('submit',async e=>{
      e.preventDefault();
      const id=($('input[name=dlv]:checked',m)||{}).value; const f=files.find(x=>x.id===id); if(!f) return;
      closeModal(); this.fetchVersion(f);
    });
  }
};
function confirmNewerRemote(top){
  const m=openModal('Na Disku je novější verze',`<div class="m-body">
    <p>Na Disku je záloha z <b>${esc(fmtTime(Date.parse(top.createdTime)))}</b>, kterou toto zařízení ještě nevidělo. Nejspíš je z jiného zařízení.</p>
    <p class="note">Když přesto nahraješ, tvoje verze bude nejnovější a ta druhá zůstane mezi zálohami na Disku.</p>
    <div class="m-actions"><button type="button" class="btn" id="nr-down">Stáhnout verzi z Disku</button><span class="sp"></span><button type="button" class="btn" data-close>Zrušit</button><button type="button" class="btn pri" id="nr-up">Přesto nahrát</button></div></div>`);
  $('#nr-down',m).addEventListener('click',()=>{ closeModal(); Sync.openDownload(); });
  $('#nr-up',m).addEventListener('click',()=>{ closeModal(); Sync.upload(true); });
}
function updateSyncUI(){
  const st=DriveSync.state(), off=!navigator.onLine;
  const dirty=isDirty();
  const cls=Sync.busy?'cl-busy':st==='ok'?'cl-ok':st==='expired'?'cl-exp':'cl-off';
  const label=Sync.busy?'Synchronizuji…':off&&st!=='off'?'Offline':st==='ok'?(META.lastUpload||META.lastDownload?'Disk · '+fmtTime(Math.max(META.lastUpload,META.lastDownload)):'Disk připojen'):st==='expired'?'Připojit znovu':'Disk nepřipojen';
  const title=(st==='ok'?'Google Disk připojen':st==='expired'?'Přihlášení vypršelo – klepni pro připojení':'Google Disk není připojený')+(dirty?' · máš změny, které nejsou na Disku':'')+(Sync.remoteNewer?' · na Disku je novější verze':'');
  const btn=`<button class="cloud ${cls} ${dirty?'dirty':''}" data-act="sync-menu" title="${esc(title)}" aria-label="${esc(title)}">${cloudSvg(st==='off')}</button>`;
  const box=$('#sync-box');
  if(box) box.innerHTML=`${btn}<button class="sync-lbl ${cls}" data-act="sync-menu" title="${esc(title)}">${esc(label)}${dirty?'<small>neuloženo na Disk</small>':''}</button>
    <button class="icon-btn sync-io" data-act="sync-up" title="Nahrát na Disk" aria-label="Nahrát na Disk" ${st==='off'||Sync.busy?'disabled':''}>↑</button>
    <button class="icon-btn sync-io ${Sync.remoteNewer?'dirty':''}" data-act="sync-down" title="${lsGet('uk-dl-latest',false)?'Stáhnout nejnovější verzi z Disku':'Stáhnout z Disku'}${Sync.remoteNewer?' (je tam novější verze)':''}" aria-label="Stáhnout z Disku" ${st==='off'||Sync.busy?'disabled':''}>↓</button>`;
  const tb=$('#tb-sync'); if(tb) tb.innerHTML=btn;
}
function openSyncMenu(anchor){
  const st=DriveSync.state();
  if(st==='expired'&&!Sync.busy){ Sync.ensure().then(ok=>{ if(ok){ toast('Připojeno k Google Disku'); Sync.peek(); } }); return; }
  if(st==='off'){ openSettings('drive'); return; }
  const dirty=isDirty();
  const h=`<div class="pop-h">Google Disk</div>
    <p class="note" style="padding:0 8px 6px">${META.lastUpload?'Naposledy nahráno '+esc(fmtTime(META.lastUpload))+'.':'Zatím nic nenahráno.'}${dirty?' Máš změny, které nejsou na Disku.':''}${Sync.remoteNewer?' Na Disku je novější verze.':''}</p>
    <button class="pop-item" data-v="up"><span class="pi-ic">↑</span>Nahrát na Disk</button>
    <button class="pop-item" data-v="down"><span class="pi-ic">↓</span>${lsGet('uk-dl-latest',false)?'Stáhnout nejnovější verzi':'Stáhnout z Disku…'}</button>
    ${lsGet('uk-dl-latest',false)?'<button class="pop-item" data-v="pick"><span class="pi-ic">☰</span>Vybrat starší verzi…</button>':''}
    <div class="pop-sep"></div><button class="pop-item" data-v="set"><span class="pi-ic">⚙</span>Nastavení Disku</button>`;
  openPop(anchor,h,v=>{ if(v==='up') Sync.upload(); else if(v==='down') Sync.download(); else if(v==='pick') Sync.openDownload(); else openSettings('drive'); });
}

/* ================= odkazy ================= */
function openLinkDialog(host,range,fromSel,existing){
  if(!host) return;
  const selText=existing?existing.textContent:(fromSel&&range&&!range.collapsed?range.toString():'');
  const m=openModal(existing?'Upravit odkaz':'Vložit odkaz',`<form class="m-body" id="lkf" novalidate>
    <div class="fld"><label for="lk-url">Adresa</label><input id="lk-url" value="${esc(existing?existing.getAttribute('href'):'')}" placeholder="https://… nebo google.com" autocomplete="off" spellcheck="false" inputmode="url"></div>
    <div class="fld"><label for="lk-name">Text odkazu</label><input id="lk-name" value="${esc(selText)}" placeholder="Jak se má odkaz jmenovat (nepovinné)" autocomplete="off"></div>
    <p class="err" id="lk-err" hidden></p>
    <div class="m-actions">${existing?'<button type="button" class="btn danger" id="lk-del">Odebrat odkaz</button>':''}<span class="sp"></span><button type="button" class="btn" data-close>Zrušit</button><button type="submit" class="btn pri">${existing?'Uložit':'Vložit'}</button></div>
  </form>`);
  setTimeout(()=>$(existing||!selText?'#lk-url':'#lk-url',m).focus(),20);
  const done=()=>{ host.dispatchEvent(new Event('input',{bubbles:true})); };
  const del=$('#lk-del',m); if(del) del.addEventListener('click',()=>{ closeModal(); unwrap(existing); done(); });
  $('#lkf',m).addEventListener('submit',e=>{
    e.preventDefault();
    const href=normUrl($('#lk-url',m).value), name=$('#lk-name',m).value.trim();
    if(!href){ const er=$('#lk-err',m); er.textContent='Vlož adresu, třeba https://www.google.com'; er.hidden=false; return; }
    closeModal();
    if(!document.contains(host)){ toast('Místo pro odkaz mezitím zmizelo, zkus to znovu.'); return; }
    if(existing){ existing.setAttribute('href',href); existing.textContent=name||urlLabel(href); done(); return; }
    const a=document.createElement('a'); a.href=href; a.className='lnk'; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent=name||urlLabel(href);
    let r=range; if(!r||!host.contains(r.startContainer)){ r=document.createRange(); r.selectNodeContents(host); r.collapse(false); }
    if(!r.collapsed) r.deleteContents();
    const sp=document.createTextNode(' ');
    r.insertNode(sp); r.insertNode(a);
    host.focus({preventScroll:true});
    const nr=document.createRange(); nr.setStartAfter(sp); nr.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(nr);
    done();
  });
}
function openLinkPop(a){
  const href=a.getAttribute('href')||'', host=a.closest('.txt');
  const h=`<div class="lk-pop"><span class="lk-url" title="${esc(href)}">${esc(urlLabel(href))}</span></div><div class="it-row"><button data-v="open">Otevřít ↗</button><button data-v="edit">Upravit</button>${LOCK?'':'<button class="danger" data-v="del">Odebrat</button>'}</div><p class="note" style="padding:2px 8px 4px">Tip: ⌘ + klik odkaz rovnou otevře.</p>`;
  openPop(a,h,v=>{
    if(v==='open') window.open(href,'_blank','noopener');
    else if(v==='edit') openLinkDialog(host,null,false,a);
    else if(v==='del'){ unwrap(a); host.dispatchEvent(new Event('input',{bubbles:true})); }
  });
}

/* ================= images ================= */
const IMG_OK=/^image\/(png|jpeg|gif|webp)$/;
function pickFile(){
  return new Promise(res=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept='image/png,image/jpeg,image/gif,image/webp,image/heic,.heic'; inp.hidden=true;
    document.body.appendChild(inp);
    inp.addEventListener('change',()=>{ res(inp.files[0]||null); inp.remove(); });
    inp.addEventListener('cancel',()=>{ res(null); inp.remove(); });
    inp.click();
  });
}
async function loadBitmap(file){
  try{ return await createImageBitmap(file); }
  catch(e){ return await new Promise((res,rej)=>{ const u=URL.createObjectURL(file); const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=u; }); }
}
async function prepImage(file,MAX){
  const ok=IMG_OK.test(file.type); let bmp;
  try{ bmp=await loadBitmap(file); }catch(e){ if(ok) return {blob:file,nw:0}; throw {code:'decode'}; }
  const nw=bmp.width,nh=bmp.height;
  if(ok&&(file.type==='image/gif'||(file.size<2.5e6&&Math.max(nw,nh)<=MAX))) return {blob:file,nw,nh};
  const sc=Math.min(1,MAX/Math.max(nw,nh)); const c=document.createElement('canvas'); c.width=Math.round(nw*sc); c.height=Math.round(nh*sc);
  c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  const type=file.type==='image/png'&&file.size<6e6?'image/png':'image/jpeg';
  const blob=await new Promise(r=>c.toBlob(r,type,.86));
  return {blob:blob||file,nw:c.width,nh:c.height};
}
function upErr(e){
  const c=e&&e.code;
  if(c==='decode') return 'Tenhle formát obrázku se nepodařilo načíst. Ulož ho jako JPG nebo PNG.';
  if(c==='too_large') return 'Obrázek je moc velký (max. 20 MB).';
  if(c==='unsupported_type') return 'Tenhle formát nejde nahrát. Použij JPG, PNG, GIF nebo WebP.';
  if(c==='quota_or_state') return 'Úložiště obrázků je plné.';
  if(c==='rate_limited') return 'Moc nahrávání najednou, zkus to za chvíli.';
  if(c==='upstream_auth') return 'Nahrání se nepovedlo. Obnov stránku a zkus to znovu.';
  return 'Obrázek se nepodařilo nahrát.';
}
async function uploadImage(file){
  try{
    const pr=await prepImage(file,2400);
    const name=String(file.name||'obrázek').slice(0,100);
    const id=await Local.putImage(pr.blob,name);
    IMGURL.set(id,URL.createObjectURL(pr.blob));
    return {id,name,nw:pr.nw};
  }catch(e){ toast(e&&e.code==='decode'?upErr(e):(e&&e.name==='QuotaExceededError'?'Úložiště v zařízení je plné.':'Obrázek se nepodařilo uložit do zařízení.')); return null; }
}
async function pickImageBlock(pgId,blockId,replace,file){
  file=file||await pickFile(); if(!file) return;
  const im=await uploadImage(file); if(!im) return;
  const pg=S.pages[pgId]; if(!pg) return;
  let bi=pg.blocks.findIndex(b=>b.id===blockId); if(bi<0) bi=pg.blocks.length-1;
  const cw=($('#blocks')||{clientWidth:700}).clientWidth||700;
  const nb=newBlock('image',{img:im.id,name:im.name,w:Math.round(Math.min(im.nw||560,cw,560)),align:'center',caption:''});
  if(replace&&pg.blocks[bi]&&isBlank(pg.blocks[bi].html)&&TEXT_TYPES.includes(pg.blocks[bi].type)) pg.blocks.splice(bi,1,nb); else pg.blocks.splice(bi+1,0,nb);
  const ni=pg.blocks.indexOf(nb); let nx=pg.blocks[ni+1];
  if(!nx||!TEXT_TYPES.includes(nx.type)){ nx=newBlock('p'); pg.blocks.splice(ni+1,0,nx); }
  savePage(pg,0);
  if(curPage()===pg){ rerenderBlocks(); focusBlock(nx.id,0); }
}
async function pickImageInline(host,range,file){
  file=file||await pickFile(); if(!file) return;
  const im=await uploadImage(file); if(!im) return;
  insertInline(host,range,im);
}
function insertInline(host,range,im){
  if(!host||!document.contains(host)){ toast('Obrázek se nepodařilo vložit, místo mezitím zmizelo. Zkus to znovu.'); return; }
  const inCell=!!host.closest('td');
  const img=document.createElement('img'); img.className='im '+(inCell?'al-center':'al-left'); img.setAttribute('data-img',im.id); img.setAttribute('data-name',im.name); img.src=imgSrc(im.id,im.name); img.alt=''; img.draggable=false;
  img.setAttribute('width',Math.round(Math.min(im.nw||240,inCell?220:240)));
  let r=range; if(!r||!host.contains(r.startContainer)){ r=document.createRange(); r.selectNodeContents(host); r.collapse(false); }
  r.insertNode(img);
  host.focus({preventScroll:true});
  const nr=document.createRange(); nr.setStartAfter(img); nr.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(nr);
  host.dispatchEvent(new Event('input',{bubbles:true}));
}
async function handleImageFiles(files,host,range){
  const x=ctxOf(host); if(!x) return;
  if(!x.line&&x.b.type==='p'&&isBlankEl(host)){
    for(const f of files){ await pickImageBlock(x.pg.id,x.b.id,true,f); }
    return;
  }
  for(const f of files){ const im=await uploadImage(f); if(im) insertInline(host,range,im); range=null; }
}
function rangeFromPoint(x,y){
  if(document.caretRangeFromPoint) return document.caretRangeFromPoint(x,y);
  if(document.caretPositionFromPoint){ const p=document.caretPositionFromPoint(x,y); if(!p) return null; const r=document.createRange(); r.setStart(p.offsetNode,p.offset); r.collapse(true); return r; }
  return null;
}

/* image selection, tools and resizing */
let imgSel=null;
const frame=document.createElement('div'); frame.id='imgframe'; frame.hidden=true; frame.innerHTML='<span class="rz" role="slider" aria-label="Změnit velikost obrázku"></span>'; document.body.appendChild(frame);
try{ document.execCommand('enableObjectResizing',false,false); }catch(_){}
function imgAlign(){ if(!imgSel) return 'center'; if(imgSel.kind==='block') return imgSel.x.b.align||'center'; const m=imgSel.img.className.match(/al-(\w+)/); return m?m[1]:'inline'; }
function imgContainerW(){ if(!imgSel) return 600; if(imgSel.kind==='block') return ($('#blocks')||{}).clientWidth||700; const td=imgSel.img.closest('td'); return Math.max(60,(td?td.clientWidth-16:imgSel.host.clientWidth)); }
function placeFrame(){
  if(!imgSel) return;
  if(!document.contains(imgSel.img)){ hideImgSel(); closePop(); return; }
  const r=imgSel.img.getBoundingClientRect();
  Object.assign(frame.style,{left:(r.left-2)+'px',top:(r.top-2)+'px',width:(r.width+4)+'px',height:(r.height+4)+'px'});
  frame.classList.toggle('rz-left',imgAlign()==='right'); frame.hidden=false;
}
function hideImgSel(){ imgSel=null; frame.hidden=true; }
function selectImage(img){
  const x=ctxOf(img); if(!x) return;
  hideFmt(); hideCellbar();
  const kind=img.classList.contains('bimg')?'block':'inline';
  imgSel={img,kind,x,host:kind==='inline'?img.closest('.txt'):null};
  placeFrame(); openImgTools();
}
function applyImgWidth(w,commit){
  if(!imgSel) return;
  w=Math.round(clamp(w,48,imgContainerW()));
  if(imgSel.kind==='block'){ imgSel.x.b.w=w; imgSel.img.closest('.blk').style.setProperty('--w',w+'px'); if(commit) savePage(imgSel.x.pg); }
  else { imgSel.img.setAttribute('width',w); if(commit) imgSel.host.dispatchEvent(new Event('input',{bubbles:true})); }
}
function applyImgAlign(al){
  if(!imgSel) return;
  if(imgSel.kind==='block'){ const blk=imgSel.img.closest('.blk'); blk.classList.remove('al-left','al-center','al-right'); blk.classList.add('al-'+al); imgSel.x.b.align=al; savePage(imgSel.x.pg); }
  else { imgSel.img.className='im al-'+al; imgSel.host.dispatchEvent(new Event('input',{bubbles:true})); }
}
function openImgTools(){
  const al=imgAlign(), kind=imgSel.kind, cw=imgContainerW(), cur=imgSel.img.getBoundingClientRect().width;
  const sizes=[['25','Malý',.25],['50','Střední',.5],['75','Velký',.75],['100','Celá šířka',1]];
  const h=`<div class="pop-h">Zarovnání</div><div class="it-row">
      <button class="${al==='left'?'on':''}" data-v="al:left">⇤ Vlevo</button><button class="${al==='center'?'on':''}" data-v="al:center">Na střed</button><button class="${al==='right'?'on':''}" data-v="al:right">Vpravo ⇥</button>${kind==='inline'?`<button class="${al==='inline'?'on':''}" data-v="al:inline">V řádku</button>`:''}</div>
    <p class="note" style="padding:0 8px 4px">${kind==='block'?'Vlevo a vpravo: text dalších bloků obteče obrázek.':'Vlevo a vpravo: text obteče obrázek.'}</p>
    <div class="pop-h">Velikost</div><div class="it-row">${sizes.map(([k,l,f])=>`<button class="${Math.abs(cur-cw*f)<8?'on':''}" data-v="sz:${f}">${l}</button>`).join('')}</div>
    <p class="note" style="padding:0 8px 4px">Nebo táhni za roh obrázku.</p>
    <div class="pop-sep"></div><div class="it-row">${kind==='block'?`<button data-v="cap">${imgSel.x.b.caption||imgSel.x.b.capOn?'Upravit popisek':'Přidat popisek'}</button>`:''}<button data-v="open">Zvětšit</button>${LOCK?'':'<button class="danger" data-v="del">Smazat</button>'}</div>`;
  openPop(imgSel.img,h,(v,btn,p)=>{
    if(!imgSel) return;
    if(v.startsWith('al:')){ applyImgAlign(v.slice(3)); $$('[data-v^="al:"]',p).forEach(b=>b.classList.toggle('on',b===btn)); requestAnimationFrame(()=>{ placeFrame(); placePop(p,imgSel.img.getBoundingClientRect()); }); return true; }
    if(v.startsWith('sz:')){ applyImgWidth(imgContainerW()*parseFloat(v.slice(3)),true); $$('[data-v^="sz:"]',p).forEach(b=>b.classList.toggle('on',b===btn)); requestAnimationFrame(()=>{ placeFrame(); placePop(p,imgSel.img.getBoundingClientRect()); }); return true; }
    if(v==='open'){ const src=imgSel.img.src; const cap=kind==='block'?imgSel.x.b.caption:''; hideImgSel(); const mm=openModal('',`<div class="m-head"><span></span><button class="icon-btn" data-close aria-label="Zavřít">×</button></div><div class="lb"><img id="lb-img" alt="">${cap?`<p>${esc(cap)}</p>`:''}</div>`,'lbm'); $('#lb-img',mm).src=src; return; }
    if(v==='cap'){ const {x}=imgSel; x.b.capOn=true; savePage(x.pg); hideImgSel(); rerenderBlocks(); const c=$(`#blocks .blk[data-id="${x.b.id}"] .cap`); focusEl(c,'end'); return; }
    if(v==='del'&&!LOCK){
      if(kind==='block'){ const {x}=imgSel; const bi=x.pg.blocks.indexOf(x.b); if(bi<0) return; x.pg.blocks.splice(bi,1); savePage(x.pg); hideImgSel(); rerenderBlocks(); toast('Obrázek smazán','Vrátit',()=>{ x.pg.blocks.splice(Math.min(bi,x.pg.blocks.length),0,x.b); savePage(x.pg); rerenderBlocks(); }); }
      else { const host=imgSel.host; imgSel.img.remove(); hideImgSel(); host.dispatchEvent(new Event('input',{bubbles:true})); }
    }
  });
}
frame.querySelector('.rz').addEventListener('pointerdown',e=>{
  if(!imgSel) return; e.preventDefault(); e.stopPropagation();
  const rz=e.currentTarget; try{ rz.setPointerCapture(e.pointerId); }catch(_){}
  const startW=imgSel.img.getBoundingClientRect().width, sx=e.clientX, al=imgAlign(); let w=startW;
  const move=ev=>{ let dx=ev.clientX-sx; if(al==='right') dx=-dx; if(al==='center') dx*=2; w=startW+dx; applyImgWidth(w,false); placeFrame(); if(S.pop) placePop(S.pop,imgSel.img.getBoundingClientRect()); };
  const up=()=>{ rz.removeEventListener('pointermove',move); rz.removeEventListener('pointerup',up); rz.removeEventListener('pointercancel',up); applyImgWidth(w,true); placeFrame(); };
  rz.addEventListener('pointermove',move); rz.addEventListener('pointerup',up); rz.addEventListener('pointercancel',up);
});
window.addEventListener('resize',()=>placeFrame());

/* ================= global actions ================= */
function openSide(){ $('#side').classList.add('open'); $('#scrim').classList.add('open'); }
function closeSide(){ $('#side').classList.remove('open'); $('#scrim').classList.remove('open'); }
document.addEventListener('click',e=>{
  if(e.target.closest('.pop,.modal,#fmt,#cellbar,#slash,#imgframe')) return;
  const lk=e.target.closest&&e.target.closest('a.lnk');
  if(lk){
    if(!lk.closest('[contenteditable="true"]')) return; /* mimo editor (Úkoly) se otevře normálně v nové kartě */
    e.preventDefault();
    if(e.metaKey||e.ctrlKey){ window.open(lk.href,'_blank','noopener'); return; }
    openLinkPop(lk); return;
  }
  const im=e.target.closest&&e.target.closest('#doc .txt img.im, #doc .bimg'); if(im){ selectImage(im); return; }
  const col=e.target.classList&&e.target.classList.contains('sg-col')?e.target:null;
  if(col){
    const sg=$('#sg'); const h0=+sg.dataset.h0; const y=e.clientY-col.getBoundingClientRect().top;
    const hh=+sg.dataset.hh||52;
    const s=clamp(Math.round((h0*60+Math.floor(y/hh*2)/2*60)),0,23*60);
    openEventModal(null,{day:+col.dataset.day,date:col.dataset.date,start:fromMin(s),end:fromMin(Math.min(s+110,23*60+59))});
    return;
  }
  const a=e.target.closest('[data-act]'); if(!a) return;
  const act=a.dataset.act, pg=curPage();
  /* zamčeno: nic, co mění strukturu stránky */
  if(LOCK&&['add-after','row-menu','col-menu','add-row','add-col','prop-add','prop-del','tpl'].includes(act)) return;
  switch(act){
    case 'lock': toggleLock(); break;
    case 'mc-prev': S.calOffset--; renderSidebar(); break;
    case 'mc-next': S.calOffset++; renderSidebar(); break;
    case 'mc-now': S.calOffset=0; renderSidebar(); break;
    case 'mc-day': { const d=parseD(a.dataset.date); S.weekOffset=weeksBetween(new Date(),d); if(!S.settings.showWeekend&&(d.getDay()===0||d.getDay()===6)) toast('Víkend se v rozvrhu nezobrazuje. Zapneš ho v Nastavení.'); go({kind:'schedule'}); break; }
    case 'ev-par': { const ev=S.events[a.dataset.id]; if(!ev) break; const d=parseD(a.dataset.date);
      openEventModal(null,{day:(d.getDay()+6)%7,date:ev.repeat==='count'?ev.date:a.dataset.date,start:ev.start,end:ev.end,repeat:ev.repeat,count:ev.count||4}); break; }
    case 'nav': go({kind:a.dataset.v}); break;
    case 'menu': $('#side').classList.contains('open')?closeSide():openSide(); break;
    case 'search': closeSide(); openSearch(); break;
    case 'settings': closeSide(); openSettings(); break;
    case 'open': go({kind:'page',pageId:a.dataset.id}); break;
    case 'tog': S.expanded[a.dataset.id]=S.expanded[a.dataset.id]===false; lsSet('uk-exp',S.expanded); renderSidebar(); break;
    case 'new-page': { const p=createPage(null); renderSidebar(); go({kind:'page',pageId:p.id}); setTimeout(()=>$('#page-title')&&$('#page-title').focus(),30); break; }
    case 'new-sub': { const p=createPage(a.dataset.id); renderSidebar(); go({kind:'page',pageId:p.id}); setTimeout(()=>$('#page-title')&&$('#page-title').focus(),30); break; }
    case 'page-menu': { const p=S.pages[a.dataset.id]; if(p) openPageMenu(a,p); break; }
    case 'icon': if(pg) openIconPop(a,pg); break;
    case 'tpl': if(pg) applyTemplate(pg,a.dataset.v); break;
    case 'sync-menu': openSyncMenu(a); break;
    case 'sync-up': Sync.upload(); break;
    case 'sync-down': Sync.download(); break;
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'wide': if(pg){ pg.wide=!pg.wide; savePage(pg,0); renderPage(pg); } break;
    case 'prop-add': if(pg){ pg.props=pg.props||[]; pg.props.push({k:'',v:''}); savePage(pg); rerenderProps(); focusEl($$('#props .pk').pop(),0); } break;
    case 'prop-del': if(pg){ pg.props.splice(+a.dataset.i,1); savePage(pg); rerenderProps(); } break;
    case 'check': { const x=ctxOf(a); if(!x) break; x.b.done=!x.b.done; a.classList.toggle('on',x.b.done); a.setAttribute('aria-checked',x.b.done); a.parentElement.querySelector('.txt').classList.toggle('done',x.b.done); savePage(x.pg,300); renderSidebar(); break; }
    case 'lcheck': { const x=ctxOf(a); if(!x||!x.line) break; x.line.done=!x.line.done; a.classList.toggle('on',x.line.done); a.closest('.ln').classList.toggle('done',x.line.done); savePage(x.pg,300); renderSidebar(); break; }
    case 'collapse': { const x=ctxOf(a); if(!x) break; x.b.collapsed=!x.b.collapsed; savePage(x.pg); rerenderBlocks(); break; }
    case 'add-after': { const x=ctxOf(a); if(!x) break; const nb=newBlock('p',{level:x.b.level||0}); x.pg.blocks.splice(x.bi+1,0,nb); savePage(x.pg); rerenderBlocks(); const el=$(`#blocks .blk[data-id="${nb.id}"] .txt`); focusEl(el,0); openSlash(el,nb.id,0,'plus'); break; }
    case 'blk-menu': { const x=ctxOf(a); if(x) openBlockMenu(a,x.pg,x.b); break; }
    case 'row-menu': case 'col-menu': { const x=ctxOf(a); if(x&&x.b.type==='table') openTableMenu(a,x.pg,x.b,act==='row-menu'?'row':'col',act==='row-menu'?x.r:x.c); break; }
    case 'add-row': { const x=ctxOf(a); if(!x) break; const cols=x.b.rows[0].cells.length; x.b.rows.push({cells:Array.from({length:cols},()=>emptyCell())}); savePage(x.pg); rerenderBlocks(); focusLine(x.b.id,x.b.rows.length-1,0,0,0); break; }
    case 'add-col': { const x=ctxOf(a); if(!x) break; x.b.rows.forEach(r=>r.cells.push(emptyCell())); savePage(x.pg); rerenderBlocks(); focusLine(x.b.id,0,x.b.rows[0].cells.length-1,0,0); break; }
    case 'tail': if(pg){ const last=pg.blocks[pg.blocks.length-1]; if(last&&last.type==='p'&&isBlank(last.html)) focusBlock(last.id,0); else { const nb=newBlock('p'); pg.blocks.push(nb); savePage(pg); rerenderBlocks(); focusBlock(nb.id,0); } } break;
    case 'wk-prev': S.weekOffset--; renderMain(); break;
    case 'wk-next': S.weekOffset++; renderMain(); break;
    case 'wk-today': S.weekOffset=0; renderMain(); break;
    case 'ev-add': { const d=weekDates()[0]; const today=new Date(); const inWeek=weekDates().find(x=>ymd(x)===ymd(today)); const dd=inWeek||d; openEventModal(null,{day:(dd.getDay()+6)%7,date:ymd(dd)}); break; }
    case 'day-add': openEventModal(null,{day:+a.dataset.day,date:a.dataset.date}); break;
    case 'ev': { const ev=S.events[a.dataset.id]; if(ev) openEventModal(ev); break; }
    case 'tfilter': S.taskFilter=a.dataset.v; renderMain(); break;
    case 'task-check': toggleTask(a.dataset.k); break;
    case 'goto-task': { const t=taskByKey(a.dataset.k); if(t) revealBlock(t.pg.id,t.b.id,false); break; }
  }
});
document.addEventListener('keydown',e=>{
  if(!(e.metaKey||e.ctrlKey)||e.altKey) return;
  if(e.shiftKey&&e.code==='KeyL'){ e.preventDefault(); e.stopPropagation(); if(!S.modal) toggleLock(); return; }
  const k=e.key.toLowerCase(); if(k!=='z'&&k!=='y') return;
  if(S.view.kind!=='page'||S.modal) return;
  if(e.target.closest&&e.target.closest('input,textarea,select,.pop')) return;
  e.preventDefault(); e.stopPropagation();
  if(k==='y'||e.shiftKey) redo(); else undo();
},true);
document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); openSearch(); return; }
  if(e.key==='Escape'){ if(slash.open) return; if(S.pop){ closePop(); return; } if(S.modal){ closeModal(); return; } closeSide(); }
});
setInterval(()=>{ if(S.ready&&!S.modal&&(S.view.kind==='schedule'||S.view.kind==='today')&&!document.activeElement.closest?.('#view input')) { const st=$('#main').scrollTop; renderMain(); $('#main').scrollTop=st; } },60000);

/* ================= boot ================= */
applyTheme(); applyFontScale();
applyLock();
renderSidebar();
Store.init();
let reloading=false;
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  /* Nová verze se nasadí sama: hned po spuštění / návratu do appky (prvních 20 s),
     nebo když appku schováš či přepneš jinam. Když zrovna píšeš nebo máš otevřený dialog,
     ukáže se jen lišta „Obnovit“, aby ti reload nesmazal rozepsané. */
  let fresh=Date.now(), pending=null;
  const typing=()=>{ const a=document.activeElement; return !!a&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
  const apply=w=>w.postMessage('skipWaiting');
  const offer=w=>{
    pending=w;
    if(Date.now()-fresh<20000&&!S.modal&&!typing()) return apply(w);
    const bar=$('#upd'); if(!bar) return; bar.hidden=false; $('#upd-btn').onclick=()=>apply(w);
  };
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      if(reg.waiting&&navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound',()=>{ const w=reg.installing; if(w) w.addEventListener('statechange',()=>{ if(w.state==='installed'&&navigator.serviceWorker.controller) offer(w); }); });
      document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ fresh=Date.now(); reg.update().catch(()=>{}); } });
      setInterval(()=>reg.update().catch(()=>{}),3600000);
    }).catch(e=>console.warn('SW',e));
  });
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden'&&pending) apply(pending); });
  navigator.serviceWorker.addEventListener('controllerchange',async()=>{ if(reloading) return; reloading=true; try{ await Store.flush(); }catch(_){} location.reload(); });
}

/* Upozornění při zavírání: jen když je Disk nastavený a jsou tu změny, které na něm nejsou.
   Prohlížeč ukáže vlastní dialog (vlastní tlačítka do něj dát nejde); když zvolíš „Zůstat“,
   nabídne Úkolníček rovnou nahrání. */
window.addEventListener('beforeunload',e=>{
  if(reloading) return;
  const dirty=isDirty();
  if(!dirty||DriveSync.state()==='off'||Sync.busy) return;
  try{ Store.flush(); }catch(_){}
  e.preventDefault(); e.returnValue='';
  setTimeout(()=>{
    if(S.modal) return;
    const m=openModal('Neuložené změny',`<div class="m-body">
      <p>V tomto zařízení máš změny, které nejsou na Disku${META.changedAt?' (poslední úprava '+esc(fmtTime(META.changedAt))+')':''}.</p>
      <div class="m-actions"><span class="sp"></span><button type="button" class="btn" data-close>Teď ne</button><button type="button" class="btn pri" id="lv-up">Nahrát na Disk</button></div></div>`);
    $('#lv-up',m).addEventListener('click',()=>{ closeModal(); Sync.upload(); });
  },300);
});
})();
