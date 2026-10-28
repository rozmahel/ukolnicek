/* Úkolníček – Odkazy v textu */
import { $, $$, esc, IC, norm } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { flatPages, pIcon, pTitle } from '../pages.js';
import { normUrl, unwrap, urlLabel } from '../sanitize.js';
import { go } from '../router.js';
import { closeModal, openModal, openPop, placePop, toast } from '../ui.js';

/* ================= odkazy =================
   Webový odkaz: <a class="lnk" href>. Skrytý odkaz na stránku (od 4.8.0): <a class="hlnk" data-hp="ID"> – vypadá jako obyčejný text,
   na stránku se přejde dvojklikem nebo ⌘/Ctrl + klikem (main.js). Vkládá se ve stejném okně, záložka Stránka. */
const crumbs=p=>{ const out=[]; let x=S.pages[p.parent]; while(x&&out.length<6){ out.unshift(pTitle(x)); x=S.pages[x.parent]; } return out.join(' › '); };
/* stránky pro výběr: shoda s označeným textem nahoře, pak podle hledání */
function pageList(q,want){
  const nq=norm(q.trim()), nw=norm((want||'').trim());
  const all=flatPages().map(({p})=>p).filter(p=>!nq||norm(pTitle(p)).includes(nq)||norm(crumbs(p)).includes(nq));
  const rank=p=>{ const t=norm(pTitle(p)); return nw&&t===nw?0:nw&&(t.includes(nw)||nw.includes(t))?1:2; };
  return all.map((p,i)=>({p,i,r:rank(p)})).sort((a,b)=>a.r-b.r||a.i-b.i).slice(0,8).map(x=>x.p);
}
/* skrytý odkaz, ve kterém je začátek výběru nebo kurzor */
function hlnkAt(range){ if(!range) return null; const n=range.startContainer, el=n.nodeType===1?n:n.parentElement; return el&&el.closest?el.closest('a.hlnk'):null; }
function openLinkDialog(host,range,fromSel,existing){
  if(!host) return;
  const exH=!existing?hlnkAt(range):null; if(exH) existing=exH;
  const isH=!!(existing&&existing.classList.contains('hlnk'));
  const selText=existing?existing.textContent:(fromSel&&range&&!range.collapsed?range.toString():'');
  let mode=isH?'page':'web', pick=isH?existing.dataset.hp:null;
  const tabs=existing?'':`<div class="seg lk-tabs" id="lk-tabs"><button type="button" class="on" data-v="web">Webová adresa</button><button type="button" data-v="page">Stránka</button></div>`;
  const m=openModal(existing?'Upravit odkaz':'Vložit odkaz',`<form class="m-body" id="lkf" novalidate>
    ${tabs}
    <div class="fld lk-web"${isH?' hidden':''}><label for="lk-url">Adresa</label><input id="lk-url" value="${esc(existing&&!isH?existing.getAttribute('href'):'')}" placeholder="https://… nebo google.com" autocomplete="off" spellcheck="false" inputmode="url"></div>
    <div class="fld lk-pg"${isH?'':' hidden'}><label for="lk-q">Stránka</label><input id="lk-q" placeholder="Hledat stránku" autocomplete="off"><div class="lk-list" id="lk-list" role="listbox"></div>
      <p class="note">Odkaz nebude vidět. Na stránku přejdeš dvojklikem nebo ⌘ + klikem.</p></div>
    <div class="fld"><label for="lk-name">Text odkazu</label><input id="lk-name" value="${esc(selText)}" placeholder="Jak se má odkaz jmenovat (nepovinné)" autocomplete="off"></div>
    <p class="err" id="lk-err" hidden></p>
    <div class="m-actions">${existing?'<button type="button" class="btn danger" id="lk-del">Odebrat odkaz</button>':''}<span class="sp"></span><button type="button" class="btn" data-close>Zavřít</button><button type="submit" class="btn pri">${existing?'Uložit':'Vložit'}</button></div>
  </form>`);
  const drawList=()=>{
    const q=$('#lk-q',m).value, list=pageList(q,selText);
    const cur=isH&&!q&&S.pages[existing.dataset.hp]; if(cur&&!list.includes(cur)) list.unshift(cur);
    /* předvybraná: při hledání první výsledek, jinak stránka s názvem jako označený text */
    if(!pick||!list.some(p=>p.id===pick)){ const t=list[0]&&norm(pTitle(list[0])), w=norm(selText.trim()); pick=list[0]&&(q.trim()||(w&&(t.includes(w)||w.includes(t))))?list[0].id:null; }
    $('#lk-list',m).innerHTML=list.length?list.map(p=>{ const c=crumbs(p); return `<button type="button" class="pop-item ${p.id===pick?'act':''}" data-id="${p.id}" role="option" aria-selected="${p.id===pick}"><span class="pi-ic">${pIcon(p)}</span><span>${esc(pTitle(p))}${c?`<small>${esc(c)}</small>`:''}</span></button>`; }).join(''):'<div class="empty">Nic nenalezeno.</div>';
  };
  const setMode=v=>{ mode=v; $('.lk-web',m).hidden=v!=='web'; $('.lk-pg',m).hidden=v!=='page'; $$('#lk-tabs button',m).forEach(b=>b.classList.toggle('on',b.dataset.v===v)); $('#lk-err',m).hidden=true;
    if(v==='page'){ drawList(); setTimeout(()=>$('#lk-q',m).focus(),20); } else setTimeout(()=>$('#lk-url',m).focus(),20); };
  const tb=$('#lk-tabs',m); if(tb) tb.addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(b) setMode(b.dataset.v); });
  $('#lk-q',m).addEventListener('input',()=>{ pick=null; drawList(); });
  $('#lk-q',m).addEventListener('keydown',e=>{
    if(e.key!=='ArrowDown'&&e.key!=='ArrowUp') return; e.preventDefault();
    const ids=$$('#lk-list [data-id]',m).map(b=>b.dataset.id); if(!ids.length) return;
    const i=ids.indexOf(pick); pick=ids[(i+(e.key==='ArrowDown'?1:-1)+ids.length)%ids.length]; drawList();
    const act=$('#lk-list .act',m); if(act) act.scrollIntoView({block:'nearest'});
  });
  $('#lk-list',m).addEventListener('click',e=>{ const b=e.target.closest('[data-id]'); if(!b) return; pick=b.dataset.id; drawList(); });
  $('#lk-list',m).addEventListener('dblclick',e=>{ const b=e.target.closest('[data-id]'); if(b){ pick=b.dataset.id; $('#lkf',m).requestSubmit(); } });
  if(isH) drawList();
  setTimeout(()=>(isH?$('#lk-q',m):$('#lk-url',m)).focus(),20);
  const done=()=>{ host.dispatchEvent(new Event('input',{bubbles:true})); };
  const del=$('#lk-del',m); if(del) del.addEventListener('click',()=>{ closeModal(); unwrap(existing); done(); });
  const fail=t=>{ const er=$('#lk-err',m); er.textContent=t; er.hidden=false; };
  $('#lkf',m).addEventListener('submit',e=>{
    e.preventDefault();
    const name=$('#lk-name',m).value.trim();
    let href='';
    if(mode==='web'){ href=normUrl($('#lk-url',m).value); if(!href) return fail('Chybí adresa, třeba https://www.google.com'); }
    else if(!pick||!S.pages[pick]) return fail('Chybí stránka.');
    closeModal();
    if(!document.contains(host)){ toast('Místo pro odkaz mezitím zmizelo, stačí to zkusit znovu.'); return; }
    if(existing){
      if(mode==='page'){ existing.dataset.hp=pick; if(name&&name!==existing.textContent) existing.textContent=name; }
      else { existing.setAttribute('href',href); existing.textContent=name||urlLabel(href); }
      done(); return;
    }
    const a=document.createElement('a');
    if(mode==='web'){ a.href=href; a.className='lnk'; a.target='_blank'; a.rel='noopener noreferrer'; }
    else { a.className='hlnk'; a.dataset.hp=pick; }
    let r=range; if(!r||!host.contains(r.startContainer)){ r=document.createRange(); r.selectNodeContents(host); r.collapse(false); }
    /* skrytý odkaz na označený text: text i jeho formát zůstanou, jen se obalí */
    if(mode==='page'&&!r.collapsed&&(!name||name===selText)){
      a.appendChild(r.extractContents()); r.insertNode(a);
      host.focus({preventScroll:true});
      const nr=document.createRange(); nr.setStartAfter(a); nr.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(nr);
      done(); return;
    }
    a.textContent=name||(mode==='web'?urlLabel(href):pTitle(S.pages[pick]));
    if(!r.collapsed) r.deleteContents();
    const sp=document.createTextNode(' ');
    r.insertNode(sp); r.insertNode(a);
    host.focus({preventScroll:true});
    const nr=document.createRange(); nr.setStartAfter(sp); nr.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(nr);
    done();
  });
}
/* skrytý odkaz: přejít na stránku */
function openHiddenLink(a){
  const id=a&&a.dataset.hp, p=id&&S.pages[id];
  if(!p) return toast('Stránka už neexistuje.');
  go({kind:'page',pageId:id});
}
function openLinkPop(a){
  const href=a.getAttribute('href')||'', host=a.closest('.txt');
  /* od 4.20.0: jeden řádek – adresa je hlavní akce (Otevřít), Upravit a Odebrat jen jako ikony */
  const h=`<button class="lk-open" data-v="open" title="${esc(href)}"><span class="lk-url">${esc(urlLabel(href))}</span>${IC.pageLink}</button><span class="lk-sep" aria-hidden="true"></span><button class="lk-b" data-v="edit" title="Upravit odkaz" aria-label="Upravit odkaz">${IC.edit}</button>${LOCK?'':`<button class="lk-b danger" data-v="del" title="Odebrat odkaz" aria-label="Odebrat odkaz">${IC.x}</button>`}`;
  const p=openPop(a,h,v=>{
    if(v==='open') window.open(href,'_blank','noopener');
    else if(v==='edit') openLinkDialog(host,null,false,a);
    else if(v==='del'){ unwrap(a); host.dispatchEvent(new Event('input',{bubbles:true})); }
  });
  p.classList.add('lk-one'); placePop(p,a.getBoundingClientRect());
}

export { openHiddenLink, openLinkDialog, openLinkPop };
