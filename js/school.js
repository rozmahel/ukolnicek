/* Úkolníček – Školní režim a předměty: společné pomůcky pro Index, rozvrh, bloky /předmět, úkoly a nastavení */
import { $, clone, esc, norm, plain, plural } from './core.js';
import { S } from './state.js';
import { saveEvent, savePage, stateForStorage, Store } from './store.js';
import { flatPages } from './pages.js';
import { renderSidebar } from './sidebar.js';
import { go, renderMain } from './router.js';
import { closePop, openPop, toast } from './ui.js';

/* ================= školní režim ================= */
/* vypnuto = klasické poznámky; zapnuto = rozvrh, Index, týden výuky a bloky /předmět.
   Ve výchozím stavu vypnuto (klíč v datech chybí), přepnutím se nic nemaže. */
const isSchool=()=>S.settings.school===true;
/* Index je ve školním režimu zapnutý, dokud ho uživatel v nastavení nevypne (settings.noIndex jen při vypnutí).
   Bez Indexu: rozvrh s vlastními názvy hodin, bez /předmět a výběru předmětu. Existující data zůstanou. */
const isIndex=()=>isSchool()&&S.settings.noIndex!==true;

/* ================= předměty ================= */
function subjLabel(su){ return su?([su.code,su.name].filter(Boolean).join(' — ')||'Předmět'):''; }
/* krátký název (zkratka) – rozvrh, štítky */
const subjShort=su=>su?(su.code||su.name||'Předmět'):'';
const semList=()=>Object.values(S.semesters).sort((a,b)=>(b.order||0)-(a.order||0));
const subjsOf=sid=>Object.values(S.subjects).filter(su=>sid?su.sem===sid:!S.semesters[su.sem]).sort((a,b)=>(a.order||0)-(b.order||0)||String(a.code||a.name).localeCompare(String(b.code||b.name),'cs'));
const subjList=()=>[...semList().flatMap(s=>subjsOf(s.id)),...subjsOf(null)];
/* místa v poznámkách, kde je předmět vložený přes /předmět (v pořadí z levého panelu) */
function subjOcc(id){ const out=[]; flatPages().forEach(({p})=>(p.blocks||[]).forEach(b=>{ if(b.type==='subj'&&b.subj===id) out.push({pg:p,b}); })); return out; }
const subjEvents=id=>Object.values(S.events).filter(ev=>ev.subj===id);
/* text bloku předmětu: živě z Indexu, u smazaného předmětu poslední uložený název */
const subjBlockText=b=>{ const su=S.subjects[b.subj]; return su?subjLabel(su):(plain(b.html).trim()||'Smazaný předmět'); };
/* převod bloku předmětu na obyčejný nadpis H1: text, emoji a formát nadpisu se přenesou do HTML */
function subjAsH1(b){
  let h=esc(subjBlockText(b));
  if(b.it) h=`<i>${h}</i>`; if(b.un) h=`<u>${h}</u>`; if(b.st) h=`<s>${h}</s>`; if(b.hl) h=`<mark class="hl-${b.hl}">${h}</mark>`;
  if(b.icon) h=esc(b.icon)+' '+h;
  b.html=h; b.type='h1'; ['subj','it','un','st','hl','icon'].forEach(k=>delete b[k]);
}

/* ---- propojení hodin z rozvrhu s předmětem ----
   hodina bez předmětu, jejíž název odpovídá zkratce nebo názvu (bez ohledu na velikost písmen, diakritiku a mezery);
   u zkratky typu „MPA-ZJR“ se počítá i část za pomlčkou („ZJR“) */
const key=v=>norm(v).replace(/\s+/g,' ').trim();
function titleKeys(su){
  const k=new Set(), add=v=>{ v=key(v); if(v) k.add(v); };
  add(su.code); add(su.name); add(subjLabel(su)); add([su.code,su.name].filter(Boolean).join(' '));
  const c=String(su.code||'').trim(), i=c.indexOf('-'); if(i>0&&c.length-i-1>=2) add(c.slice(i+1));
  return k;
}
function unlinkedMatches(su){
  if(!su) return [];
  const k=titleKeys(su);
  return Object.values(S.events).filter(ev=>(!ev.subj||!S.subjects[ev.subj])&&k.has(key(ev.title)));
}
const hodin=n=>`${n} ${plural(n,'hodina','hodiny','hodin')}`;
const hodinu=n=>`${n} ${plural(n,'hodinu','hodiny','hodin')}`;   /* „propojit 1 hodinu“ */
/* propojí hodiny s předmětem; barva se přepne na „podle předmětu“. Vrátí funkci pro vrácení. */
function linkEvents(su,evs){
  const before=evs.map(ev=>clone(ev));
  evs.forEach(ev=>{ ev.subj=su.id; ev.color=''; delete ev.sec; });
  saveEvent();
  return ()=>{ before.forEach(o=>{ if(S.events[o.id]) S.events[o.id]=o; }); saveEvent(); };
}
function linkNow(su,evs){
  const undo=linkEvents(su,evs); renderMain();
  toast(`Propojeno s ${subjShort(su)}: ${hodin(evs.length)}`,'Vrátit',()=>{ undo(); renderMain(); });
}
/* nabídka po založení nebo přejmenování předmětu (nic se nepropojí samo) */
function offerLink(su){
  const evs=unlinkedMatches(su); if(!evs.length) return false;
  const n=evs.length, titles=[...new Set(evs.map(e=>e.title.trim()))].map(t=>`„${t}“`).join(' nebo ');
  toast(`V rozvrhu ${n===1?'je':n<5?'jsou':'je'} ${hodin(n)} s názvem ${titles}. Propojit je s předmětem ${subjShort(su)}?`,'Propojit',()=>linkNow(su,evs));
  return true;
}

/* skok na kartu předmětu v Indexu */
function gotoSubject(id){ S.ixFocus=id; go({kind:'index'}); }

/* ---- výběr předmětu (lomítkové menu, blok předmětu, převod nadpisu) ---- */
function openSubjPicker(anchor,onPick,cur){
  const subs=subjList();
  if(!subs.length){
    const p=openPop(anchor,`<div class="sp-empty"><b>V Indexu zatím nic není</b><p>Předměty se zakládají v Indexu. Sem se pak jen vybírají.</p><button class="btn pri" data-v="*ix">Otevřít Index</button></div>`,v=>{ if(v==='*ix') go({kind:'index'}); });
    p.classList.add('subj-pick');
    return p;
  }
  const p=openPop(anchor,`<input class="inp sp-q" placeholder="Hledat předmět…" aria-label="Hledat předmět" autocomplete="off"><div class="sp-list" role="listbox"></div>`,v=>{ const su=S.subjects[v]; if(su) onPick(su); });
  p.classList.add('subj-pick');
  const q=$('.sp-q',p); let idx=0, items=[];
  const draw=()=>{
    const nq=norm(q.value.trim()); items=[]; let h='';
    [...semList(),null].forEach(sm=>{
      const l=subjsOf(sm?sm.id:null).filter(su=>!nq||norm(subjLabel(su)).includes(nq)); if(!l.length) return;
      h+=`<div class="pop-h">${esc(sm?sm.name||'Semestr':'Bez semestru')}</div>`+l.map(su=>{ const i=items.push(su)-1;
        return `<button class="pop-item sp-it hl-${esc(su.color||'purple')} ${i===idx?'act':''}" data-v="${su.id}" role="option"><span class="ti-dot"></span><span class="sp-t"><b>${esc(su.code||'')}</b>${su.code&&su.name?' ':''}${esc(su.name||'')}</span>${su.id===cur?'<span class="sp-cur">✓</span>':''}</button>`; }).join('');
    });
    $('.sp-list',p).innerHTML=h||'<div class="empty" style="padding:10px">Nic nenalezeno</div>';
    const act=$('.sp-it.act',p); if(act) act.scrollIntoView({block:'nearest'});
  };
  q.addEventListener('input',()=>{ idx=0; draw(); });
  q.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); if(items.length){ idx=(idx+(e.key==='ArrowDown'?1:-1)+items.length)%items.length; draw(); } }
    else if(e.key==='Enter'){ e.preventDefault(); const su=items[idx]; if(su){ closePop(); onPick(su); } }
  });
  draw(); setTimeout(()=>q.focus({preventScroll:true}),0);
  return p;
}

/* ---- smazání školních dat (Nastavení) ----
   smaže předměty, semestry a hodiny; bloky /předmět se změní na nadpis H1 s názvem předmětu */
function schoolCounts(){
  let blk=0; Object.values(S.pages).forEach(pg=>(pg.blocks||[]).forEach(b=>{ if(b.type==='subj') blk++; }));
  return {subj:Object.keys(S.subjects).length,sem:Object.keys(S.semesters).length,ev:Object.keys(S.events).length,blk};
}
async function clearSchoolData(){
  const back={subjects:clone(S.subjects),semesters:clone(S.semesters),events:clone(S.events),pages:[]};
  try{ await Local.addBackup(stateForStorage(),'Před smazáním školních dat'); }catch(_){}
  Object.values(S.pages).forEach(pg=>{
    if(!(pg.blocks||[]).some(b=>b.type==='subj')) return;
    back.pages.push(clone(pg));
    pg.blocks.forEach(b=>{ if(b.type==='subj') subjAsH1(b); });
    savePage(pg);
  });
  S.subjects={}; S.semesters={}; S.events={};
  Store.queue(); renderSidebar(); renderMain();
  return ()=>{
    back.pages.forEach(p=>{ if(S.pages[p.id]){ S.pages[p.id].blocks=p.blocks; savePage(S.pages[p.id]); } });
    S.subjects=back.subjects; S.semesters=back.semesters; S.events=back.events;
    Store.queue(); renderSidebar(); renderMain();
  };
}

export { clearSchoolData, gotoSubject, hodin, hodinu, isIndex, isSchool, linkNow, offerLink, openSubjPicker, schoolCounts, semList, subjAsH1, subjBlockText, subjEvents, subjLabel, subjList, subjOcc, subjShort, subjsOf, unlinkedMatches };
