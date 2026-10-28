/* Úkolníček – Úkoly: sběr ze všech stránek, přehled po projektech, skrývání projektů */
import { $, esc, IC, ICONS, lsGet, lsSet, plain } from '../core.js';
import { S } from '../state.js';
import { modeBtn } from '../theme.js';
import { applyLock } from '../lock.js';
import { DATA_REV, savePage, saveSettings } from '../store.js';
import { dueChip, parseDue } from '../dates.js';
import { flatPages, isArchived, pIcon, pTitle } from '../pages.js';
import { subjBlockText } from '../school.js';
import { sanitize } from '../sanitize.js';
import { renderSidebar } from '../sidebar.js';
import { go, renderMain } from '../router.js';
import { hiddenMask } from '../editor/render.js';
import { openPop } from '../ui.js';

/* ================= tasks ================= */
/* pořadí stránek jako v levém panelu (stránky bez platného rodiče na konec) */
function pageOrder(){
  const order=new Map(); flatPages().forEach(({p},i)=>order.set(p.id,i));
  Object.values(S.pages).forEach(p=>{ if(!order.has(p.id)) order.set(p.id,order.size); });
  return order;
}
/* projekt = stránka na nejvyšší úrovni, pod kterou stránka patří */
function rootOf(pg){ let p=pg; const seen=new Set([p.id]); while(p.parent&&S.pages[p.parent]&&!seen.has(p.parent)){ p=S.pages[p.parent]; seen.add(p.id); } return p; }
/* úkoly ve stejném pořadí jako v levém panelu a na stránkách */
/* výsledek se drží, dokud se data nezmění (DATA_REV), protože ho potřebuje levý panel, Úkoly i Dnes */
let taskCache=null, taskRev=-1;
function allTasks(){
  if(taskCache&&taskRev===DATA_REV) return taskCache;
  const out=[], order=pageOrder();
  /* úkol patří pod nejbližší nadpis H1 nebo blok předmětu nad sebou (bez nich pod H2) */
  /* archivované stránky a úkoly ve sbalených sekcích se nepočítají */
  Object.values(S.pages).filter(pg=>!isArchived(pg)).sort((a,b)=>order.get(a.id)-order.get(b.id)).forEach(pg=>{ let h1='',h2='',secId='',subj=''; const root=rootOf(pg);
    const hid=hiddenMask(pg.blocks||[]);
    (pg.blocks||[]).forEach((b,bi)=>{
    if(b.type==='h1'){ h1=plain(b.html).replace(/\s+/g,' ').trim(); h2=''; subj=''; secId=h1?b.id:''; return; }
    if(b.type==='subj'){ h1=subjBlockText(b); h2=''; subj=b.subj||''; secId=b.id; return; }
    if(b.type==='h2'&&!h1){ h2=plain(b.html).replace(/\s+/g,' ').trim(); secId=h2?b.id:''; return; }
    const sec=h1||h2;
    if(hid[bi]) return;
    if(b.type==='todo') out.push({key:`${pg.id}|${b.id}`,pg,root,b,html:b.html,done:!!b.done,sec,secId,subj});
    else if(b.type==='table') (b.rows||[]).forEach((row,r)=>(row.cells||[]).forEach((cell,c)=>(cell.lines||[]).forEach((ln,l)=>{ if(ln.t==='todo') out.push({key:`${pg.id}|${b.id}|${r}|${c}|${l}`,pg,root,b,ln,html:ln.html,done:!!ln.done,inTable:true,sec,secId,subj}); })));
  }); });
  out.forEach((t,i)=>{ t.due=parseDue(plain(t.html)); t.i=i; });
  taskCache=out; taskRev=DATA_REV;
  return out;
}
/* projekty skryté v přehledu Úkoly (ukládá se do nastavení, synchronizuje se s Diskem) */
const taskHidden=()=>new Set(Array.isArray(S.settings.taskHidden)?S.settings.taskHidden:[]);
function setTaskHidden(id,hide){
  const h=taskHidden(); if(hide) h.add(id); else h.delete(id);
  S.settings.taskHidden=[...h].filter(x=>x==='_due'||S.pages[x]); if(!S.settings.taskHidden.length) delete S.settings.taskHidden;
  saveSettings(); renderSidebar(); if(S.view.kind==='tasks') renderMain();
}
const shownTasks=()=>{ const h=taskHidden(), all=allTasks(); return h.size?all.filter(t=>!h.has(t.root.id)):all; };
function taskByKey(k){ return allTasks().find(t=>t.key===k); }
function taskPath(t){ return (t.pg!==t.root?pTitle(t.root)+' › ':'')+pTitle(t.pg)+(t.sec?' › '+t.sec:''); }
function taskRow(t,showPage){
  return `<div class="task ${t.done?'done':''}"><button class="mk check ${t.done?'on':''}" data-act="task-check" data-k="${esc(t.key)}" role="checkbox" aria-checked="${t.done}" aria-label="Hotovo"></button>
    <div><div class="task-t">${sanitize(t.html)||'<span class="muted">Bez textu</span>'}</div>${showPage?`<button class="task-pg" data-act="goto-task" data-k="${esc(t.key)}"><span class="tp-ic">${esc(t.root.icon||'')}</span><span class="tp-t">${esc(taskPath(t))}${t.inTable?' · v tabulce':''}</span></button>`:''}</div>
    ${t.due?dueChip(t.due,t.done):'<span></span>'}</div>`;
}
/* Přehled Úkoly (vzhled podle návrhu, barvy z motivu):
   0) souhrn: po termínu, příštích 7 dní, nesplněné
   1) úkoly s termínem ze všech projektů dohromady, nejbližší termín nahoře (sekci jde skrýt, úkoly pak zůstanou v projektech)
   2) ostatní po projektech v pořadí z levého panelu, uvnitř podle stránek a nadpisů H1 / bloků předmětu */
const DUE='_due';
/* sbalené sekce jsou jen v zařízení */
const tFold=()=>new Set(lsGet('uk-tfold',[]));
function toggleFold(id){ const f=tFold(); if(f.has(id)) f.delete(id); else f.add(id); lsSet('uk-tfold',[...f]); renderMain(); }
const dotOf=t=>{ const su=t.subj&&S.subjects[t.subj]; return su?(su.color||'purple'):(t.root.color||'gray'); };
function tkRow(t,showPage){
  return `<div class="tk-row ${t.done?'done':''}"><button class="mk check ${t.done?'on':''}" data-act="task-check" data-k="${esc(t.key)}" role="checkbox" aria-checked="${t.done}" aria-label="Hotovo"></button>
    <div class="tk-body"><div class="task-t">${sanitize(t.html)||'<span class="muted">Bez textu</span>'}</div>${showPage?`<button class="tk-path" data-act="goto-task" data-k="${esc(t.key)}"><span class="ti-dot hl-${esc(dotOf(t))}"></span><span class="tp-t">${esc(taskPath(t))}${t.inTable?' · v tabulce':''}</span></button>`:''}</div>
    ${t.due?dueChip(t.due,t.done):''}</div>`;
}
const tkActs=(id,label)=>`<span class="tk-acts"><button class="tk-ib" data-act="t-hide" data-id="${id}" title="Skrýt v Úkolech" aria-label="Skrýt ${esc(label)} v Úkolech">${ICONS.eyeOff}</button><button class="tk-ib tk-more" data-act="t-more" data-id="${id}" aria-haspopup="true" aria-label="Další volby">${IC.more}</button></span>`;
/* úkol odškrtnutý v Nesplněných zůstane přeškrtnutý vidět, dokud z Úkolů neodejdeš (omylem odškrtnutý jde hned vrátit) */
const kept=new Set(); let keptFor=null;
function renderTasks(){
  if(keptFor!==S.view){ kept.clear(); keptFor=S.view; }
  const every=allTasks(), hid=taskHidden(), fold=tFold();
  const all=every.filter(t=>!hid.has(t.root.id));
  const vis=t=>S.taskFilter!=='open'||!t.done||kept.has(t.key);
  const dn=t=>t.done&&!kept.has(t.key)?1:0;   /* hotové dolů, právě odškrtnuté zůstanou na místě */
  const noDue=hid.has(DUE);
  const datedAll=noDue?[]:all.filter(t=>t.due).sort((a,b)=>(dn(a)-dn(b))||(a.due-b.due)||(a.i-b.i));
  const dated=datedAll.filter(vis);
  const projs=[], pm=new Map();
  all.filter(t=>noDue||!t.due).forEach(t=>{
    let P=pm.get(t.root.id); if(!P){ P={root:t.root,groups:[],gm:new Map(),n:0,done:0,shown:0}; pm.set(t.root.id,P); projs.push(P); }
    const gk=t.pg.id+'|'+t.secId; let g=P.gm.get(gk); if(!g){ g={pg:t.pg,sec:t.sec,secId:t.secId,subj:t.subj,tasks:[],done:0}; P.gm.set(gk,g); P.groups.push(g); }
    g.tasks.push(t); P.n++; if(t.done){ P.done++; g.done++; } if(vis(t)) P.shown++;
  });
  const hiddenRoots=[...new Set(every.filter(t=>hid.has(t.root.id)).map(t=>t.root))];
  const hiddenNames=[...(noDue?['S termínem']:[]),...hiddenRoots.map(r=>pTitle(r))];
  const open=all.filter(t=>!t.done), openN=open.length;
  const t0=new Date(); t0.setHours(0,0,0,0);
  const dd=t=>Math.round((new Date(t.due).setHours(0,0,0,0)-t0)/864e5);
  const lateN=open.filter(t=>t.due&&dd(t)<0).length, weekN=open.filter(t=>t.due&&dd(t)>=0&&dd(t)<=7).length;
  const grpHtml=(g,root)=>{
    const rows=g.tasks.filter(vis); if(!rows.length) return '';
    const sub=g.pg!==root, su=g.subj&&S.subjects[g.subj];
    let head='';
    if(g.sec||sub){
      const go=g.sec?`data-act="goto-sec" data-p="${g.pg.id}" data-b="${g.secId}"`:`data-act="open" data-id="${g.pg.id}"`;
      const main=su?`<button class="tk-gt" ${go}>${su.code?`<span class="tk-code">${esc(su.code)}</span>`:''}${su.name?`<span class="tk-nm">${esc(su.name)}</span>`:''}${!su.code&&!su.name?'<span class="tk-code">Předmět</span>':''}</button>`
        :`<button class="tk-gt" ${go}><span class="tk-code">${esc(g.sec||pTitle(g.pg))}</span></button>`;
      head=`<div class="tk-gh">${main}${sub&&g.sec?`<button class="tk-gpg" data-act="open" data-id="${g.pg.id}">${esc(pTitle(g.pg))}</button>`:''}<span class="tk-cnt">${g.done} / ${g.tasks.length}</span></div>`;
    }
    return `<div class="tk-grp hl-${esc(su?(su.color||'purple'):(root.color||'gray'))}">${head}<div class="tk-list">${rows.map(t=>tkRow(t,false)).join('')}</div></div>`;
  };
  const projHtml=P=>{ const r=P.root, f=fold.has(r.id);
    return `<section class="tk-proj ${f?'folded':''}">
      <div class="tk-h"><button class="tk-pt" data-act="open" data-id="${r.id}">${r.icon?`<span class="tk-pic">${esc(r.icon)}</span>`:''}<span>${esc(pTitle(r))}</span></button>${tkActs(r.id,pTitle(r))}</div>
      ${f?'':P.groups.map(g=>grpHtml(g,r)).join('')}</section>`;
  };
  const shownProjs=projs.filter(P=>P.shown);
  let empty='';
  if(!dated.length&&!shownProjs.length){
    if(!every.length||(!all.length&&!hiddenRoots.length)) empty=`Zatím žádné úkoly.`;
    else if(!all.length) empty=`Všechny projekty jsou skryté. <button class="linkbtn" data-act="t-showall">Zobrazit všechny</button>`;
    else empty=`Všechno hotovo.`;
  }
  const tile=(l,v,extra,cls)=>`<div class="tk-tile"><div class="tk-tl">${l}</div><div class="tk-tv ${cls||''}">${v}${extra?`<small>${extra}</small>`:''}</div></div>`;
  const fD=fold.has(DUE);
  $('#view').innerHTML=`<div class="view tk-view">
    <div class="v-head"><div><h1 class="v-title">Úkoly</h1></div>
      <div class="filters"><button class="${S.taskFilter==='open'?'on':''}" data-act="tfilter" data-v="open">Nesplněné (${openN})</button><button class="${S.taskFilter==='all'?'on':''}" data-act="tfilter" data-v="all">Vše (${all.length})</button>
        <button class="t-projbtn ${hiddenNames.length?'has':''}" data-act="t-projs" aria-haspopup="true">${ICONS.eyeOff}Projekty${hiddenNames.length?` (${hiddenNames.length})`:''}</button><span class="dash-sep" aria-hidden="true"></span><button class="icon-btn lock-btn" data-act="lock"></button>${modeBtn()}</div></div>
    <div class="sheet tk-sheet">
    ${all.length?`<div class="tk-sum">${tile('Po termínu',lateN,'',lateN?'late':'')}${tile('Příštích 7 dní',weekN)}${tile('Nesplněné',openN,` z ${all.length}`)}</div>`:''}
    ${empty?`<div class="empty">${empty}</div>`:''}
    ${dated.length?`<section class="tk-sec ${fD?'folded':''}"><div class="tk-h"><h2>S termínem</h2>${tkActs(DUE,'S termínem')}</div>${fD?'':`<div class="tk-list">${dated.map(t=>tkRow(t,true)).join('')}</div>`}</section>`:''}
    ${shownProjs.map(projHtml).join('')}
    </div>
    ${hiddenNames.length&&(dated.length||shownProjs.length)?`<p class="tk-hidnote">Skryté: ${hiddenNames.map(esc).join(', ')} <button class="linkbtn" data-act="t-showall">Zobrazit</button></p>`:''}
  </div>`;
  applyLock();
}
/* ⋯ u sekce: otevřít stránku projektu, sbalit/rozbalit */
function openTaskMore(anchor){
  const id=anchor.dataset.id, f=tFold().has(id);
  const h=`${id!==DUE?'<button class="pop-item" data-v="open">Otevřít stránku</button>':''}<button class="pop-item" data-v="fold">${f?'Rozbalit':'Sbalit'}</button>`;
  openPop(anchor,h,v=>{ if(v==='fold') toggleFold(id); else if(v==='open') go({kind:'page',pageId:id}); });
}
/* výběr projektů zobrazených v Úkolech */
function openTaskProjects(anchor){
  const hid=taskHidden(), every=allTasks();
  const roots=[...new Set(every.map(t=>t.root))];
  const cnt=id=>every.filter(t=>t.root.id===id&&!t.done).length;
  const item=r=>`<button class="pop-item t-pi ${hid.has(r.id)?'':'on'}" data-v="${r.id}" role="menuitemcheckbox" aria-checked="${!hid.has(r.id)}"><span class="t-ck" aria-hidden="true"></span>${pIcon(r)}<span class="nm">${esc(pTitle(r))}</span><span class="n">${cnt(r.id)}</span></button>`;
  const dueN=every.filter(t=>t.due&&!t.done&&!hid.has(t.root.id)).length;
  const dueItem=`<button class="pop-item t-pi ${hid.has(DUE)?'':'on'}" data-v="${DUE}" role="menuitemcheckbox" aria-checked="${!hid.has(DUE)}"><span class="t-ck" aria-hidden="true"></span><span class="ti-ic">${IC.calendar}</span><span class="nm">S termínem</span><span class="n">${dueN}</span></button><div class="pop-sep"></div>`;
  /* od 4.20.0: „Vše“ vpravo v nadpisu místo řádku Zobrazit všechny */
  const h=`<div class="pop-h pop-hr"><span>Zobrazit v Úkolech</span>${roots.length>1?'<button class="pop-hl" data-v="*all">Vše</button>':''}</div>${roots.length?dueItem+roots.map(item).join(''):'<p class="note" style="padding:4px 8px 8px">Zatím žádný projekt nemá úkoly.</p>'}`;
  openPop(anchor,h,(v,b,p)=>{
    if(v==='*all'){ S.settings.taskHidden=[]; setTaskHidden('',false); return; }
    const hide=!taskHidden().has(v);
    setTaskHidden(v,hide); b.classList.toggle('on',!hide); b.setAttribute('aria-checked',String(!hide));
    return true;
  });
}
function toggleTask(k){
  const t=taskByKey(k); if(!t) return;
  if(t.ln) t.ln.done=!t.ln.done; else t.b.done=!t.b.done;
  if(S.view.kind==='tasks') kept.add(t.key);
  savePage(t.pg,300); renderSidebar(); renderMain();
}

export { allTasks, openTaskMore, openTaskProjects, renderTasks, setTaskHidden, shownTasks, taskByKey, taskRow, toggleTask };
