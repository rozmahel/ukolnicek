/* Úkolníček – Úkoly: sběr ze všech stránek, přehled po projektech, skrývání projektů */
import { $, esc, ICONS, plain, plural } from '../core.js';
import { S } from '../state.js';
import { DATA_REV, savePage, saveSettings } from '../store.js';
import { dueChip, parseDue } from '../dates.js';
import { flatPages, pIcon, pTitle } from '../pages.js';
import { subjBlockText } from '../school.js';
import { sanitize } from '../sanitize.js';
import { renderSidebar } from '../sidebar.js';
import { renderMain } from '../router.js';
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
  Object.values(S.pages).sort((a,b)=>order.get(a.id)-order.get(b.id)).forEach(pg=>{ let h1='',h2='',secId='',subj=''; const root=rootOf(pg);
    (pg.blocks||[]).forEach(b=>{
    if(b.type==='h1'){ h1=plain(b.html).replace(/\s+/g,' ').trim(); h2=''; subj=''; secId=h1?b.id:''; return; }
    if(b.type==='subj'){ h1=subjBlockText(b); h2=''; subj=b.subj||''; secId=b.id; return; }
    if(b.type==='h2'&&!h1){ h2=plain(b.html).replace(/\s+/g,' ').trim(); secId=h2?b.id:''; return; }
    const sec=h1||h2;
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
  S.settings.taskHidden=[...h].filter(x=>S.pages[x]); if(!S.settings.taskHidden.length) delete S.settings.taskHidden;
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
/* Přehled Úkoly:
   1) úkoly s termínem ze všech projektů dohromady, nejbližší termín nahoře
   2) ostatní po projektech v pořadí z levého panelu, uvnitř podle stránek a nadpisů H1 */
function renderTasks(){
  const every=allTasks(), hid=taskHidden();
  const all=every.filter(t=>!hid.has(t.root.id));
  const list=S.taskFilter==='open'?all.filter(t=>!t.done):all;
  const dated=list.filter(t=>t.due).sort((a,b)=>(a.done-b.done)||(a.due-b.due)||(a.i-b.i));
  const projs=[], pm=new Map();
  list.filter(t=>!t.due).forEach(t=>{
    let P=pm.get(t.root.id); if(!P){ P={root:t.root,groups:[],gm:new Map(),n:0}; pm.set(t.root.id,P); projs.push(P); }
    const gk=t.pg.id+'|'+t.secId; let g=P.gm.get(gk); if(!g){ g={pg:t.pg,sec:t.sec,secId:t.secId,subj:t.subj,tasks:[]}; P.gm.set(gk,g); P.groups.push(g); }
    g.tasks.push(t); P.n++;
  });
  const hiddenRoots=[...new Set(every.filter(t=>hid.has(t.root.id)).map(t=>t.root))];
  const openN=all.filter(t=>!t.done).length;
  const grpHead=(g,root)=>{
    if(!g.sec&&g.pg===root) return '';
    const sub=g.pg!==root;
    const su=g.subj&&S.subjects[g.subj];   /* skupina pod blokem předmětu má jeho barvu */
    const main=g.sec?`<button class="t-grp-t ${su?'hl-'+esc(su.color||'purple'):''}" data-act="goto-sec" data-p="${g.pg.id}" data-b="${g.secId}">${su?'<span class="ti-dot"></span>':''}${esc(g.sec)}</button>`:`<button class="t-grp-t" data-act="open" data-id="${g.pg.id}">${esc(pTitle(g.pg))}</button>`;
    return `<div class="t-grp">${main}${sub&&g.sec?`<button class="t-grp-pg" data-act="open" data-id="${g.pg.id}">${esc(pTitle(g.pg))}</button>`:''}</div>`;
  };
  const projHtml=P=>{ const r=P.root;
    return `<section class="t-proj hl-${esc(r.color||'gray')}">
      <div class="t-proj-h"><button class="t-proj-t" data-act="open" data-id="${r.id}">${pIcon(r)}<span>${esc(pTitle(r))}</span></button><span class="t-proj-n">${P.n}</span>
        <button class="t-hide" data-act="t-hide" data-id="${r.id}" title="Skrýt projekt v Úkolech" aria-label="Skrýt projekt ${esc(pTitle(r))} v Úkolech">${ICONS.eyeOff}<span>Skrýt</span></button></div>
      <div class="card">${P.groups.map(g=>grpHead(g,r)+g.tasks.map(t=>taskRow(t,false)).join('')).join('')}</div></section>`;
  };
  let empty='';
  if(!list.length){
    if(!every.length||(!all.length&&!hiddenRoots.length)) empty=`Úkol přidáš na libovolné stránce: napiš <b>[]</b> a mezeru, nebo <b>/úkol</b>. Když do textu dáš datum jako <span class="mono">5.10.</span>, objeví se tu s termínem.`;
    else if(!all.length) empty=`Všechny projekty s úkoly jsou tady skryté. <button class="linkbtn" data-act="t-showall">Zobrazit všechny</button>`;
    else empty=`Všechno hotovo. 🎉`;
  }
  $('#view').innerHTML=`<div class="view" style="max-width:860px">
    <div class="v-head"><div><div class="eyebrow">Ze všech stránek</div><h1 class="v-title">Úkoly</h1></div>
      <div class="filters"><button class="${S.taskFilter==='open'?'on':''}" data-act="tfilter" data-v="open">Nesplněné · ${openN}</button><button class="${S.taskFilter==='all'?'on':''}" data-act="tfilter" data-v="all">Vše · ${all.length}</button>
        <button class="t-projbtn ${hiddenRoots.length?'has':''}" data-act="t-projs" aria-haspopup="true">${ICONS.eyeOff}Projekty${hiddenRoots.length?` · ${hiddenRoots.length} ${plural(hiddenRoots.length,'skrytý','skryté','skrytých')}`:''}</button></div></div>
    ${empty?`<div class="card"><div class="empty" style="padding:18px">${empty}</div></div>`:''}
    ${dated.length?`<section class="t-sec"><h2>S termínem</h2><div class="card">${dated.map(t=>taskRow(t,true)).join('')}</div></section>`:''}
    ${projs.map(projHtml).join('')}
    ${hiddenRoots.length&&list.length?`<p class="note t-hidnote">Skryté projekty: ${hiddenRoots.map(r=>esc(pTitle(r))).join(', ')} · <button class="linkbtn" data-act="t-showall">Zobrazit všechny</button></p>`:''}
  </div>`;
}
/* výběr projektů zobrazených v Úkolech */
function openTaskProjects(anchor){
  const hid=taskHidden(), every=allTasks();
  const roots=[...new Set(every.map(t=>t.root))];
  const cnt=id=>every.filter(t=>t.root.id===id&&!t.done).length;
  const item=r=>`<button class="pop-item t-pi ${hid.has(r.id)?'':'on'}" data-v="${r.id}" role="menuitemcheckbox" aria-checked="${!hid.has(r.id)}"><span class="t-ck" aria-hidden="true"></span>${pIcon(r)}<span class="nm">${esc(pTitle(r))}</span><span class="n">${cnt(r.id)}</span></button>`;
  const h=`<div class="pop-h">Zobrazit v Úkolech</div>${roots.length?roots.map(item).join(''):'<p class="note" style="padding:4px 8px 8px">Zatím žádný projekt nemá úkoly.</p>'}
    ${roots.length>1?'<div class="pop-sep"></div><button class="pop-item" data-v="*all"><span class="pi-ic">◉</span>Zobrazit všechny</button>':''}`;
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
  savePage(t.pg,300); renderSidebar(); renderMain();
}

export { allTasks, openTaskProjects, renderTasks, setTaskHidden, shownTasks, taskByKey, taskRow, toggleTask };
