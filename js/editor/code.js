/* Úkolníček – Blok s kódem: neformátovaný text na víc řádků (konec řádku je <br>), převody mezi HTML a prostým textem */
import { esc } from '../core.js';

/* ================= HTML ⇄ text =================
   Uložený tvar: řádky oddělené <br>, text bez značek. Prázdný poslední řádek má ještě jedno <br> navíc,
   protože samotné <br> na konci prohlížeč nezobrazí. Při čtení se proto poslední <br> v bloku nepočítá. */
const BLOCKS=/^(DIV|P|LI|H[1-6]|PRE|BLOCKQUOTE)$/;
function domText(root){
  const lines=[]; let cur='', open=false, brk=false;
  const nl=()=>{ lines.push(cur); cur=''; };
  const walk=el=>{
    const kids=[...el.childNodes];
    kids.forEach((ch,i)=>{
      if(ch.nodeType===3){
        ch.nodeValue.replace(/ /g,' ').replace(/[​﻿]/g,'').split('\n').forEach((p,k)=>{
          if(brk&&(k>0||p)){ nl(); brk=false; }
          if(k>0) nl();
          cur+=p; if(p||k>0) open=true;
        });
      } else if(ch.nodeType===1){
        if(ch.tagName==='BR'){ if(i===kids.length-1) return; if(brk){ nl(); brk=false; } nl(); open=true; }
        else if(BLOCKS.test(ch.tagName)){ if(open||brk){ nl(); brk=false; } open=true; walk(ch); brk=true; }
        else if(ch.tagName!=='IMG') walk(ch);
      }
    });
  };
  walk(root); lines.push(cur);
  return lines.join('\n');
}
const htmlToCode=html=>{ if(!html) return ''; const t=document.createElement('template'); t.innerHTML=html; return domText(t.content); };
const codeHtml=text=>{ if(!text) return ''; const h=text.split('\n').map(esc).join('<br>'); return text.endsWith('\n')?h+'<br>':h; };
/* HTML jakéhokoli bloku → bezpečný tvar bloku s kódem */
const codeNorm=html=>codeHtml(htmlToCode(html));
/* text z úryvku (výběr nebo část před kurzorem); značka na konci zařídí, že se poslední <br> počítá */
function fragText(frag){
  const d=document.createElement('div'); d.appendChild(frag); d.appendChild(document.createTextNode('\u0001'));
  return domText(d).slice(0,-1);
}
/* pozice kurzoru v textu bloku (konce řádků se počítají jako jeden znak) */
function caretPos(el){
  const s=getSelection(); if(!s.rangeCount) return 0;
  const r=s.getRangeAt(0); if(!el.contains(r.startContainer)) return 0;
  const pre=document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer,r.startOffset);
  return fragText(pre.cloneContents()).length;
}

/* ================= úpravy v editoru ================= */
/* vloží text (i víc řádků) na místo kurzoru; vrací nic, ukládání obstará událost input */
function insertCode(el,text){
  const s=getSelection(); if(!s.rangeCount||!el.contains(s.getRangeAt(0).startContainer)) return;
  const r=s.getRangeAt(0); r.deleteContents();
  const frag=document.createDocumentFragment();
  String(text).split('\n').forEach((ln,i)=>{ if(i) frag.appendChild(document.createElement('br')); if(ln) frag.appendChild(document.createTextNode(ln)); });
  const last=frag.lastChild; if(!last) return;
  r.insertNode(frag);
  let nx=last.nextSibling; while(nx&&nx.nodeType===3&&!nx.nodeValue) nx=nx.nextSibling;   /* prázdné textové uzly po rozdělení se přeskočí */
  if(last.nodeName==='BR'&&!nx) el.appendChild(document.createElement('br'));   /* prázdný poslední řádek musí být vidět */
  r.setStartAfter(last); r.collapse(true); s.removeAllRanges(); s.addRange(r);
  el.dispatchEvent(new Event('input',{bubbles:true}));
}
const newLine=el=>insertCode(el,'\n');
/* Shift+Tab: odebere až dvě mezery před kurzorem (nebo za ním, když je kurzor na začátku řádku) */
function dedent(el){
  const s=getSelection(); if(!s.rangeCount||!s.isCollapsed) return;
  const r=s.getRangeAt(0), n=r.startContainer; if(n.nodeType!==3||!el.contains(n)) return;
  const before=n.nodeValue.slice(0,r.startOffset), after=n.nodeValue.slice(r.startOffset);
  const b=before.match(/ {1,2}$/), a=!before&&after.match(/^ {1,2}/);
  if(b) n.nodeValue=before.slice(0,-b[0].length)+after;
  else if(a) n.nodeValue=after.slice(a[0].length);
  else return;
  const nr=document.createRange(); nr.setStart(n,b?before.length-b[0].length:0); nr.collapse(true); s.removeAllRanges(); s.addRange(nr);
  el.dispatchEvent(new Event('input',{bubbles:true}));
}

export { caretPos, codeHtml, codeNorm, dedent, domText, fragText, htmlToCode, insertCode, newLine };
