/* Úkolníček – Synchronizace obrázků s Google Diskem
   - každý obrázek je na Disku samostatný soubor ukimg_<ID> v appDataFolder, text ho zná jen podle ID
   - nahrávají se jen obrázky, na které text odkazuje a na Disku nejsou; po přerušení se pokračuje dalším
   - stahují se jen obrázky, na které text odkazuje a v zařízení chybí (do té doby rámeček s názvem)
   - z Disku se maže jen obrázek, na který nahraný text neodkazuje a který na Disku byl už před
     poslední verzí textu, kterou toto zařízení vidělo (obrázek z jiného zařízení se tak nesmaže omylem)
   - seznam obrázků na Disku si zařízení pamatuje (uk-img-drive), vykřičník u mráčku jde spočítat bez dotazu */
import { $, $$, esc, lsGet, lsSet, plural } from '../core.js';
import { dataForSave, IMGURL } from '../store.js';
import { closeModal, openModal } from '../ui.js';

const withImgs=()=>lsGet('uk-img-sync',true)!==false;      /* šipky ↑/↓ přenáší i obrázky (jen toto zařízení) */
const BIG=5e6;                                               /* nad tolik se na mobilních datech nejdřív zeptá */
const RE=/"img":"([^"\\]+)"|data-img=\\"([^"\\]+)\\"/g;

/* ID obrázků, na které data odkazují (obrázkové bloky i obrázky v textu a tabulkách); staré „legacy“ nemají soubor */
function refsOf(d){
  const s=JSON.stringify(d), ids=new Set(); let m; RE.lastIndex=0;
  while((m=RE.exec(s))){ const id=m[1]||m[2]; if(id&&!id.startsWith('legacy')) ids.add(id); }
  return ids;
}
/* {ID: {f: id souboru na Disku, t: čas vytvoření na Disku, s: velikost}} podle poslední kontroly */
function driveMap(){ const v=lsGet('uk-img-drive',null); return v&&typeof v==='object'?v:{}; }
function saveMap(m){ lsSet('uk-img-drive',m); }

const ImgSync={
  up:[],miss:[],orphans:0,refs:new Set(),busy:false,prog:'',
  /* přepočet stavu z dat (volá Store.flush s daty, která právě ukládá) */
  refresh(d){
    const refs=refsOf(d||dataForSave()), map=driveMap();
    this.refs=refs;
    this.up=[...refs].filter(id=>IMGURL.has(id)&&!map[id]);
    this.miss=[...refs].filter(id=>!IMGURL.has(id));
    this.orphans=Object.keys(map).filter(id=>!refs.has(id)).length;
  },
  flag(){ return DriveSync.state()!=='off'&&(this.up.length||this.miss.length||this.orphans)>0; },
  summary(){
    const p=[];
    if(this.up.length) p.push(`${this.up.length} ${plural(this.up.length,'čeká','čekají','čeká')} na nahrání`);
    if(this.miss.length) p.push(`${this.miss.length} ${plural(this.miss.length,'chybí','chybí','chybí')} v tomto zařízení`);
    if(this.orphans) p.push(`${this.orphans} na Disku ${plural(this.orphans,'čeká','čekají','čeká')} na odstranění`);
    return p.join(', ');
  },
  async list(){
    const files=await DriveSync.listImages(), map={};
    files.forEach(f=>{ map[DriveSync.imgId(f)]={f:f.id,t:f.createdTime,s:+f.size||0}; });
    saveMap(map); return map;
  },
  /* nahraje chybějící obrázky; chyba nic nerozbije, zbytek se nahraje příště */
  async push(onProg){
    this.refresh(); if(!this.refs.size&&!Object.keys(driveMap()).length) return {done:0,left:0};   /* bez obrázků žádný dotaz navíc */
    const map=await this.list();
    const todo=[...this.refsNow()].filter(id=>IMGURL.has(id)&&!map[id]);
    let done=0, err=null;
    for(const id of todo){
      if(onProg) onProg(`Obrázky ${done+1}/${todo.length}…`);
      try{
        const rec=await Local.getImage(id); if(!rec||!rec.blob){ done++; continue; }
        const f=await DriveSync.uploadImage(id,rec.blob);
        map[id]={f:f.id,t:f.createdTime||new Date().toISOString(),s:+f.size||rec.size||0}; saveMap(map); done++;
      }catch(e){ err=e; break; }
    }
    this.refresh(); return {done,left:todo.length-done,err};
  },
  /* po nahrání textu: smaže obrázky, na které nahraný text neodkazuje (viz pravidlo nahoře) */
  async prune(sent,seenAt){
    if(!seenAt) return 0;
    const refs=refsOf(sent), map=driveMap(); let n=0;
    for(const [id,x] of Object.entries(map)){
      if(refs.has(id)||!x.t||x.t>=seenAt) continue;
      try{ await DriveSync.remove(x.f); delete map[id]; n++; }
      catch(e){ if(e&&e.code==='not_found'){ delete map[id]; } else break; }
    }
    saveMap(map); this.refresh(); return n;
  },
  refsNow(){ this.refresh(); return this.refs; },
  /* stáhne obrázky, které tu chybí. auto = po automatickém stažení textu (na mobilních datech se velké neptá, jen počká) */
  async pull(opt){
    opt=opt||{};
    this.refresh(); if(!this.miss.length) return {done:0,left:0};
    const map=await this.list();
    const avail=this.miss.filter(id=>map[id]), absent=this.miss.length-avail.length;
    if(!avail.length) return {done:0,left:0,absent};
    const size=avail.reduce((a,id)=>a+(map[id].s||0),0), c=navigator.connection;
    if(c&&(c.type==='cellular'||c.saveData)&&size>BIG){
      if(opt.auto) return {done:0,left:avail.length,absent,waiting:true};
      if(!await askBig(avail.length,size)) return {done:0,left:avail.length,absent,cancelled:true};
    }
    let done=0, err=null;
    for(const id of avail){
      if(opt.onProg) opt.onProg(`Obrázky ${done+1}/${avail.length}…`);
      try{
        const blob=await DriveSync.downloadImage(map[id].f);
        await Local.putImageRec({id,blob,name:'',type:blob.type,size:blob.size,created:Date.now()});
        IMGURL.set(id,URL.createObjectURL(blob)); showImage(id); done++;
      }catch(e){ err=e; break; }
    }
    this.refresh(); return {done,left:avail.length-done,absent,err};
  }
};
/* stažený obrázek se ukáže hned, bez překreslení stránky (kurzor zůstane, kde je) */
function showImage(id){
  const url=IMGURL.get(id); if(!url) return;
  $$('img[data-img]').forEach(im=>{ if(im.getAttribute('data-img')===id){ im.src=url; im.classList.remove('missing','broken'); } });
  $$('img.bimg[data-bimg]').forEach(im=>{ if(im.getAttribute('data-bimg')===id){ im.src=url; im.classList.remove('missing'); } });
}
function mb(n){ return (n/1e6).toFixed(n<1e7?1:0).replace('.',',')+' MB'; }
function askBig(n,size){
  return new Promise(res=>{
    let done=false; const fin=v=>{ if(!done){ done=true; res(v); } };
    const m=openModal('Stáhnout obrázky přes mobilní data?',`<div class="m-body">
      <p>Chybí tu ${n} ${plural(n,'obrázek','obrázky','obrázků')}, dohromady asi <b>${esc(mb(size))}</b>. Jsi na mobilních datech.</p>
      <p class="note">Bez stažení se ukážou jako rámeček s názvem. Stáhnout jdou i později šipkou ↓ nebo v Nastavení → Google Disk.</p>
      <div class="m-actions"><span class="sp"></span><button type="button" class="btn" id="ib-no">Později</button><button type="button" class="btn pri" id="ib-go">Stáhnout</button></div></div>`);
    $('#ib-no',m).addEventListener('click',()=>{ fin(false); closeModal(); });
    $('#ib-go',m).addEventListener('click',()=>{ fin(true); closeModal(); });
    const obs=new MutationObserver(()=>{ if(!document.contains(m)){ obs.disconnect(); fin(false); } });
    obs.observe(document.body,{childList:true});
  });
}
/* krátká věta do oznámení po ↑/↓ */
function imgNote(r,dir){
  if(!r) return '';
  const p=[];
  if(r.done) p.push(`${r.done} ${dir==='up'?plural(r.done,'obrázek nahrán','obrázky nahrány','obrázků nahráno'):plural(r.done,'obrázek stažen','obrázky staženy','obrázků staženo')}`);
  if(r.err) p.push(r.left?`${r.left} ${plural(r.left,'obrázek se nepřenesl','obrázky se nepřenesly','obrázků se nepřeneslo')}, stačí to zkusit znovu`:'obrázky se nepodařilo zkontrolovat, stačí to zkusit znovu');
  else if(r.waiting) p.push(`${r.left} ${plural(r.left,'obrázek čeká','obrázky čekají','obrázků čeká')} na Wi-Fi nebo ↓`);
  if(r.absent) p.push(`${r.absent} ${plural(r.absent,'obrázek není','obrázky nejsou','obrázků není')} na Disku, ${r.absent===1?'nahraje se':'nahrají se'} z druhého zařízení`);
  return p.length?' · '+p.join(' · '):'';
}

export { imgNote, ImgSync, withImgs };
