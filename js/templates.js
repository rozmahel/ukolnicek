/* Úkolníček – Šablony (od 4.27.0)
   Jeden seznam: vestavěné (Předmět, Přehled týdnů, Obecné informace) i vlastní se chovají stejně – jdou upravit,
   přejmenovat, duplikovat, přesunout i odstranit.
   Data: settings.tpls = {ID: {name?, o?, blocks?, off?}}; klíč jen tehdy, když se něco liší od výchozího stavu,
   takže bez úprav se otisk nemění. Vlastní šablona má vše; u vestavěné (ID = klíč v BUILTIN) je jen to, co se
   změnilo: name/blocks = upravená, o = posunutá, off = odstraněná. Chybějící blocks = výchozí obsah z kódu.
   settings.templates (4.19–4.26, zapínalo vestavěné šablony) se už nepoužívá a v datech zůstává pro starší verze.
   Úprava šablony = dočasná stránka S.tplDraft (pg.tpl = true) v běžném pohledu {kind:'page'}. V S.pages je jako
   nevýčtová položka: Object.values/keys/entries ji nevidí, takže se neuloží do dat, není v levém panelu, Hledání,
   Úkolech ani zpětných odkazech, ale S.pages[ID] a celý editor fungují. Každá úprava se hned zapíše do settings.tpls
   (savePage → S.tplHook ve store.js), stejně jako se průběžně ukládají poznámky. */
import { $, clone, esc, IC, rid, TEXT_TYPES } from './core.js';
import { S } from './state.js';
import { savePage, saveSettings } from './store.js';
import { newBlock, newTable } from './pages.js';
import { isBlank } from './sanitize.js';
import { focusBlock, focusEl } from './editor/caret.js';
import { go } from './router.js';
import { rerenderBlocks } from './editor/render.js';
import { closeModal, toast } from './ui.js';

/* obrázky, kresby a podstránky v šabloně nejsou (soubory na Disku a stránky ve stromu) */
const TPL_SKIP=new Set(['image','page']);

/* ---- vestavěné šablony (výchozí obsah, vždy nové bloky s novými ID) ---- */
const BUILTIN=[['subject','Předmět'],['weeks','Přehled týdnů'],['info','Obecné informace']];
const isBuiltin=id=>BUILTIN.some(x=>x[0]===id);
function builtinBlocks(k){
  const tx=(type,html)=>newBlock(type,{html:html||''});
  if(k==='subject'){
    const t=newTable(4,3); t.hrow=true;
    ['Test','Termín','Body'].forEach((x,i)=>t.rows[0].cells[i].lines[0].html=x);
    return [tx('h2','Úkoly'),tx('todo',''),tx('h2','Body a testy'),t,tx('h2','Poznámky'),tx('p','')];
  }
  if(k==='weeks'){
    const t=newTable(4,6); t.hcol=true; t.hrow=true;
    ['','1. týden','2. týden','3. týden','4. týden','Zkouškový'].forEach((x,i)=>t.rows[0].cells[i].lines[0].html=x);
    [['purple','První měsíc'],['green','Druhý měsíc'],['blue','Třetí měsíc']].forEach(([c,x],i)=>t.rows[i+1].cells[0].lines[0].html=`<mark class="hl-${c}">${x}</mark>`);
    return [t,tx('p','')];
  }
  return [tx('h2','Kontakty'),tx('bullet',''),tx('h2','Důležité odkazy a pravidla'),tx('bullet',''),tx('h2','Termíny zkoušek'),tx('todo','')];
}

/* ---- seznam ---- */
const tplAll=()=>S.settings.tpls||{};
function tplSet(all){ if(Object.keys(all).length) S.settings.tpls=all; else delete S.settings.tpls; saveSettings(); }
/* všechny šablony v pořadí: {id, name, o, blocks, edited} (edited = vestavěná se změněným názvem nebo obsahem) */
function tplList(){
  const ov=tplAll(), out=[];
  BUILTIN.forEach(([id,name],i)=>{ const x=ov[id]||{}; if(x.off) return;
    out.push({id,name:x.name||name,o:Number.isFinite(x.o)?x.o:i+1,get blocks(){ return x.blocks||builtinBlocks(id); },edited:!!(x.name||x.blocks)}); });
  Object.entries(ov).forEach(([id,x])=>{ if(isBuiltin(id)||!x||x.off) return; out.push({id,name:x.name||'Bez názvu',o:+x.o||0,blocks:x.blocks||[],edited:false}); });
  return out.sort((a,b)=>a.o-b.o||String(a.name).localeCompare(String(b.name),'cs'));
}
const tplGet=id=>tplList().find(t=>t.id===id)||null;
const tplHas=()=>tplList().length>0;
const nextO=()=>Math.max(0,...tplList().map(t=>t.o))+1;

/* kopie bloků s novými ID; „sbalovat až sem“ ukazuje na kopii, na blok mimo kopii se zruší */
function tplCopy(bl){
  const src=clone((bl||[]).filter(b=>b&&!TPL_SKIP.has(b.type)));
  const ids=new Map(); src.forEach(b=>{ const n=rid(); ids.set(b.id,n); b.id=n; });
  src.forEach(b=>{ if(b.until){ const n=ids.get(b.until); if(n) b.until=n; else { delete b.until; delete b.untilVis; } } });
  return src;
}

/* ---- vložení do stránky (/šablona, /název šablony) ---- */
function insertTpl(pg,id,b){
  const t=tplGet(id); if(!t) return;
  const bl=tplCopy(t.blocks); if(!bl.length) return;
  const i=b?pg.blocks.indexOf(b):-1;
  if(i<0) pg.blocks.push(...bl);
  else if(b.type==='p'&&isBlank(b.html)) pg.blocks.splice(i,1,...bl);
  else pg.blocks.splice(i+1,0,...bl);
  /* pod šablonou je vždy řádek na psaní */
  const last=bl[bl.length-1]; let ni=pg.blocks.indexOf(last), next=pg.blocks[ni+1];
  if(!TEXT_TYPES.includes(last.type)&&(!next||!TEXT_TYPES.includes(next.type))){ next=newBlock('p'); pg.blocks.splice(ni+1,0,next); }
  savePage(pg,0); rerenderBlocks();
  const f=TEXT_TYPES.includes(last.type)?last:next; if(f) focusBlock(f.id,'end');
}

/* ---- úprava šablony ---- */
const TPL={back:null,fromSet:false};
function attachDraft(){ const d=S.tplDraft; if(d) Object.defineProperty(S.pages,d.id,{value:d,enumerable:false,configurable:true,writable:true}); }
function dropDraft(){ const d=S.tplDraft; if(!d) return; S.tplDraft=null; try{ delete S.pages[d.id]; }catch(_){} }
/* zápis rozpracované šablony do settings.tpls; nová prázdná (bez názvu a textu) se zatím neukládá */
function syncDraft(pg){
  if(!pg||!pg.tpl||S.tplDraft!==pg) return;
  const all=Object.assign({},tplAll()), cur=tplGet(pg.id), bl=pg.blocks.filter(b=>!TPL_SKIP.has(b.type)), name=String(pg.title||'').trim();
  if(!cur&&!name&&bl.every(b=>TEXT_TYPES.includes(b.type)&&isBlank(b.html))) return;
  all[pg.id]={name:name||'Bez názvu',o:cur?cur.o:nextO(),blocks:clone(bl)};
  tplSet(all);
}
S.tplHook=syncDraft;   /* volá savePage ve store.js (přes S kvůli kruhovému importu) */
/* id = upravit existující; bez id nová šablona (init = {name, blocks} z výběru bloků) */
function editTemplate(id,init){
  const t=id?tplGet(id):null; if(id&&!t) return;
  dropDraft();
  const pg={id:id||'t'+rid(),title:t?t.name:(init&&init.name)||'',icon:'',parent:null,props:[],tpl:true,
    blocks:t?clone(t.blocks):init&&init.blocks&&init.blocks.length?init.blocks:[newBlock('p')]};
  if(!pg.blocks.length) pg.blocks=[newBlock('p')];
  TPL.fromSet=!!S.modal&&!!$('.set',S.modal);
  if(S.view.kind!=='page'||!S.pages[S.view.pageId]||!S.pages[S.view.pageId].tpl) TPL.back=clone(S.view);
  S.tplDraft=pg; attachDraft();
  if(init) syncDraft(pg);
  closeModal(); go({kind:'page',pageId:pg.id});
  if(!t) setTimeout(()=>{ const ti=$('#page-title'); if(!ti) return; focusEl(ti,'end'); if(ti.textContent){ const r=document.createRange(); r.selectNodeContents(ti); const s=getSelection(); s.removeAllRanges(); s.addRange(r); } },30);
}
/* Zavřít: zpět tam, odkud se šablona otevřela (z Nastavení zase do Nastavení → Formát) */
function closeTemplate(){
  const back=TPL.back&&!(TPL.back.kind==='page'&&!S.pages[TPL.back.pageId])?TPL.back:{kind:'today'}, fromSet=TPL.fromSet;
  TPL.back=null; TPL.fromSet=false;
  go(back);   /* go() dočasnou stránku zahodí */
  if(fromSet){ S.setTab='format'; import('./views/settings.js').then(m=>m.openSettings()); }
}
/* ⋮⋮ → Uložit jako šablonu: kopie bloků, název z prvního nadpisu nebo textu */
function saveAsTemplate(blocks){
  const bl=tplCopy(blocks); if(!bl.length) return toast('Obrázky, kresby a podstránky se do šablony neukládají.');
  const first=bl.find(b=>TEXT_TYPES.includes(b.type)&&!isBlank(b.html))||bl.find(b=>b.type==='subj');
  const d=document.createElement('div'); d.innerHTML=first?first.html||'':'';
  editTemplate(null,{name:d.textContent.replace(/\s+/g,' ').trim().slice(0,60),blocks:bl});
}

/* ---- správa v Nastavení → Formát ---- */
function tplRowsHtml(){
  const l=tplList();
  return l.length?l.map(t=>`<div class="tpl-row" draggable="true" data-id="${esc(t.id)}"><span class="tpl-grip" aria-hidden="true">${IC.grip}</span><button type="button" class="tpl-nm" data-tpl="edit" title="Upravit">${esc(t.name)}</button>`
    +(t.edited?`<button type="button" class="icon-btn" data-tpl="reset" title="Vrátit výchozí obsah" aria-label="Vrátit výchozí obsah">${IC.restore}</button>`:'')
    +`<button type="button" class="icon-btn" data-tpl="dup" title="Duplikovat" aria-label="Duplikovat">${IC.dup}</button><button type="button" class="icon-btn danger lk-hide" data-tpl="del" title="Odstranit" aria-label="Odstranit">${IC.trash}</button></div>`).join('')
    :'<div class="empty">Zatím žádné šablony.</div>';
}
function dupTemplate(id){
  const src=tplGet(id); if(!src) return;
  const all=Object.assign({},tplAll()), nid='t'+rid();
  all[nid]={name:src.name+' (kopie)',o:nextO(),blocks:tplCopy(src.blocks)};
  tplSet(all); return nid;
}
function delTemplate(id,redraw){
  const all=Object.assign({},tplAll()), prev=all[id];
  if(!tplGet(id)) return;
  if(isBuiltin(id)) all[id]=Object.assign({},prev||{},{off:1}); else delete all[id];
  tplSet(all); redraw();
  toast('Šablona odstraněna','Vrátit',()=>{ const a=Object.assign({},tplAll()); if(prev) a[id]=prev; else delete a[id]; tplSet(a); redraw(); });
}
/* vestavěná šablona: zpět výchozí název a obsah (pořadí zůstane) */
function resetTemplate(id,redraw){
  if(!isBuiltin(id)) return;
  const all=Object.assign({},tplAll()), prev=all[id]; if(!prev) return;
  if(Number.isFinite(prev.o)) all[id]={o:prev.o}; else delete all[id];
  tplSet(all); redraw();
  toast('Vrácen výchozí obsah','Vrátit',()=>{ const a=Object.assign({},tplAll()); a[id]=prev; tplSet(a); redraw(); });
}
/* nové pořadí podle seznamu ID (u vestavěné se zapíše jen o) */
function orderTemplates(ids){
  if(ids.join()===tplList().map(t=>t.id).join()) return;
  const all=Object.assign({},tplAll());
  ids.forEach((id,i)=>{ if(all[id]||isBuiltin(id)) all[id]=Object.assign({},all[id]||{},{o:i+1}); });
  tplSet(all);
}

export { closeTemplate, delTemplate, dupTemplate, editTemplate, insertTpl, orderTemplates, resetTemplate, saveAsTemplate, tplHas, tplList, tplRowsHtml };
