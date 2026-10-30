/* Úkolníček – Rozvrh: týdenní mřížka, události, formulář hodiny */
import { $, $$, clamp, clone, COLOR_CZ, COLORS, DAYS, DAYS_FULL, esc, IC, rid, TYPE_SHORT, TYPES } from '../core.js';
import { S } from '../state.js';
import { modeBtn } from '../theme.js';
import { applyLock, LOCK } from '../lock.js';
import { saveEvent } from '../store.js';
import { eventsOnDate, fromMin, mondayOf, occIndex, parseD, shortDate, toMin, weekInfo, ymd } from '../dates.js';
import { pTitle, revealBlock } from '../pages.js';
import { gotoSubject, isIndex, semList, subjLabel, subjList, subjOcc, subjShort, subjsOf } from '../school.js';
import { renderMain } from '../router.js';
import { closeModal, openModal, openPop, toast } from '../ui.js';
import { sdBind, sdCommit, sdCopyStart } from './schdrag.js';

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
/* hodina s předmětem bere název (zkratku) a barvu živě z Indexu; vlastní barva má přednost */
const evSubj=ev=>ev.subj?S.subjects[ev.subj]||null:null;
function evTitle(ev){ const su=evSubj(ev); return su?subjShort(su):(ev.title||'Bez názvu'); }
function evColor(ev){ const su=evSubj(ev), p=S.pages[ev.pageId]; return ev.color||(su&&su.color)||(p&&p.color)||'purple'; }
function evMeta(ev){ return [ev.place,ev.who].filter(Boolean).map(esc).join(' · '); }
/* krátký štítek: typ · L/S · 2/4 */
function evRep(ev,d){ if(ev.repeat==='odd') return 'L'; if(ev.repeat==='even') return 'S'; if(ev.repeat==='count'&&d){ const k=occIndex(ev,d); return k?`${k}/${+ev.count||1}`:''; } return ''; }
function evKind(ev,d){ return [TYPE_SHORT[ev.type],evRep(ev,d)].filter(Boolean).join(' · '); }
const HOUR_SCALES=[1,1.25,1.5,1.75,2];
/* bublina s celými informacemi po najetí myší na hodinu (u krátkých se nevejdou) */
const evtip=document.createElement('div');   
let evtipT=null, evtipFor=null;
function hideEvTip(){ clearTimeout(evtipT); evtipT=null; evtipFor=null; evtip.hidden=true; }
/* hlavička hodiny: náhled po najetí i menu po kliknutí se zámkem (od 4.20.0 stejná); kód předmětu v jeho barvě */
function evHead(ev,d,note){
  const su=evSubj(ev);
  const rep=ev.repeat==='odd'?'lichý týden':ev.repeat==='even'?'sudý týden':ev.repeat==='once'?'jednorázově':ev.repeat==='count'?`${occIndex(ev,d)}. z ${+ev.count||1}`:'každý týden';
  const t=su&&su.code?`<span class="et-c">${esc(su.code)}</span>${esc(su.name||'')}`:esc(su?subjLabel(su):evTitle(ev));
  return `<div class="et-k">${esc([ev.type,rep].filter(Boolean).join(' · '))}</div><div class="et-t">${t}</div>
    <div class="et-r">${esc(ev.start)} – ${esc(ev.end)}${d?` · ${DAYS_FULL[(d.getDay()+6)%7]} ${shortDate(d)}`:''}</div>
    ${evMeta(ev)?`<div class="et-r">${evMeta(ev)}</div>`:''}
    ${note&&ev.note?`<div class="et-n">${esc(ev.note.length>180?ev.note.slice(0,180)+'…':ev.note)}</div>`:''}`;
}
function showEvTip(btn){
  const ev=S.events[btn.dataset.id]; if(!ev) return;
  const d=parseD(btn.dataset.date);
  evtip.className='evtip hl-'+evColor(ev);
  evtip.innerHTML=evHead(ev,d,true);
  evtip.hidden=false;
  const r=btn.getBoundingClientRect(), w=evtip.offsetWidth, hgt=evtip.offsetHeight;
  let x=r.right+8; if(x+w>innerWidth-8) x=r.left-w-8; if(x<8) x=clamp(r.left,8,innerWidth-w-8);
  const y=clamp(r.top,8,innerHeight-hgt-8);
  evtip.style.left=x+'px'; evtip.style.top=y+'px';
}

function renderSchedule(){
  hideEvTip();
  const dates=weekDates(), today=ymd(new Date()), wi=weekInfo(dates[0]);
  const [h0,h1]=hourRange(dates), hours=h1-h0, hh=Math.round(52*(HOUR_SCALES.includes(+S.settings.hourScale)?+S.settings.hourScale:1));
  const L=16.5*(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs'))||1); /* výška jednoho řádku textu v hodině */
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
          ${kind?`<span class="ev-k">${esc(kind)}</span>`:''}<span class="ev-t">${esc(evTitle(ev))}</span><span class="ev-m mono">${esc(ev.start)} – ${esc(ev.end)}</span>${evMeta(ev)?`<span class="ev-m">${evMeta(ev)}</span>`:''}</button>
          <span class="ev-rs t" aria-hidden="true"></span><span class="ev-rs b" aria-hidden="true"></span>
          <button class="ev-add" data-act="ev-par" data-id="${ev.id}" data-date="${ymd(d)}" title="Přidat další událost ve stejný čas" aria-label="Přidat další událost ve stejný čas">${IC.plus}</button></div>`;
      });
      if(ymd(d)===today){ const nm=new Date().getHours()*60+new Date().getMinutes(); if(nm>=h0*60&&nm<=h1*60) col+=`<div class="now" style="top:${(nm-h0*60)/60*hh}px"></div>`; }
      return col+'<div class="ghost" hidden></div></div>';
    }).join('')}</div></div>`;
  const agenda=`<div class="agenda">${dates.map((d,i)=>{ const evs=eventsOnDate(d);
    return `<div class="ag-day"><div class="ag-dh ${ymd(d)===today?'today':''}"><span>${DAYS_FULL[i][0].toUpperCase()+DAYS_FULL[i].slice(1)} <span class="mono">${shortDate(d)}</span></span><button class="icon-btn" data-act="day-add" data-day="${i}" data-date="${ymd(d)}" aria-label="Přidat událost">${IC.plus}</button></div>
      ${evs.length?evs.map(ev=>evRow(ev,d)).join(''):'<div class="ag-empty">Nic naplánováno</div>'}</div>`; }).join('')}</div>`;
  $('#view').innerHTML=`<div class="view sch-view">
    <div class="v-head"><div><div class="eyebrow">${wi?`${wi.n}. týden výuky · ${wi.parity}`:'Týdenní rozvrh'}</div><div class="sch-title"><h1 class="v-title">Rozvrh</h1><span class="wk-label">${shortDate(dates[0])} – ${shortDate(last)} ${last.getFullYear()}</span></div></div>
      <div class="v-tools">
        <button class="btn btn-text sch-add" data-act="ev-add">${IC.plus}Přidat</button>
        <button class="navbtn" data-act="wk-prev" aria-label="Předchozí týden">${IC.chevL}</button>
        <button class="btn btn-text wk-today${S.weekOffset?'':' cur'}" data-act="wk-today"${S.weekOffset?'':' aria-current="date"'}>Tento týden</button>
        <button class="navbtn" data-act="wk-next" aria-label="Další týden">${IC.chevR}</button>
        <span class="dash-sep" aria-hidden="true"></span>
        <button class="icon-btn lock-btn" data-act="lock"></button>${modeBtn()}
      </div></div>
    ${grid}${agenda}
    ${(()=>{ /* nápověda jen když je k něčemu: prázdný rozvrh, zámek, chybějící začátek semestru */
      const t=[LOCK?'Zamčeno: klik na hodinu vede k předmětu, nová se přidává jen tlačítkem Přidat.':hasAny?'':'Rozvrh je zatím prázdný. Hodina se přidává kliknutím do mřížky na den a čas, nebo tlačítkem Přidat.',S.settings.semesterStart?'':'Pro liché a sudé týdny je potřeba zadat začátek semestru v Nastavení.'].filter(Boolean).join(' ');
      return t?`<p class="sched-hint">${t}</p>`:''; })()}
  </div>`;
  applyLock();
  const sg=$('#sg');
  sg.addEventListener('mousemove',e=>{
    if(LOCK){ $$('.ghost',sg).forEach(g=>g.hidden=true); return; }
    const col=e.target.closest('.sg-col'); $$('.ghost',sg).forEach(g=>{ if(!col||g.parentElement!==col) g.hidden=true; });
    if(!col||e.target!==col) { if(col) $('.ghost',col).hidden=true; return; }
    const g=$('.ghost',col); const y=e.clientY-col.getBoundingClientRect().top; const m=h0*60+Math.floor(y/hh*2)/2*60;
    g.hidden=false; g.style.top=((m-h0*60)/60*hh)+'px'; g.style.height=(hh*110/60)+'px'; g.innerHTML=IC.plus+fromMin(m);   /* stejně dlouhá jako nová hodina (1 h 50 min) */
  });
  sg.addEventListener('mouseleave',()=>$$('.ghost',sg).forEach(g=>g.hidden=true));
  sdBind(sg,openEventModal,evColor);   /* tažení, natažení, kopie s duchem, nová hodina tažením (schdrag.js) */
}
function evRow(ev,d){
  const rep=ev.repeat==='count'&&d&&occIndex(ev,d)?`${occIndex(ev,d)}. z ${+ev.count||1}`:'';
  return `<button class="ev-row hl-${evColor(ev)}" data-act="ev" data-id="${ev.id}"><span class="t">${esc(ev.start)} – ${esc(ev.end)}</span><span class="dot"></span><span><b>${esc(evTitle(ev))}</b><small>${[TYPE_SHORT[ev.type]?ev.type:'',rep,ev.place,ev.who].filter(Boolean).map(esc).join(' · ')}</small></span></button>`;
}
function openEventModal(ev,preset,copy){
  const isNew=!ev;
  ev=ev?clone(ev):Object.assign({id:rid(),title:'',type:'Přednáška',day:0,start:'08:00',end:'09:50',repeat:'weekly',date:ymd(new Date()),count:4,place:'',who:'',note:'',color:''},preset||{});
  if(!ev.date) ev.date=ymd(new Date()); if(!ev.count) ev.count=4;
  /* předmět se vybírá z Indexu; hodina bez předmětu (konzultace, schůzka) má volný název */
  /* se skrytým Indexem se předmět nevybírá; hodina, která už předmět má, si ho ponechá */
  const ix=isIndex(), subs=ix?subjList():[], subOf=v=>v?S.subjects[v]||null:null;
  const su0=evSubj(ev);
  const subSel=!ix&&su0?`<div class="fld"><span class="lbl">Předmět</span><p class="note">${esc(subjLabel(su0))}. Název a barva jsou z Indexu, který je teď v nastavení skrytý.</p></div>`:subs.length?`<div class="fld"><label for="ev-subj">Předmět</label><select id="ev-subj"><option value="">Bez předmětu (vlastní název)</option>${[...semList(),null].map(sm=>{ const l=subjsOf(sm?sm.id:null); return l.length?`<optgroup label="${esc(sm?sm.name:'Bez semestru')}">${l.map(su=>`<option value="${su.id}" ${su0===su?'selected':''}>${esc(subjLabel(su))}</option>`).join('')}</optgroup>`:''; }).join('')}</select><button type="button" class="linkbtn ev-ix" id="ev-ix" hidden>Otevřít v Indexu</button></div>`:'';
  const m=openModal(copy?'Kopie události':isNew?'Nová událost':'Upravit událost',`<form class="m-body" id="evf" novalidate>
    ${subSel}
    <div class="fld" id="f-title"><label for="ev-title">Co</label><input id="ev-title" value="${esc(su0?'':ev.title)}" placeholder="${subs.length?'Konzultace, schůzka, akce…':'Předmět nebo akce'}" autocomplete="off">${subs.length||!ix?'':'<p class="note">Předměty pro rozvrh se zakládají v Indexu.</p>'}</div>
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
    <div class="fld"><span class="lbl">Barva</span><div class="swatches" id="ev-color" style="padding-left:0"><button type="button" class="sw-auto" data-c="" title="Barva se mění s předmětem v Indexu"><span class="ti-dot"></span>Podle předmětu</button>${COLORS.map(c=>`<button type="button" class="sw hl-${c}" data-c="${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div></div>
    <div class="fld"><label for="ev-note">Poznámky</label><textarea id="ev-note" rows="3" placeholder="Co si vzít, co se probírá…">${esc(ev.note)}</textarea></div>
    <p class="err" id="ev-err" hidden></p>
    <div class="m-actions">${isNew?'':'<button type="button" class="btn danger lk-hide" id="ev-del">Odstranit</button>'}<span class="sp"></span><button type="button" class="btn" data-close>Zavřít</button><button type="submit" class="btn pri">${isNew?'Přidat':'Uložit'}</button></div>
  </form>`,'ev-m');
  /* jednotné okno (4.23.0): akce bez vztahu k polím (Kopírovat) jsou ikonou v hlavičce vedle ×, dole jen Odstranit · Zavřít · Uložit */
  if(!isNew){ const x=m.querySelector('.m-head [data-close]'); if(x) x.insertAdjacentHTML('beforebegin',`<button type="button" class="icon-btn" id="ev-copy" title="Kopírovat" aria-label="Kopírovat">${IC.copy}</button>`); }
  /* barva: '' = podle předmětu (jen u hodiny s předmětem), jinak vlastní */
  let type=ev.type, color=su0?(ev.color||''):evColor(ev);
  const selSubj=$('#ev-subj',m), curSu=()=>selSubj?subOf(selSubj.value):(ix?null:su0);
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
  const drawColor=()=>{
    const su=curSu(), auto=$('.sw-auto',m);
    auto.hidden=!su; if(su) auto.className=`sw-auto hl-${su.color||'purple'} ${color===''?'on':''}`;
    $$('#ev-color .sw',m).forEach(x=>x.classList.toggle('on',x.dataset.c===color));
  };
  $('#ev-color',m).addEventListener('click',e=>{ const b=e.target.closest('[data-c]'); if(!b) return; color=b.dataset.c; drawColor(); });
  /* s předmětem: název z Indexu (pole „Co“ se schová), barva podle předmětu */
  const syncSubj=()=>{ const su=curSu(), ixb=$('#ev-ix',m); $('#f-title',m).hidden=!!su; if(ixb) ixb.hidden=!su||!ix; drawColor(); };
  let prevSu=su0;
  if(selSubj) selSubj.addEventListener('change',()=>{
    const su=curSu();
    if(su) color='';
    else if(color==='') color=(prevSu&&prevSu.color)||'purple';
    if(!su&&prevSu&&!$('#ev-title',m).value.trim()) $('#ev-title',m).value=subjShort(prevSu);
    prevSu=su; syncSubj();
    if(!su) $('#ev-title',m).focus();
  });
  syncSubj();
  const ixb=$('#ev-ix',m); if(ixb) ixb.addEventListener('click',()=>{ const su=curSu(); if(!su) return; closeModal(); gotoSubject(su.id); });
  $('#ev-start',m).addEventListener('change',e=>{ const s=toMin(e.target.value), en=toMin($('#ev-end',m).value); if(e.target.value&&en<=s) $('#ev-end',m).value=fromMin(Math.min(s+110,23*60+59)); });
  /* kopie: otevře novou událost se stejnými údaji (uloženými, bez rozepsaných změn) */
  /* na širokém okně: duch hodiny, klik do mřížky ji tam zkopíruje (schdrag.js); v úzkém nová hodina se stejnými údaji */
  const cp=$('#ev-copy',m); if(cp) cp.addEventListener('click',()=>{ const src=S.events[ev.id]||ev; closeModal(); if(sdCopyStart(src)) return; const pre=clone(src); delete pre.id; openEventModal(null,pre,true); });
  const del=$('#ev-del',m); if(del) del.addEventListener('click',()=>{ closeModal(); sdCommit(ev.id,null,'Událost odstraněna'); });
  $('#evf',m).addEventListener('submit',e=>{
    e.preventDefault();
    const su=curSu();
    const out=Object.assign(ev,{title:su?subjShort(su):$('#ev-title',m).value.trim(),type,repeat:$('#ev-repeat',m).value,day:+$('#ev-day',m).value,date:$('#ev-date',m).value,count:parseInt($('#ev-count',m).value,10)||0,start:$('#ev-start',m).value,end:$('#ev-end',m).value,place:$('#ev-place',m).value.trim(),who:$('#ev-who',m).value.trim(),note:$('#ev-note',m).value,color:su?color:(color||'purple')});
    delete out.pageId; delete out.sec;   /* vazby na stránku a nadpis H1 ze starších verzí se už nepoužívají */
    if(su) out.subj=su.id; else delete out.subj;
    const err=$('#ev-err',m); let msg='';
    if(!out.title) msg='Chybí předmět nebo název.';
    else if(!out.start||!out.end) msg='Chybí čas od a do.';
    else if(toMin(out.end)<=toMin(out.start)) msg='Konec musí být po začátku.';
    else if((out.repeat==='once'||out.repeat==='count')&&!out.date) msg=out.repeat==='count'?'Chybí datum první hodiny.':'Chybí datum.';
    else if(out.repeat==='count'&&(out.count<1||out.count>52)) msg='Počet opakování musí být 1 až 52.';
    if(msg){ err.textContent=msg; err.hidden=false; return; }
    if(out.repeat==='once'||out.repeat==='count'){ const d=parseD(out.date); out.day=(d.getDay()+6)%7; }
    if(out.repeat!=='count') delete out.count;
    S.events[out.id]=out; saveEvent(out); closeModal(); renderMain();
    toast(isNew?'Událost přidána':'Změny uloženy');
  });
  setTimeout(()=>{ const t=selSubj&&!su0&&!ev.title?selSubj:$('#ev-title',m); if(t&&!t.closest('[hidden]')&&!(t.value)) t.focus(); },20);
}

/* zamčený rozvrh: hodina se neupravuje, klik nabídne skok na předmět v Indexu nebo v poznámkách */
function openEventLocked(anchor,ev){
  const su=evSubj(ev), occ=su?subjOcc(su.id):[];
  const where=pg=>{ const r=[]; let p=pg; while(p&&r.length<6){ r.unshift(pTitle(p)); p=S.pages[p.parent]; } return r.join(' › '); };
  const d=anchor.dataset&&anchor.dataset.date?parseD(anchor.dataset.date):null;
  const its=(su&&isIndex()?`<button class="pop-item" data-v="ix"><span class="pi-ic">${IC.subject}</span>Otevřít v Indexu</button>`:'')
    +occ.map((o,i)=>`<button class="pop-item" data-v="n:${i}"><span class="pi-ic">${IC.page}</span><span>Otevřít v poznámkách<small>${esc(where(o.pg))}</small></span></button>`).join('');
  const h=`<div class="ev-lk-h hl-${evColor(ev)}">${evHead(ev,d,false)}</div>`+(its?'<div class="pop-sep"></div>'+its:'');
  openPop(anchor,h,v=>{
    if(v==='ix') gotoSubject(su.id);
    else if(v.startsWith('n:')){ const o=occ[+v.slice(2)]; if(o) revealBlock(o.pg.id,o.b.id,true); }
  });
}

/* posluchače a nastavení při startu (volá main.js ve stejném pořadí jako dřív) */
export function initSchedule(){
  evtip.className='evtip';
  evtip.hidden=true;
  document.body.appendChild(evtip);
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
}

export { evColor, evRow, evTitle, HOUR_SCALES, openEventLocked, openEventModal, renderSchedule, weekDates };
