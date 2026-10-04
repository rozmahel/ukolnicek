/* Úkolníček – Odkazy v textu */
import { $, esc } from '../core.js';
import { LOCK } from '../lock.js';
import { normUrl, unwrap, urlLabel } from '../sanitize.js';
import { closeModal, openModal, openPop, toast } from '../ui.js';

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
  setTimeout(()=>$('#lk-url',m).focus(),20);
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

export { openLinkDialog, openLinkPop };
