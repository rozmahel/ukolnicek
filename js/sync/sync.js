/* Úkolníček – Synchronizace s Google Diskem: kontrola po otevření, nahrání, stažení, kolize, mráček */
import { $, $$, clone, esc, lsGet, plural } from '../core.js';
import { defaultSettings, S } from '../state.js';
import { applyNormalized, dataForSave, dataHash, hashData, hashOf, isDirty, META, normalizeImport, packData, stateForStorage, Store } from '../store.js';
import { fmtTime } from '../dates.js';
import { closeModal, openModal, openPop, toast } from '../ui.js';
import { openSettings } from '../views/settings.js';
import { keepFocus, mergeData, restoreFocus, syncDiff } from './merge.js';

/* ================= Google Drive sync (UI; transport in driveSync.js) ================= */
function cloudSvg(off){ return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.6 4.5 4.5 0 0 0 7 18.5Z"/>${off?'<path d="M4 4l16 16"/>':''}</svg>`; }
function deviceName(){ const u=navigator.userAgent; return /iPhone/.test(u)?'iPhone':/iPad/.test(u)?'iPad':/Android/.test(u)?'Android':/Mac/.test(u)?'Mac':/Windows/.test(u)?'Windows':'Prohlížeč'; }
const autoPull=()=>lsGet('uk-auto-pull',true)!==false;
/* je nejnovější soubor na Disku jiný a novější než ten, se kterým bylo toto zařízení naposledy synchronizované?
   (porovnává se čas vytvoření na serveru Googlu, ne hodiny zařízení) */
function newerOnDrive(top){ return !!(top&&top.name!==META.remoteName&&(!META.remoteAt||top.createdTime>META.remoteAt)); }
/* data z Disku ve stejném tvaru jako dataForSave() (i s výchozím nastavením) */
function packRemote(n){ return packData(n.pages,n.events,Object.assign(defaultSettings(),n.settings),n.subjects,n.semesters); }

const Sync={
  busy:false,remoteNewer:false,
  pending:null,      /* stažená novější verze, čeká na zavření dialogu */
  armed:false,       /* token vypršel: kontrola proběhne po prvním klepnutí do aplikace */
  connecting:null,checking:false,lastCheck:0,hiddenAt:0,snoozed:'',
  init(){
    DriveSync.preload(); updateSyncUI();
    this.check('start');
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden'){ this.hiddenAt=Date.now(); return; }
      updateSyncUI();
      const away=this.hiddenAt?Date.now()-this.hiddenAt:0;
      /* návrat do aplikace = nové otevření (na telefonu se aplikace většinou jen probouzí);
         s platným tokenem stačí lehký dotaz, okno přihlášení až po delší pauze */
      if(DriveSync.state()==='expired'){ if(away>=5*60000) this.check('resume'); }
      else if(Date.now()-this.lastCheck>30000) this.check('resume');
    });
    window.addEventListener('online',()=>{ updateSyncUI(); if(DriveSync.state()==='ok'&&Date.now()-this.lastCheck>30000) this.check('online'); });
    window.addEventListener('offline',updateSyncUI);
    document.addEventListener('click',e=>this.firstClick(e),true);
    setInterval(updateSyncUI,60000);
  },
  setBusy(b){ this.busy=b; updateSyncUI(); if(!b&&this.pending&&!S.modal) setTimeout(()=>this.resume(),0); },
  arm(){ if(autoPull()&&DriveSync.clientId()&&DriveSync.state()==='expired'&&!this.armed){ this.armed=true; updateSyncUI(); } },
  disarm(){ if(this.armed){ this.armed=false; updateSyncUI(); } },
  /* prohlížeč pustí okno přihlášení Googlu jen po akci uživatele, proto až první klepnutí */
  firstClick(e){
    if(!this.armed) return;
    if(!autoPull()||!DriveSync.clientId()||DriveSync.state()!=='expired'){ this.disarm(); return; }
    const t=e.target;
    if(t&&t.closest&&t.closest('[data-act^="sync"],#st-conn,#st-up,#st-down,#st-disc,#upd-btn')) return; /* ty se připojují samy */
    if(!navigator.onLine||this.busy||this.connecting) return;
    this.disarm();
    this.connect(true).then(ok=>{ if(ok) this.check('login'); });
  },
  /* přihlášení; jen jedno okno najednou */
  connect(quiet){
    if(this.connecting) return this.connecting;
    this.connecting=DriveSync.connect()
      .then(()=>{ this.armed=false; updateSyncUI(); return true; })
      .catch(e=>{
        updateSyncUI();
        const c=e&&e.code;
        toast(quiet&&(c==='popup_closed'||c==='access_denied')?'Přihlášení k Disku bylo zrušené, novější verze se nezkontrolovala. Klepni na žlutý mráček.':DriveSync.errText(e));
        return false;
      })
      .finally(()=>{ this.connecting=null; });
    return this.connecting;
  },
  async ensure(){
    if(!navigator.onLine){ toast('Jsi offline. Synchronizace půjde, až budeš připojený.'); return false; }
    if(!DriveSync.clientId()){ openSettings('drive'); return false; }
    if(DriveSync.state()==='ok'){ this.disarm(); return true; }
    return await this.connect(false);
  },
  async peek(){
    try{ const top=await DriveSync.latest({timeout:15000}); this.remoteNewer=newerOnDrive(top); }
    catch(e){ if(e&&e.code==='expired') updateSyncUI(); }
    updateSyncUI();
  },
  /* Kontrola po otevření aplikace:
     1) na Disku nic nového → nic se nestahuje
     2) na Disku novější verze, tady beze změn → stáhne se a tiše použije
     3) tady neuložené změny, Disk beze změny → nic (oranžová tečka zůstane)
     4) změny tady i na Disku → hned se zeptá */
  async check(why,force){
    if(this.checking||this.busy||this.pending||!DriveSync.clientId()) return;
    const st=DriveSync.state();
    if(st==='off') return;
    if(st==='expired'){ this.arm(); return; }
    if(!navigator.onLine){ if(force) toast('Jsi offline. Synchronizace půjde, až budeš připojený.'); return; }   /* offline: běží se z dat v zařízení */
    if((!autoPull()&&!force)||Store.broken) return this.peek();
    this.checking=true; this.lastCheck=Date.now();
    try{
      let top;
      try{ top=await DriveSync.latest({timeout:15000}); }   /* jeden lehký dotaz: název a čas nejnovějšího souboru */
      catch(e){ if(e&&e.code==='expired'){ updateSyncUI(); this.arm(); } return; }
      if(!newerOnDrive(top)){ this.remoteNewer=false; updateSyncUI(); return; }      /* 1 a 3 */
      this.remoteNewer=true; updateSyncUI();
      if(Store.t) await Store.flush();
      if(isDirty()&&this.snoozed===top.name) return;      /* kolize odložená tlačítkem „Rozhodnu později“ */
      let d;
      this.setBusy(true);
      try{ d=await DriveSync.download(top.id,{timeout:30000}); if(!d||typeof d.pages!=='object') throw {code:'bad_file'}; }
      catch(e){ if(e&&e.code==='expired') this.arm(); else if(e&&e.code==='bad_file') toast(DriveSync.errText(e)); return; }
      finally{ this.setBusy(false); }
      this.pending={top,d,n:normalizeImport(d)};
    }finally{ this.checking=false; }
    this.resume();
  },
  /* dokončení po stažení; když je otevřený dialog (rozepsaná hodina, nastavení…), počká se na jeho zavření */
  async resume(){
    const x=this.pending; if(!x||this.busy) return;
    if(S.modal){ updateSyncUI(); return; }             /* closeModal zavolá resume znovu */
    this.pending=null;
    if(!newerOnDrive(x.top)){ this.remoteNewer=false; updateSyncUI(); return; }   /* mezitím staženo ručně */
    if(Store.t) await Store.flush();
    if(S.modal){ this.pending=x; return; }
    x.rh=hashOf(x.n);
    if(dataHash()===x.rh){                              /* v obou místech stejná data */
      this.markSynced(x,x.rh); await Store.flush(); this.saveBase(x.n); updateSyncUI(); return;
    }
    if(isDirty()){                                      /* 4 – i když se začalo psát během stahování */
      if(this.snoozed===x.top.name){ updateSyncUI(); return; }
      return this.conflict(x);
    }
    return this.applyQuiet(x);                          /* 2 */
  },
  markSynced(x,hash,keepTimes){
    META.remoteAt=x.top.createdTime; META.remoteName=x.top.name; META.syncedHash=hash;
    if(!keepTimes) META.syncedAt=META.changedAt=Date.now();
    META.curHash=dataHash(); this.remoteNewer=false;
  },
  saveBase(n){ Local.saveBase(packRemote(n)).catch(()=>{}); },
  async applyQuiet(x){
    this.setBusy(true);
    let before;
    try{ before=stateForStorage(); await Local.addBackup(before,'Před automatickým stažením z Disku'); }
    catch(e){ this.setBusy(false); toast('Novější verze z Disku se nenačetla: nepodařilo se uložit místní zálohu.'); return; }
    if(Store.t) await Store.flush();
    if(isDirty()||S.modal){ this.setBusy(false); this.pending=x; return this.resume(); }   /* během zálohy se začalo psát / otevřel se dialog */
    const keep=keepFocus();
    applyNormalized(x.n); this.markSynced(x,dataHash()); META.lastDownload=Date.now();
    restoreFocus(keep);
    await Store.flush(); this.saveBase(x.n);
    this.setBusy(false);
    toast('Načtena novější verze z Disku · '+fmtTime(Date.parse(x.top.createdTime))+(x.d.device?' · '+x.d.device:''),'Vrátit',()=>this.undoQuiet(before));
  },
  /* „Vrátit“ po tichém stažení = ponechat svoji verzi (verze z Disku tam zůstává mezi zálohami) */
  async undoQuiet(before){
    if(this.busy) return;
    if(Store.t) await Store.flush();
    if(META.curHash!==META.syncedHash) await Local.addBackup(stateForStorage(),'Před vrácením automatického stažení').catch(()=>{});
    applyNormalized(normalizeImport(before));
    await Store.flush(); updateSyncUI();
    toast('Vráceno. Verze z Disku tam zůstala, tvoje se na Disk dostane tlačítkem ↑.');
  },
  async conflict(x){
    let base=null; try{ base=await Local.loadBase(); }catch(_){}
    if(S.modal){ this.pending=x; return; }
    if(Store.t) await Store.flush();
    this.snoozed=x.top.name;
    const L=dataForSave(), R=packRemote(x.n), df=syncDiff(L,R,base);
    const list=(a)=>{ const v=a.slice(0,4).map(esc).join(', '); return a.length>4?v+` a ${a.length-4} ${plural(a.length-4,'další','další','dalších')}`:v; };
    const rows=base
      ?[['Změněno tady',df.here],['Změněno na Disku',df.drive],['Změněno na obou místech',df.both]]
      :[['Liší se',df.differ]];
    const sum=rows.filter(r=>r[1].length).map(([k,a])=>`<div><span class="cf-k">${k}</span>${list(a)}</div>`).join('');
    const clean=!!base&&!df.copies;
    const bothTxt=(clean?'Spojí je. Změny se nepřekrývají, nic se nezdvojí.'
      :`Spojí je. ${df.copies?`${df.copies} ${plural(df.copies,'věc, která se liší, bude','věci, které se liší, budou','věcí, které se liší, bude')} dvakrát – tvoje jako kopie.`:''} Nic se neztratí.`)+' Předtím se uloží místní záloha.';
    const when=fmtTime(Date.parse(x.top.createdTime));
    const m=openModal('Změny tady i na Disku',`<div class="m-body">
      <p>Na Disku je novější verze z <b>${esc(when)}</b>${x.d.device?' ('+esc(x.d.device)+')':''} a v tomto zařízení máš změny, které na Disku nejsou${META.changedAt?` (poslední úprava ${esc(fmtTime(META.changedAt))})`:''}.</p>
      ${sum?`<div class="cf-sum">${sum}</div>`:''}
      <div class="cf-list">
        <button type="button" class="guide-link" data-cf="remote"><span class="gl-ic" aria-hidden="true">☁️</span><span><b>Použít verzi z Disku</b><small>Tvoje současná verze se předtím uloží do místních záloh.</small></span></button>
        <button type="button" class="guide-link" data-cf="local"><span class="gl-ic" aria-hidden="true">💻</span><span><b>Ponechat moji verzi</b><small>Verze z Disku tam zůstane mezi zálohami. Tvoje se na Disk dostane tlačítkem ↑.</small></span></button>
        <button type="button" class="guide-link ${clean?'rec':''}" data-cf="both"><span class="gl-ic" aria-hidden="true">⧉</span><span><b>Ponechat obě${clean?' <em>doporučeno</em>':''}</b><small>${esc(bothTxt)}</small></span></button>
      </div>
      <div class="m-actions"><span class="sp"></span><button type="button" class="btn" data-close>Rozhodnu později</button></div></div>`,'cf-m');
    m.addEventListener('click',e=>{ const b=e.target.closest('[data-cf]'); if(b) this.resolveConflict(b.dataset.cf,x,base); });
    updateSyncUI();
  },
  async resolveConflict(choice,x,base){
    closeModal();
    if(this.busy) return;
    this.setBusy(true);
    try{
      if(Store.t) await Store.flush();
      if(choice==='local'){
        this.markSynced(x,x.rh,true);                    /* Disk viděn, tady zůstává moje → oranžová tečka */
        await Store.flush(); this.saveBase(x.n);
        toast('Ponechána tvoje verze. Na Disk ji dostaneš tlačítkem ↑.','Nahrát',()=>this.upload());
        return;
      }
      await Local.addBackup(stateForStorage(),choice==='remote'?'Před stažením z Disku (kolize)':'Před spojením s verzí z Disku');
      const keep=keepFocus();
      if(choice==='remote'){
        applyNormalized(x.n); this.markSynced(x,dataHash()); META.lastDownload=Date.now();
        toast('Použita verze z Disku · '+fmtTime(Date.parse(x.top.createdTime))+'. Tvoje je v místních zálohách.');
      }else{
        const r=mergeData(dataForSave(),packRemote(x.n),base);
        applyNormalized(r.data); this.markSynced(x,x.rh,true); META.changedAt=META.lastDownload=Date.now();
        toast(r.copies?`Spojeno. ${r.copies} ${plural(r.copies,'položka je','položky jsou','položek je')} dvakrát (kopie – ${deviceName()}).`:'Spojeno.','Nahrát na Disk',()=>this.upload());
      }
      restoreFocus(keep);
      await Store.flush(); this.saveBase(x.n);
    }catch(e){ toast('Nepodařilo se uložit místní zálohu, nic se nezměnilo.'); }
    finally{ this.setBusy(false); }
  },
  async upload(force){
    if(this.busy) return;
    if(!await this.ensure()) return;
    this.setBusy(true);
    try{
      const files=await DriveSync.list(); const top=files[0];
      if(!force&&newerOnDrive(top)){ this.setBusy(false); return confirmNewerRemote(top); }
      await Store.flush();
      const sent=dataForSave(), sentHash=hashData(clone(sent));
      const f=await DriveSync.upload(Object.assign({app:'ukolnicek',version:2,savedAt:new Date().toISOString(),device:deviceName()},sent));
      META.remoteAt=f.createdTime||new Date().toISOString(); META.remoteName=f.name; META.syncedAt=META.changedAt; META.syncedHash=sentHash; META.lastUpload=Date.now(); this.remoteNewer=false;
      await Store.flush();
      Local.saveBase(sent).catch(()=>{});
      await DriveSync.rotate(10).catch(()=>0);
      toast('Nahráno na Disk');
    }catch(e){ toast(DriveSync.errText(e)); }
    finally{ this.setBusy(false); }
  },
  /* ↓ v levém panelu: podle volby v nastavení rovnou nejnovější verze, jinak výběr z posledních 10 */
  download(){ return lsGet('uk-dl-latest',false)?this.downloadLatest():this.openDownload(); },
  async downloadLatest(){
    if(this.busy) return;
    if(!await this.ensure()) return;
    this.setBusy(true); let files;
    try{ files=await DriveSync.list(); }catch(e){ this.setBusy(false); return toast(DriveSync.errText(e)); }
    this.setBusy(false);
    if(!files.length) return toast('Na Disku zatím nic není. Nejdřív nahraj data tlačítkem ↑.');
    const top=files[0], dirty=isDirty(), when=fmtTime(Date.parse(top.createdTime));
    if(top.name===META.remoteName&&!dirty){ this.remoteNewer=false; updateSyncUI(); return toast('Už máš nejnovější verzi z Disku ('+when+').'); }
    if(!dirty) return this.fetchVersion(top);
    const m=openModal('Stáhnout nejnovější verzi?',`<div class="m-body">
      <p class="warn">V tomto zařízení máš změny, které nejsou na Disku (poslední úprava ${esc(fmtTime(META.changedAt))}). Stažení verze z <b>${esc(when)}</b> je nahradí. Současný stav se předtím uloží do Nastavení → Místní zálohy.</p>
      <div class="m-actions"><button type="button" class="btn" id="dq-up">Nejdřív nahrát moje změny</button><span class="sp"></span><button type="button" class="btn" data-close>Zrušit</button><button type="button" class="btn pri" id="dq-go">Stáhnout a nahradit</button></div></div>`);
    $('#dq-up',m).addEventListener('click',()=>{ closeModal(); this.upload(); });
    $('#dq-go',m).addEventListener('click',()=>{ closeModal(); this.fetchVersion(top); });
  },
  async fetchVersion(f){
    this.setBusy(true);
    try{
      const d=await DriveSync.download(f.id);
      if(!d||typeof d.pages!=='object') throw {code:'bad_file'};
      await Store.flush();
      await Local.addBackup(stateForStorage(),'Před stažením z Disku');
      const n=normalizeImport(d);
      applyNormalized(n);
      META.remoteAt=f.createdTime; META.remoteName=f.name; META.changedAt=META.syncedAt=Date.now(); META.syncedHash=META.curHash=dataHash(); META.lastDownload=Date.now(); this.remoteNewer=false;
      await Store.flush();
      this.saveBase(n);
      toast('Staženo z Disku · verze '+fmtTime(Date.parse(f.createdTime)));
    }catch(err){ toast(DriveSync.errText(err)); }
    finally{ this.setBusy(false); }
  },
  async openDownload(){
    if(this.busy) return;
    if(!await this.ensure()) return;
    this.setBusy(true); let files;
    try{ files=await DriveSync.list(); }catch(e){ this.setBusy(false); return toast(DriveSync.errText(e)); }
    this.setBusy(false);
    if(!files.length) return toast('Na Disku zatím nic není. Nejdřív nahraj data tlačítkem ↑.');
    const dirty=isDirty();
    const m=openModal('Stáhnout z Disku',`<form class="m-body" id="dlf">
      ${dirty?`<p class="warn">V tomto zařízení máš změny, které nejsou na Disku (poslední úprava ${esc(fmtTime(META.changedAt))}). Stažení je nahradí. Současný stav se předtím uloží do Nastavení → Místní zálohy.</p>`:'<p class="note">Data v tomto zařízení se nahradí vybranou verzí. Současný stav se předtím uloží do místních záloh.</p>'}
      <div class="bk-list scroll">${files.map((f,i)=>`<label class="bk ${i===0?'on':''}"><span><input type="radio" name="dlv" value="${esc(f.id)}" ${i===0?'checked':''}> <b>${esc(fmtTime(Date.parse(f.createdTime)))}</b>${i===0?' · nejnovější':''}${f.name===META.remoteName?' · tvoje poslední synchronizace':''}</span><span class="note">${f.size?Math.max(1,Math.round(f.size/1024))+' kB':''}</span></label>`).join('')}</div>
      <div class="m-actions">${dirty?'<button type="button" class="btn" id="dl-up">Nejdřív nahrát moje změny</button>':''}<span class="sp"></span><button type="button" class="btn" data-close>Zrušit</button><button type="submit" class="btn pri">Stáhnout a nahradit</button></div>
    </form>`);
    $$('input[name=dlv]',m).forEach(r=>r.addEventListener('change',()=>$$('.bk',m).forEach(b=>b.classList.toggle('on',b.contains(r)&&r.checked))));
    const du=$('#dl-up',m); if(du) du.addEventListener('click',()=>{ closeModal(); this.upload(); });
    $('#dlf',m).addEventListener('submit',async e=>{
      e.preventDefault();
      const id=($('input[name=dlv]:checked',m)||{}).value; const f=files.find(x=>x.id===id); if(!f) return;
      closeModal(); this.fetchVersion(f);
    });
  }
};
function confirmNewerRemote(top){
  const m=openModal('Na Disku je novější verze',`<div class="m-body">
    <p>Na Disku je záloha z <b>${esc(fmtTime(Date.parse(top.createdTime)))}</b>, kterou toto zařízení ještě nevidělo. Nejspíš je z jiného zařízení.</p>
    <p class="note">Když přesto nahraješ, tvoje verze bude nejnovější a ta druhá zůstane mezi zálohami na Disku.</p>
    <div class="m-actions"><button type="button" class="btn" id="nr-down">Stáhnout verzi z Disku</button><span class="sp"></span><button type="button" class="btn" data-close>Zrušit</button><button type="button" class="btn pri" id="nr-up">Přesto nahrát</button></div></div>`);
  $('#nr-down',m).addEventListener('click',()=>{ closeModal(); Sync.openDownload(); });
  $('#nr-up',m).addEventListener('click',()=>{ closeModal(); Sync.upload(true); });
}
function updateSyncUI(){
  const st=DriveSync.state(), off=!navigator.onLine;
  const dirty=isDirty();
  const cls=Sync.busy?'cl-busy':st==='ok'?'cl-ok':st==='expired'?'cl-exp':'cl-off';
  const label=Sync.busy?'Synchronizuji…':off&&st!=='off'?'Offline':st==='ok'?(META.lastUpload||META.lastDownload?'Disk · '+fmtTime(Math.max(META.lastUpload,META.lastDownload)):'Disk připojen'):st==='expired'?'Připojit znovu':'Disk nepřipojen';
  const title=(st==='ok'?'Google Disk připojen':st==='expired'?(Sync.armed?'Přihlášení vypršelo – první klepnutí do aplikace ho obnoví a zkontroluje Disk':'Přihlášení vypršelo – klepni pro připojení'):'Google Disk není připojený')+(dirty?' · máš změny, které nejsou na Disku':'')+(Sync.remoteNewer?' · na Disku je novější verze':'');
  const btn=`<button class="cloud ${cls} ${dirty?'dirty':''}" data-act="sync-menu" title="${esc(title)}" aria-label="${esc(title)}">${cloudSvg(st==='off')}</button>`;
  const box=$('#sync-box');
  /* při psaní se volá po každém znaku: DOM se mění jen, když se má opravdu něco změnit */
  if(box) setHtml(box,`${btn}<button class="sync-lbl ${cls}" data-act="sync-menu" title="${esc(title)}">${esc(label)}${dirty?'<small>neuloženo na Disk</small>':''}</button>
    <button class="icon-btn sync-io" data-act="sync-up" title="Nahrát na Disk" aria-label="Nahrát na Disk" ${st==='off'||Sync.busy?'disabled':''}>↑</button>
    <button class="icon-btn sync-io ${Sync.remoteNewer?'dirty':''}" data-act="sync-down" title="${lsGet('uk-dl-latest',false)?'Stáhnout nejnovější verzi z Disku':'Stáhnout z Disku'}${Sync.remoteNewer?' (je tam novější verze)':''}" aria-label="Stáhnout z Disku" ${st==='off'||Sync.busy?'disabled':''}>↓</button>`);
  const tb=$('#tb-sync'); if(tb) setHtml(tb,btn);
}
function setHtml(el,h){ if(el._h!==h){ el.innerHTML=h; el._h=h; } }
function openSyncMenu(anchor){
  const st=DriveSync.state();
  if(st==='expired'&&!Sync.busy){ Sync.ensure().then(ok=>{ if(ok){ toast('Připojeno k Google Disku'); Sync.check('login'); } }); return; }
  if(st==='off'){ openSettings('drive'); return; }
  const dirty=isDirty();
  const h=`<div class="pop-h">Google Disk</div>
    <p class="note" style="padding:0 8px 6px">${META.lastUpload?'Naposledy nahráno '+esc(fmtTime(META.lastUpload))+'.':'Zatím nic nenahráno.'}${dirty?' Máš změny, které nejsou na Disku.':''}${Sync.remoteNewer?' Na Disku je novější verze.':''}</p>
    <button class="pop-item" data-v="up"><span class="pi-ic">↑</span>Nahrát na Disk</button>
    <button class="pop-item" data-v="down"><span class="pi-ic">↓</span>${lsGet('uk-dl-latest',false)?'Stáhnout nejnovější verzi':'Stáhnout z Disku…'}</button>
    ${lsGet('uk-dl-latest',false)?'<button class="pop-item" data-v="pick"><span class="pi-ic">☰</span>Vybrat starší verzi…</button>':''}
    ${dirty&&Sync.remoteNewer?'<button class="pop-item" data-v="merge"><span class="pi-ic">⧉</span>Porovnat s verzí na Disku…</button>':''}
    <div class="pop-sep"></div><button class="pop-item" data-v="set"><span class="pi-ic">⚙</span>Nastavení Disku</button>`;
  openPop(anchor,h,v=>{ if(v==='up') Sync.upload(); else if(v==='down') Sync.download(); else if(v==='pick') Sync.openDownload(); else if(v==='merge'){ Sync.snoozed=''; Sync.check('menu',true); } else openSettings('drive'); });
}

export { autoPull, cloudSvg, deviceName, openSyncMenu, Sync, updateSyncUI };
