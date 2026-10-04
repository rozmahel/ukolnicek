/* Úkolníček – Index: karty předmětů (body se zapisují přímo na kartě), nastavení předmětu (ozubené kolečko), semestry, známky a kredity */
import { $, $$, clone, COLOR_CZ, COLORS, esc, ICONS, plain, plural, rid } from '../core.js';
import { S } from '../state.js';
import { applyLock, LOCK } from '../lock.js';
import { Store } from '../store.js';
import { parseD } from '../dates.js';
import { pIcon, pTitle, revealBlock } from '../pages.js';
import { offerLink, semList, subjLabel, subjOcc, subjShort, subjsOf } from '../school.js';
import { renderSidebar } from '../sidebar.js';
import { renderMain } from '../router.js';
import { closeModal, openModal, openPop, toast } from '../ui.js';
import { allTasks } from './tasks.js';

/* ================= Index: databáze předmětů, kredity, body a známky ================= */
/* stupnice VUT: [známka, od bodů, slovně, číselně] */
const GRADES=[['A',90,'výborně',1],['B',80,'velmi dobře',1.5],['C',70,'dobře',2],['D',60,'uspokojivě',2.5],['E',50,'dostatečně',3],['F',0,'nedostatečně',4]];
const GRADE_HL={A:'green',B:'green',C:'blue',D:'yellow',E:'orange',F:'red'};
const ENDS=[['zk','Zápočet a zkouška','Zk'],['kz','Klasifikovaný zápočet','KZ'],['z','Zápočet','Z']];
const endOf=k=>ENDS.find(e=>e[0]===k)||ENDS[0];
const num=v=>{ if(v===''||v==null) return null; const n=parseFloat(String(v).replace(',','.')); return isFinite(n)?n:null; };
/* body jako číslo s desetinnou čárkou nebo tečkou (12, 7,5, 7.5) */
const isNum=v=>{ const t=String(v??'').trim(); return t===''||/^-?\d+([.,]\d+)?$/.test(t); };
const fmtNum=n=>n==null?'':String(Math.round(n*100)/100).replace('.',',');
/* body: součet dílčích hodnocení, nebo jedno číslo, když žádná dílčí nejsou (body nad maximum se počítají jako bonus) */
function subjPoints(su){
  const parts=su.parts||[];
  if(parts.length){ const v=parts.map(p=>num(p.pts)).filter(x=>x!=null); return v.length?v.reduce((a,b)=>a+b,0):null; }
  return num(su.pts);
}
function subjMax(su){ const parts=su.parts||[]; if(!parts.length||parts.some(p=>num(p.max)==null)) return null; return parts.reduce((a,p)=>a+num(p.max),0); }
const gradeOf=pts=>pts==null?null:GRADES.find(g=>pts>=g[1]);
function subjGrade(su){ return su.end==='z'?null:gradeOf(subjPoints(su)); }
/* kredity se počítají, až je známka A–E (u zápočtu po zaškrtnutí „udělen“) */
function subjDone(su){ if(su.end==='z') return !!su.passed; const g=subjGrade(su); return !!g&&g[0]!=='F'; }
const subjCr=su=>num(su.credits)||0;
function wavg(list){ let c=0,s=0; list.forEach(su=>{ const g=subjGrade(su), cr=subjCr(su); if(g&&g[0]!=='F'&&cr){ c+=cr; s+=cr*g[3]; } }); return c?s/c:null; }
/* výchozí název semestru podle začátku výuky (nebo dneška) */
function semName(d){
  d=d||parseD(S.settings.semesterStart)||new Date(); const m=d.getMonth()+1, y=d.getFullYear(), yy=n=>String(n).slice(2);
  if(m>=8) return `ZS ${y}/${yy(y+1)}`; if(m===1) return `ZS ${y-1}/${yy(y)}`; return `LS ${y-1}/${yy(y)}`;
}
function gradeChip(su){
  if(su.end==='z') return su.passed?'<span class="grade hl-green" title="Zápočet udělen">✓</span>':'<span class="grade none">–</span>';
  const g=subjGrade(su); return g?`<span class="grade hl-${GRADE_HL[g[0]]}" title="${g[2]} (${fmtNum(g[3])})">${g[0]}</span>`:'<span class="grade none">–</span>';
}
/* nesplněné úkoly pod bloky předmětu v poznámkách */
const openTasksOf=id=>allTasks().filter(t=>!t.done&&t.subj===id);

/* ---- karta předmětu ---- */
function resHtml(su){
  const pts=subjPoints(su), mx=subjMax(su);
  return `<span class="ixc-sum">${pts==null?'– b':`<b>${fmtNum(pts)}</b>${mx?` / ${fmtNum(mx)}`:''} b`}</span>${gradeChip(su)}`;
}
function metaHtml(su){
  const g=subjGrade(su), cr=subjCr(su);
  return [cr?`${fmtNum(cr)} kr.`:'bez kreditů',esc(endOf(su.end)[1]),g?`<span class="ixc-num" title="Slovně a číselně">${g[2]} · ${fmtNum(g[3])}</span>`:''].filter(Boolean).join('<span class="ixc-sep">·</span>');
}
function ptField(id,name,val,max){
  const n=num(val), mx=num(max), bonus=n!=null&&mx!=null&&n>mx;
  return `<label class="ixc-part ${bonus?'bonus':''}"><span class="pn">${esc(name)}</span><span class="pv"><input class="ixc-in ${isNum(val)?'':'bad'}" data-part="${esc(id)}" type="text" inputmode="decimal" value="${esc(val??'')}" placeholder="–" autocomplete="off" aria-label="Body – ${esc(name)}">${mx!=null?`<span class="pm">/ ${fmtNum(mx)}</span>`:''}</span></label>`;
}
function partsHtml(su){
  const parts=su.parts||[];
  let h=parts.length?parts.map(p=>ptField(p.id,p.name||'Bez názvu',p.pts,p.max)).join(''):ptField('','Body celkem',su.pts,'');
  if(su.end==='z') h+=`<label class="chk ixc-pass"><input type="checkbox" class="ixc-passed" ${su.passed?'checked':''}> Zápočet udělen</label>`;
  return h;
}
function linksHtml(su){
  const occ=subjOcc(su.id), open=openTasksOf(su.id), out=[];
  if(occ.length) out.push(`<button class="ixc-link" data-act="ix-notes" data-id="${su.id}" data-popanchor>Poznámky${occ.length>1?` · ${occ.length}`:''}</button>`);
  if(open.length) out.push(`<button class="ixc-link" data-act="ix-tasks" data-id="${su.id}" data-popanchor>${open.length} ${plural(open.length,'nesplněný úkol','nesplněné úkoly','nesplněných úkolů')}</button>`);
  return out.join('<span class="ixc-sep">·</span>');
}
function cardHtml(su){
  const links=linksHtml(su);
  return `<article class="ix-card hl-${esc(su.color||'purple')} ${subjDone(su)?'done':''}" data-id="${su.id}">
    <div class="ixc-h"><span class="ti-dot"></span><h3 class="ixc-nm">${su.code?`<b>${esc(su.code)}</b>`:''}<span>${esc(su.name||'')}</span></h3>
      <div class="ixc-res">${resHtml(su)}</div>
      <button class="icon-btn ixc-gear" data-act="subj" data-id="${su.id}" title="Nastavení předmětu" aria-label="Nastavení předmětu ${esc(subjLabel(su))}">${ICONS.settings}</button></div>
    <div class="ixc-meta">${metaHtml(su)}</div>
    <div class="ixc-pts">${partsHtml(su)}</div>
    ${links?`<div class="ixc-links">${links}</div>`:''}
  </article>`;
}

/* ---- přehled ----
   zobrazení semestrů (ozubené kolo nahoře): sem.noStats = nepočítat do souhrnu, sem.hidden = neukazovat v seznamu.
   Klíče jsou v datech jen u vypnutých semestrů, předměty bez semestru se počítají a ukazují vždy. */
const inStats=su=>{ const sm=S.semesters[su.sem]; return !sm||!sm.noStats; };
const statSubs=()=>Object.values(S.subjects).filter(inStats);
function sumInner(subs){
  const earned=subs.filter(subjDone).reduce((a,su)=>a+subjCr(su),0), enrolled=subs.reduce((a,su)=>a+subjCr(su),0), avg=wavg(subs);
  return `<div class="ix-tile"><span class="k">Získané kredity</span><b>${fmtNum(earned)}</b><small>ze ${fmtNum(enrolled)} zapsaných</small></div>
      <div class="ix-tile"><span class="k">Splněné předměty</span><b>${subs.filter(subjDone).length}<span> / ${subs.length}</span></b><small>známka A–E nebo udělený zápočet</small></div>
      <div class="ix-tile"><span class="k">Vážený průměr</span><b>${avg!=null?fmtNum(avg):'–'}</b><small>ze splněných, váhou jsou kredity</small></div>`;
}
function semHeadInner(sem,list){
  const got=list.filter(subjDone).reduce((a,su)=>a+subjCr(su),0), target=sem?(num(sem.target)||0):0, av=wavg(list);
  return `<h2>${esc(sem?sem.name||'Semestr':'Bez semestru')}</h2>
        ${target?`<div class="ix-prog" title="Získané kredity v semestru"><span><b>${fmtNum(got)}</b> / ${fmtNum(target)} kr.</span><span class="bar"><i style="width:${Math.min(100,Math.round(got/target*100))}%"></i></span></div>`:`<span class="ix-prog"><span><b>${fmtNum(got)}</b> kr.</span></span>`}
        ${av!=null?`<span class="ix-avg" title="Vážený průměr splněných předmětů (A = 1 … E = 3)">⌀ ${fmtNum(av)}</span>`:''}
        ${sem?`<button class="icon-btn" data-act="sem-edit" data-id="${sem.id}" title="Upravit semestr" aria-label="Upravit semestr">⋯</button>`:''}`;
}
function semHtml(sem){
  const list=subjsOf(sem?sem.id:null); if(!sem&&!list.length) return '';
  return `<section class="ix-sem" data-sem="${sem?sem.id:''}">
      <div class="ix-sem-h">${semHeadInner(sem,list)}</div>
      <div class="ix-cards">${list.length?list.map(cardHtml).join(''):`<div class="card"><div class="empty" style="padding:14px 16px">V semestru zatím nic není. <button class="linkbtn" data-act="subj-new" data-sem="${sem.id}">Přidat předmět</button></div></div>`}</div></section>`;
}
function renderIndex(){
  const subs=Object.values(S.subjects), sems=semList();
  /* skok na předmět ze skrytého semestru: semestr se tentokrát ukáže */
  const fsu=S.ixFocus&&S.subjects[S.ixFocus], peek=fsu&&S.semesters[fsu.sem]&&S.semesters[fsu.sem].hidden?fsu.sem:null;
  const shown=sems.filter(sm=>!sm.hidden||sm.id===peek), nHid=sems.filter(sm=>sm.hidden&&sm.id!==peek).length, stats=statSubs();
  $('#view').innerHTML=`<div class="view ix-view" style="max-width:920px">
    <div class="v-head"><div><div class="eyebrow">Předměty, kredity a známky</div><h1 class="v-title">Index</h1></div>
      <div class="v-tools">${sems.length?'<button class="icon-btn ix-cfg" data-act="ix-view" title="Které semestry ukazovat" aria-label="Zobrazení semestrů">'+ICONS.settings+'</button><button class="btn" data-act="sem-new">＋ Semestr</button><button class="btn pri" data-act="subj-new">＋ Předmět</button>':'<button class="btn pri" data-act="sem-new">＋ Semestr</button>'}</div></div>
    ${subs.length?`<div class="ix-sum">${sumInner(stats)}</div>${stats.length<subs.length?`<p class="note ix-sumnote">Souhrn bez ${sems.filter(sm=>sm.noStats).map(sm=>esc(sm.name||'Semestr')).join(', ')}.</p>`:''}`
    :sems.length?`<div class="card"><div class="empty" style="padding:18px">Index je databáze tvých předmětů: kredity, body a známky. Předměty se zakládají jen tady. V rozvrhu je pak vybereš u hodiny a do poznámek je vložíš přes <b>/předmět</b>. <div class="m-actions" style="margin-top:10px"><button class="btn pri" data-act="subj-new">＋ První předmět</button></div></div></div>`
    :`<div class="card"><div class="empty" style="padding:18px">Index je databáze tvých předmětů: kredity, body a známky. <b>Začni semestrem</b>, předměty se pak zakládají do něj. V rozvrhu je vybereš u hodiny a do poznámek je vložíš přes <b>/předmět</b>. <div class="m-actions" style="margin-top:10px"><button class="btn pri" data-act="sem-new">＋ První semestr</button></div></div></div>`}
    ${shown.map(semHtml).join('')}${semHtml(null)}
    ${nHid?`<p class="note ix-hidnote">${nHid===1?'1 semestr je skrytý':`${nHid} ${plural(nHid,'semestr','semestry','semestrů')} ${nHid<5?'jsou skryté':'je skrytých'}`} · <button class="linkbtn" data-act="ix-view">Zobrazení semestrů</button></p>`:''}
  </div>`;
  applyLock();
  if(S.ixFocus){ const el=$(`.ix-card[data-id="${S.ixFocus}"]`); S.ixFocus=null; if(el){ el.scrollIntoView({block:'center'}); el.classList.add('flash'); } }
}
/* po zápisu bodů se překreslí jen výsledek karty a souhrny (pole s kurzorem zůstane, jak je) */
function refreshCard(card,su){
  $('.ixc-res',card).innerHTML=resHtml(su); $('.ixc-meta',card).innerHTML=metaHtml(su); card.classList.toggle('done',subjDone(su));
  const sum=$('.ix-sum'); if(sum) sum.innerHTML=sumInner(statSubs());
  $$('.ix-sem').forEach(sec=>{ const sem=S.semesters[sec.dataset.sem]||null, h=$('.ix-sem-h',sec); if(h) h.innerHTML=semHeadInner(sem,subjsOf(sem?sem.id:null)); });
  applyLock();
}
function cardCtx(el){ const card=el.closest&&el.closest('.ix-card'), su=card&&S.subjects[card.dataset.id]; return su?{card,su}:null; }
function onPtsInput(e){
  const inp=e.target; if(!inp.classList||!inp.classList.contains('ixc-in')) return;
  const x=cardCtx(inp); if(!x) return;
  const raw=inp.value.trim(), ok=isNum(raw);
  inp.classList.toggle('bad',!ok); if(!ok) return;   /* neplatné se neuloží; po opuštění pole se vrátí poslední platná hodnota */
  const pid=inp.dataset.part;
  if(pid){ const p=(x.su.parts||[]).find(q=>q.id===pid); if(!p) return; p.pts=raw; const n=num(raw), mx=num(p.max); inp.closest('.ixc-part').classList.toggle('bonus',n!=null&&mx!=null&&n>mx); }
  else x.su.pts=raw;
  Store.queue(); refreshCard(x.card,x.su);
}
function onPtsChange(e){
  const t=e.target, x=cardCtx(t); if(!x) return;
  if(t.classList.contains('ixc-in')&&t.classList.contains('bad')){
    const pid=t.dataset.part, p=pid?(x.su.parts||[]).find(q=>q.id===pid):null;
    t.value=pid?(p?p.pts||'':''):(x.su.pts||''); t.classList.remove('bad');
    toast('Body piš jako číslo, třeba 12 nebo 7,5.');
  }
  if(t.classList.contains('ixc-passed')){ x.su.passed=t.checked; Store.queue(); refreshCard(x.card,x.su); }
}
/* odkazy na kartě: poznámky a úkoly */
function ixAction(act,a){
  const su=S.subjects[a.dataset.id]; if(!su) return;
  if(act==='ix-notes'){
    const occ=subjOcc(su.id); if(!occ.length) return;
    if(occ.length===1) return revealBlock(occ[0].pg.id,occ[0].b.id,true);
    openPop(a,`<div class="pop-h">${esc(subjShort(su))} v poznámkách</div>`+occ.map((o,i)=>{ const r=pathOf(o.pg); return `<button class="pop-item" data-v="${i}">${pIcon(r[0])}<span>${esc(r.map(pTitle).join(' › '))}</span></button>`; }).join(''),v=>{ const o=occ[+v]; if(o) revealBlock(o.pg.id,o.b.id,true); });
    return;
  }
  if(act==='ix-tasks'){
    const ts=openTasksOf(su.id);
    openPop(a,`<div class="pop-h">Nesplněné úkoly · ${esc(subjShort(su))}</div>`+ts.map(t=>{ const tx=plain(t.html).trim()||'Bez textu'; return `<button class="pop-item" data-v="${esc(t.key)}"><span class="pi-ic">☐</span><span>${esc(tx.length>70?tx.slice(0,70)+'…':tx)}</span></button>`; }).join(''),v=>{ const t=allTasks().find(q=>q.key===v); if(t) revealBlock(t.pg.id,t.b.id,false); });
  }
}
const pathOf=pg=>{ const out=[pg]; let p=S.pages[pg.parent]; while(p&&out.length<8){ out.unshift(p); p=S.pages[p.parent]; } return out; };

/* ---- zobrazení semestrů: co se počítá do souhrnu a co je vidět v seznamu ---- */
function openIndexView(){
  const sems=semList();
  const m=openModal('Zobrazení semestrů',`<div class="m-body">
    <p class="note">Hotový semestr můžeš schovat ze seznamu nebo nepočítat do souhrnu nahoře. Nic se nesmaže a kdykoli ho zase zapneš.</p>
    <div class="ixv"><div class="ixv-h"><span>Semestr</span><span>Souhrn</span><span>Seznam</span></div>
      ${sems.map(sm=>{ const n=subjsOf(sm.id).length; return `<div class="ixv-r" data-id="${sm.id}"><span class="ixv-n"><b>${esc(sm.name||'Semestr')}</b><small>${n} ${plural(n,'předmět','předměty','předmětů')}</small></span>
        <label class="ixv-c" title="Počítat do souhrnu"><input type="checkbox" data-k="noStats" ${sm.noStats?'':'checked'} aria-label="${esc(sm.name)}: počítat do souhrnu"></label>
        <label class="ixv-c" title="Ukazovat v seznamu"><input type="checkbox" data-k="hidden" ${sm.hidden?'':'checked'} aria-label="${esc(sm.name)}: ukazovat v seznamu"></label></div>`; }).join('')}
    </div>
    <div class="m-actions"><span class="sp"></span><button type="button" class="btn pri" data-close>Hotovo</button></div></div>`,'ixv-m');
  m.addEventListener('change',e=>{
    const cb=e.target.closest('input[data-k]'), row=cb&&cb.closest('.ixv-r'), sm=row&&S.semesters[row.dataset.id]; if(!sm) return;
    if(cb.checked) delete sm[cb.dataset.k]; else sm[cb.dataset.k]=true;
    Store.queue(); renderMain();
  });
}

/* ---- nastavení předmětu (ozubené kolečko): jen zkratka, název, kredity, semestr, ukončení, barva a definice dílčích hodnocení ---- */
function openSubjectModal(su,preset){
  const isNew=!su, old=su||null;
  su=su?clone(su):Object.assign({id:rid(),code:'',name:'',credits:'',sem:'',end:'zk',color:'purple',pts:'',parts:[],note:''},preset||{});
  su.parts=su.parts||[];
  /* předmět vždy patří do semestru; bez semestru se nejdřív založí semestr */
  const sems=semList();
  if(!sems.length){ openSemModal(null,s=>openSubjectModal(null,{sem:s.id})); return; }
  const noSem=!S.semesters[su.sem]; if(noSem) su.sem=sems[0].id;
  const m=openModal(isNew?'Nový předmět':'Nastavení předmětu',`<form class="m-body" id="suf" novalidate>
    <div class="grid2 su-top"><div class="fld"><label for="su-code">Zkratka</label><input id="su-code" value="${esc(su.code)}" placeholder="MPA-ZJR" autocomplete="off"></div>
      <div class="fld"><label for="su-cr">Kredity</label><input id="su-cr" type="number" min="0" max="60" step="1" inputmode="numeric" value="${esc(su.credits)}" placeholder="5"></div></div>
    <div class="fld"><label for="su-name">Název</label><input id="su-name" value="${esc(su.name)}" placeholder="Celý název předmětu" autocomplete="off"></div>
    <div class="grid2 su-semrow"><div class="fld"><label for="su-sem">Semestr</label><select id="su-sem">${sems.map(s=>`<option value="${s.id}" ${su.sem===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>${!isNew&&noSem?'<p class="note">Předmět zatím nemá semestr, vyber ho.</p>':''}</div>
      <div class="fld"><label for="su-end">Ukončení</label><select id="su-end">${ENDS.map(([k,l])=>`<option value="${k}" ${su.end===k?'selected':''}>${l}</option>`).join('')}</select></div></div>
    <div class="fld"><span class="lbl">Barva</span><div class="swatches" id="su-color" style="padding-left:0">${COLORS.map(c=>`<button type="button" class="sw hl-${c} ${su.color===c?'on':''}" data-c="${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div></div>
    <div class="ix-eval">
      <div class="ix-eval-h"><span class="lbl">Dílčí hodnocení</span><span class="note" id="su-sum"></span></div>
      <div id="su-parts"></div>
      <div class="ix-eval-f"><button type="button" class="linkbtn" id="su-addpart">＋ Dílčí hodnocení</button></div>
      <p class="note" id="su-pnote"></p>
    </div>
    <div class="fld"><label for="su-note">Poznámka</label><textarea id="su-note" rows="2" placeholder="Podmínky zápočtu, termíny zkoušek…">${esc(su.note)}</textarea></div>
    <p class="err" id="su-err" hidden></p>
    <div class="m-actions">${isNew?'':'<button type="button" class="btn danger lk-hide" id="su-del">Smazat</button>'}<span class="sp"></span><button type="button" class="btn" data-close>Zrušit</button><button type="submit" class="btn pri">${isNew?'Přidat':'Uložit'}</button></div>
  </form>`,'su-m');
  let parts=clone(su.parts), color=su.color;
  const drawParts=()=>{
    $('#su-parts',m).innerHTML=parts.map((p,i)=>`<div class="ix-part su-pdef" data-i="${i}"><input class="inp pn" value="${esc(p.name||'')}" placeholder="Cvičení, test, zkouška…" aria-label="Název"><span class="ps">max</span><input class="inp pm" value="${esc(p.max??'')}" inputmode="decimal" placeholder="–" aria-label="Maximum bodů"><span class="pz">${String(p.pts??'').trim()?`${esc(p.pts)} b`:''}</span><button type="button" class="icon-btn lk-hide" data-rm="${i}" aria-label="Odebrat">×</button></div>`).join('');
    const mx=subjMax({parts});
    $('#su-sum',m).textContent=parts.length&&mx!=null?`celkem max ${fmtNum(mx)} b`:'';
    $('#su-pnote',m).textContent=parts.length?'Body do nich zapisuješ přímo na kartě předmětu. Body nad maximum se počítají jako bonus.':'Bez dílčích hodnocení se na kartě zapisují jen body celkem.';
    applyLock();
  };
  $('#su-parts',m).addEventListener('input',e=>{ const r=e.target.closest('.ix-part'); if(!r) return; const p=parts[+r.dataset.i]; p[e.target.classList.contains('pn')?'name':'max']=e.target.value; const mx=subjMax({parts}); $('#su-sum',m).textContent=parts.length&&mx!=null?`celkem max ${fmtNum(mx)} b`:''; });
  $('#su-parts',m).addEventListener('click',e=>{ const b=e.target.closest('[data-rm]'); if(!b||LOCK) return; parts.splice(+b.dataset.rm,1); drawParts(); });
  $('#su-addpart',m).addEventListener('click',()=>{
    /* body celkem zadané dřív se nezahodí: přesunou se do prvního dílčího hodnocení „Body“ */
    if(!parts.length&&String(su.pts??'').trim()) parts.push({id:rid(),name:'Body',pts:su.pts,max:''});
    parts.push({id:rid(),name:'',pts:'',max:''}); drawParts();
    const last=$$('#su-parts .pn',m).pop(); if(last) last.focus();
  });
  $('#su-color',m).addEventListener('click',e=>{ const b=e.target.closest('[data-c]'); if(!b) return; color=b.dataset.c; $$('#su-color .sw',m).forEach(x=>x.classList.toggle('on',x===b)); });
  const del=$('#su-del',m); if(del) del.addEventListener('click',()=>{ if(LOCK) return; const o=S.subjects[su.id]; if(!o) return closeModal(); delete S.subjects[su.id]; Store.queue(); closeModal(); renderSidebar(); renderMain();
    toast(`Předmět ${o.code||o.name||''} smazán`,'Vrátit',()=>{ S.subjects[o.id]=o; Store.queue(); renderSidebar(); renderMain(); }); });
  $('#suf',m).addEventListener('submit',e=>{
    e.preventDefault();
    const err=$('#su-err',m), code=$('#su-code',m).value.trim(), name=$('#su-name',m).value.trim(), cr=$('#su-cr',m).value.trim();
    let msg=''; if(!code&&!name) msg='Vyplň zkratku nebo název předmětu.'; else if(cr&&(num(cr)==null||num(cr)<0)) msg='Kredity musí být kladné číslo.';
    else if(parts.some(p=>!isNum(p.max))) msg='Maximum bodů piš jako číslo (třeba 30 nebo 12,5).';
    if(msg){ err.textContent=msg; err.hidden=false; return; }
    const sem=$('#su-sem',m).value;
    const keep=parts.filter(p=>(p.name||'').trim()||String(p.pts??'').trim()||String(p.max??'').trim()).map(p=>({id:p.id||rid(),name:(p.name||'').trim(),pts:String(p.pts??'').trim(),max:String(p.max??'').trim()}));
    const out=Object.assign(su,{code,name,credits:cr===''?'':num(cr),sem,end:$('#su-end',m).value,color,pts:keep.length?'':String(su.pts??''),parts:keep,note:$('#su-note',m).value});
    delete out.sec; delete out.lostSec; if(out.end!=='z') delete out.passed;   /* vazba na nadpis H1 ze starší verze se už nepoužívá */
    S.subjects[out.id]=out;
    /* blok /předmět si drží textovou kopii názvu pro starší verze aplikace */
    if(old&&subjLabel(old)!==subjLabel(out)) Object.values(S.pages).forEach(pg=>(pg.blocks||[]).forEach(b=>{ if(b.type==='subj'&&b.subj===out.id) b.html=esc(subjLabel(out)); }));
    if(isNew) S.ixFocus=out.id;
    Store.queue(); closeModal(); renderSidebar(); renderMain();
    const named=isNew||old.code!==out.code||old.name!==out.name;
    if(!(named&&offerLink(out))) toast(isNew?'Předmět přidán':'Uloženo');
  });
  drawParts();
  if(isNew) setTimeout(()=>{ const a=document.activeElement; if(!a||a===document.body||!m.contains(a)) $('#su-code',m).focus(); },20);
}
function openSemModal(sem,then){
  const isNew=!sem; sem=sem?clone(sem):{id:rid(),name:semName(),target:30,order:Math.max(0,...Object.values(S.semesters).map(x=>x.order||0))+1};
  const n=subjsOf(sem.id).length;
  const m=openModal(isNew?'Nový semestr':'Semestr',`<form class="m-body" id="smf" novalidate>
    ${then?'<p class="note">Předmět patří vždy do semestru. Nejdřív založ semestr, pak hned přidáš předmět.</p>':''}
    <div class="grid2"><div class="fld"><label for="sm-name">Název</label><input id="sm-name" value="${esc(sem.name)}" placeholder="ZS 2026/27"></div>
      <div class="fld"><label for="sm-t">Kredity na semestr</label><input id="sm-t" type="number" min="0" max="90" step="1" inputmode="numeric" value="${esc(sem.target??'')}" placeholder="30"></div></div>
    <p class="note">Podle počtu kreditů se ukazuje, kolik ti v semestru ještě chybí. Obvykle 30.</p>
    <div class="m-actions">${isNew?'':n?`<span class="note">Smazat jde jen prázdný semestr (teď ${n} ${plural(n,'předmět','předměty','předmětů')}).</span>`:'<button type="button" class="btn danger lk-hide" id="sm-del">Smazat</button>'}<span class="sp"></span><button type="button" class="btn" data-close>Zrušit</button><button type="submit" class="btn pri">${then?'Přidat a pokračovat':isNew?'Přidat':'Uložit'}</button></div>
  </form>`);
  const del=$('#sm-del',m); if(del) del.addEventListener('click',()=>{ if(LOCK) return; delete S.semesters[sem.id]; Store.queue(); closeModal(); renderMain(); });
  $('#smf',m).addEventListener('submit',e=>{ e.preventDefault();
    S.semesters[sem.id]=Object.assign(sem,{name:$('#sm-name',m).value.trim()||semName(),target:num($('#sm-t',m).value)??''}); Store.queue(); closeModal(); renderMain();
    if(then) then(sem); });
  setTimeout(()=>$('#sm-name',m).select(),20);
}

/* posluchače a nastavení při startu (volá main.js) */
export function initIndex(){
  const view=$('#view');
  view.addEventListener('input',onPtsInput);
  view.addEventListener('change',onPtsChange);
  /* Enter v poli s body skočí na další pole na kartě */
  view.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||!e.target.classList||!e.target.classList.contains('ixc-in')) return;
    e.preventDefault(); const all=$$('.ixc-in',e.target.closest('.ix-card')), i=all.indexOf(e.target);
    if(all[i+1]) all[i+1].focus(); else e.target.blur();
  });
}

export { ixAction, openIndexView, openSemModal, openSubjectModal, renderIndex };
