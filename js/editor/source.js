/* Úkolníček – Zobrazení zdroje: bloky stránky (bez názvu a vlastností) jako Markdown v textovém poli.
   - úpravy se průběžně (po 0,4 s) převádějí zpět na bloky; nezměněné bloky zůstanou beze změny (stejné ID, barvy, sbalení…),
     protože se párují podle svého markdownu; upravený blok si nechá ID bloku, který byl na jeho místě
   - bloky, které Markdown nezapíše beze ztráty (obrázek, tabulka, podstránka, předmět, text s obrázkem), jsou v textu
     jako řádek <!-- uk:ID popis -->: jde přesunout nebo smazat, obsah se upravuje v běžném zobrazení
   - prázdný řádek stránky je v textu jako <br>
   - zapíná se tlačítkem </> u zámku, jen pro otevřenou stránku a jen v tomhle okně (nic se neukládá) */
import { $, esc, simpleUi } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { newBlock, pTitle } from '../pages.js';
import { subjBlockText } from '../school.js';
import { renderPage } from './render.js';
import { toast } from '../ui.js';
import { blockMd, cleanBlock, mdToBlocks } from './markdown.js';

const LIST=new Set(['bullet','num','todo']);
const RE_KEEP=/^\s*<!--\s*uk:([A-Za-z0-9_-]+)[\s\S]*?-->\s*$/;
let srcPage=null, timer=0, srcBase='';   /* srcBase = zdroj dat při vykreslení pole: když se data mezitím změnila jinde (stažení z Disku, ⌘Z), rozepsané se nepoužije */

const isKeep=b=>['image','table','page','subj'].includes(b.type)||/<img/i.test(b.html||'');
function label(b){
  const t=b.type==='image'?'Obrázek'+(b.name?': '+b.name:''):b.type==='table'?'Tabulka':b.type==='page'?'Podstránka: '+pTitle(S.pages[b.pageId]||null):b.type==='subj'?'Předmět: '+subjBlockText(b):'Text s obrázkem';
  return t.replace(/\s+/g,' ').replace(/-->|--/g,'–').slice(0,80);
}
function srcMd(b){
  if(isKeep(b)) return `<!-- uk:${b.id} ${label(b)} -->`;
  if(b.type==='p'&&!String(b.html||'').replace(/<br\s*\/?>/gi,'').trim()) return '<br>';
  return blockMd(b);
}
function sourceText(pg){
  let out='', prev=null;
  for(const b of pg.blocks||[]){
    const s=srcMd(b); if(s==null) continue;
    out+=(out?(prev&&LIST.has(prev.type)&&LIST.has(b.type)?'\n':'\n\n'):'')+s; prev=b;
  }
  return out;
}
/* text → bloky stránky; vrací true, když se něco změnilo */
function applySource(pg,text){
  const old=pg.blocks||[], byId=new Map(old.map(b=>[b.id,b])), oldIdx=new Map(old.map((b,i)=>[b.id,i]));
  const pool=new Map();
  old.forEach(b=>{ if(isKeep(b)) return; const s=srcMd(b); if(s==null) return; if(!pool.has(s)) pool.set(s,[]); pool.get(s).push(b); });
  const used=new Set(), items=[]; let seg=[];
  const flushSeg=()=>{
    if(!seg.length) return;
    /* prázdný řádek na začátku: „---“ na prvním řádku není hlavička YAML */
    mdToBlocks('\n'+seg.join('\n')).forEach(x=>{ const nb=cleanBlock(x); if(nb.type==='p'&&!nb.html.replace(/<br\s*\/?>/gi,'').trim()) nb.html=''; items.push(nb); });
    seg=[];
  };
  String(text).replace(/\r\n?/g,'\n').split('\n').forEach(line=>{
    const m=line.match(RE_KEEP);
    if(!m){ seg.push(line); return; }
    /* značka bloku: poprvé blok, zkopírovaná podruhé nebo neznámá (z jiné stránky) se vynechá */
    if(byId.has(m[1])&&!used.has(m[1])&&isKeep(byId.get(m[1]))){ flushSeg(); used.add(m[1]); items.push(byId.get(m[1])); }
  });
  flushSeg();
  /* nezměněné bloky: původní objekt podle stejného markdownu */
  let res=items.map(b=>{
    if(byId.get(b.id)===b) return b;
    const q=pool.get(srcMd(b));
    while(q&&q.length){ const o=q.shift(); if(!used.has(o.id)){ used.add(o.id); return o; } }
    return b;
  });
  /* upravené bloky: ID (a sbalení nadpisu) po původním bloku na stejném místě */
  let last=-1;
  res.forEach(b=>{
    if(byId.get(b.id)===b){ last=oldIdx.get(b.id); return; }
    for(let i=last+1;i<old.length;i++){
      const o=old[i]; if(used.has(o.id)) break; if(isKeep(o)) continue;
      used.add(o.id); last=i; b.id=o.id;
      if(o.type===b.type){ ['collapsed','until','untilVis','color','icon'].forEach(k=>{ if(o[k]!=null&&b[k]==null) b[k]=o[k]; }); }
      break;
    }
  });
  if(!res.length) res=[newBlock('p')];
  if(res.length===old.length&&res.every((b,i)=>b===old[i])) return false;
  pg.blocks=res; savePage(pg); return true;
}
/* fromRender = volá renderPage, pole se stejně vykreslí znovu */
function apply(fromRender){
  const ta=$('#src-ed'), pg=S.pages[srcPage]; if(!ta||!pg||LOCK||ta.dataset.page!==pg.id) return;
  if(sourceText(pg)!==srcBase){
    /* stránka se mezitím změnila jinde (jiné okno, Disk): rozepsané by ji přepsalo, zdroj se načte znovu */
    if(!fromRender){ toast('Stránka se mezitím změnila jinde, zdroj je načtený znovu.'); const st=$('#main').scrollTop; renderPage(pg); $('#main').scrollTop=st; }
    return;
  }
  applySource(pg,ta.value); srcBase=sourceText(pg);
}
function flushSource(fromRender){ if(!timer) return; clearTimeout(timer); timer=0; apply(fromRender); }
/* výška pole podle obsahu; posunutí stránky se při tom nesmí změnit (pole se na okamžik zmenší a stránka by uskočila nahoru) */
const fit=ta=>{ const m=$('#main'), st=m?m.scrollTop:0; ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px'; if(m&&m.scrollTop!==st) m.scrollTop=st; };
const srcOn=pg=>!!pg&&srcPage===pg.id&&!simpleUi();   /* v úzkém okně se zdroj neukazuje (po rozšíření se vrátí) */
let keepSel=null;   /* kurzor v poli přes překreslení stránky (⌘Z, data z jiného okna) */
/* HTML pole pro renderPage, nebo null (běžné zobrazení) */
function sourceHtml(pg){
  if(srcPage!==pg.id){ srcPage=null; return null; }
  if(simpleUi()) return null;
  const old=$('#src-ed'); keepSel=old&&old.dataset.page===pg.id?{s:old.selectionStart,e:old.selectionEnd,f:document.activeElement===old}:null;
  srcBase=sourceText(pg);
  return `<textarea class="src-ed" id="src-ed" data-page="${pg.id}" spellcheck="false" autocapitalize="off" autocomplete="off"${LOCK?' readonly':''} aria-label="Zdroj stránky v Markdownu">${esc(srcBase)}</textarea>`;
}
function fitSource(){
  const ta=$('#src-ed'); if(!ta) return; fit(ta);
  if(keepSel){ const n=ta.value.length; ta.setSelectionRange(Math.min(keepSel.s,n),Math.min(keepSel.e,n)); if(keepSel.f) ta.focus({preventScroll:true}); keepSel=null; }
}
/* klávesy v poli: Tab odsadí (s výběrem všechny řádky), ⇧Tab vrátí; Enter v seznamu, úkolu nebo citaci pokračuje
   stejnou značkou, na prázdné položce ji smaže. Přes insertText, takže funguje ⌘Z v poli. */
function srcKeys(e){
  const ta=e.target; if(ta.id!=='src-ed'||e.isComposing||ta.readOnly||e.metaKey||e.ctrlKey||e.altKey) return;
  const v=ta.value, s=ta.selectionStart, en=ta.selectionEnd, ls=v.lastIndexOf('\n',s-1)+1;
  const put=t=>document.execCommand('insertText',false,t);
  if(e.key==='Tab'){
    e.preventDefault();
    if(s===en&&!e.shiftKey){ put('  '); return; }
    const le=v.indexOf('\n',en>s&&v[en-1]==='\n'?en-1:en), end=le<0?v.length:le;
    const out=v.slice(ls,end).split('\n').map(l=>e.shiftKey?l.replace(/^( {1,2}|\t)/,''):'  '+l).join('\n');
    if(out===v.slice(ls,end)) return;
    ta.setSelectionRange(ls,end); put(out); ta.setSelectionRange(ls,ls+out.length);
    return;
  }
  if(e.key==='Enter'&&!e.shiftKey&&s===en){
    const line=v.slice(ls,s), m=line.match(/^([ \t]*)([-*+] \[[ xX]\] |[-*+] |(\d{1,9})([.)]) |> )/); if(!m) return;
    const nl=v.indexOf('\n',s), rest=v.slice(s,nl<0?v.length:nl);
    e.preventDefault();
    if(line.length===m[0].length&&!rest.trim()){ ta.setSelectionRange(ls,s); document.execCommand('delete'); return; }   /* prázdná položka: konec seznamu */
    let mk=m[2].replace(/\[[xX]\]/,'[ ]'); if(m[3]) mk=(+m[3]+1)+m[4]+' ';
    put('\n'+m[1]+mk);
  }
}
function toggleSource(pg){
  if(!pg) return;
  const on=!srcOn(pg); flushSource(); srcPage=on?pg.id:null;
  const st=$('#main').scrollTop; renderPage(pg); $('#main').scrollTop=st;
  if(on){ const ta=$('#src-ed'); if(ta){ ta.focus({preventScroll:true}); ta.setSelectionRange(0,0); } }
}
function initSource(){
  $('#view').addEventListener('input',e=>{
    if(e.target.id!=='src-ed') return;
    fit(e.target); clearTimeout(timer); timer=setTimeout(()=>{ timer=0; apply(); },400);
  });
  /* před odchodem ze stránky nebo skrytím okna se rozepsané převede hned */
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') flushSource(); });
  $('#view').addEventListener('focusout',e=>{ if(e.target.id==='src-ed') flushSource(); });
  $('#view').addEventListener('keydown',srcKeys);
  addEventListener('resize',()=>{ const ta=$('#src-ed'); if(ta) fit(ta); });
  /* přechod mezi úzkým a širokým oknem: zdroj se schová / vrátí */
  matchMedia('(max-width:860px)').addEventListener('change',()=>{
    flushSource(); const pg=srcPage&&S.pages[srcPage];
    if(pg&&S.view.kind==='page'&&S.view.pageId===pg.id){ const st=$('#main').scrollTop; renderPage(pg); $('#main').scrollTop=st; }
  });
}

export { fitSource, flushSource, initSource, sourceHtml, srcOn, toggleSource };
