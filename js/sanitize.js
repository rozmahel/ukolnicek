/* Úkolníček – Čištění HTML z editoru, odkazy a zástupné obrázky */
import { plain } from './core.js';
import { IMGURL } from './store.js';

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

export { imgSrc, isBlank, isBlankEl, normUrl, sanitize, unwrap, urlLabel };
