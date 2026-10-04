/* Úkolníček – Nastavení, motiv a velikost písma, návod a novinky */
import { $, $$, downloadFile, esc, lsGet, lsSet, plural } from '../core.js';
import { defaultSettings, S } from '../state.js';
import { applySkin, skinOf, SKINS, syncThemeColor } from '../theme.js';
import { LOCK } from '../lock.js';
import { applyData, dataForSave, META, normalizeImport, saveSettings, stateForStorage, Store } from '../store.js';
import { HIST } from '../editor/history.js';
import { fmtTime, mondayOf, parseD, ymd } from '../dates.js';
import { clearSchoolData, hodin, isSchool, schoolCounts } from '../school.js';
import { renderSidebar } from '../sidebar.js';
import { renderMain } from '../router.js';
import { closeModal, openModal, toast } from '../ui.js';
import { HOUR_SCALES } from './schedule.js';
import { autoPull, cloudSvg, Sync, updateSyncUI } from '../sync/sync.js';
import { placeFrame } from '../editor/images.js';

/* ================= settings ================= */
const APP_VERSION='3.1.1';
/* ---- vzhled jen pro toto zařízení (do zálohy na Disk nejde) ---- */
const FS_STEPS=[1,1.15,1.3,1.45,1.6];
function applyTheme(){
  const t=lsGet('uk-theme','auto'), root=document.documentElement;
  if(t==='light'||t==='dark') root.setAttribute('data-theme',t); else root.removeAttribute('data-theme');
  syncThemeColor();
}
function applyFontScale(){
  const f=+lsGet('uk-fs',1); const v=FS_STEPS.includes(f)?f:1;
  if(v===1) document.documentElement.style.removeProperty('--fs'); else document.documentElement.style.setProperty('--fs',v);
  requestAnimationFrame(()=>placeFrame());
}

/* ---- nastavení po kategoriích ---- */
const SET_TABS=[['general','Obecné','⚙️'],['look','Vzhled','🎨'],['school','Škola','🎓'],['sync','Google Disk','☁️'],['backup','Zálohy','🗂️'],['help','Návod a novinky','📖']];
async function openSettings(focus){
  const st=S.settings, cid=DriveSync.clientId(), ds=DriveSync.state();
  let backups=[]; try{ backups=await Local.listBackups(); }catch(_){}
  const tab=focus==='drive'?'sync':(SET_TABS.some(t=>t[0]===S.setTab)?S.setTab:'general');
  const theme=lsGet('uk-theme','auto'), fs=+lsGet('uk-fs',1), cnt=schoolCounts(), skin=skinOf();
  const seg=(id,opts,cur)=>`<div class="seg" id="${id}">${opts.map(([v,l])=>`<button type="button" class="${String(v)===String(cur)?'on':''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const m=openModal('Nastavení',`<div class="set">
    <nav class="set-nav" role="tablist">${SET_TABS.map(([k,l,ic])=>`<button type="button" role="tab" data-tab="${k}" class="${k===tab?'on':''}"><span aria-hidden="true">${ic}</span>${l}</button>`).join('')}</nav>
    <form class="set-body" id="stf" novalidate>

    <section class="set-pane" data-pane="general">
      <div class="fld"><label for="st-name">Název</label><input id="st-name" value="${esc(st.name)}" placeholder="Úkolníček"><p class="note">Ukazuje se nahoře v levém panelu.</p></div>
      <h3 class="set-h">Levý panel</h3>
      <label class="chk"><input type="checkbox" id="st-mc" ${st.miniCal?'checked':''}> Mini kalendář pod číslem týdne</label>
      <label class="chk sub"><input type="checkbox" id="st-mcw" ${st.miniCalWeeks!==false?'checked':''} ${st.miniCal?'':'disabled'}> V kalendáři ukazovat čísla týdnů v roce</label>
      <h3 class="set-h">Poznámky</h3>
      <label class="chk"><input type="checkbox" id="st-hid" ${st.showHidden!==false?'checked':''}> U sbaleného nadpisu ukazovat, kolik bloků je skrytých</label>
    </section>

    <section class="set-pane" data-pane="look">
      <div class="fld"><span class="lbl" id="st-skin-l">Barevný motiv</span>
        <div class="skins" id="st-skin" role="group" aria-labelledby="st-skin-l">${SKINS.map(([id,nm])=>`<button type="button" class="skin ${id===skin?'on':''}" data-v="${id}" aria-pressed="${id===skin}"><span class="skin-sw" data-sk="${id}" aria-hidden="true"><b>Aa</b><i></i><i></i><i></i></span><span class="skin-nm">${nm}</span></button>`).join('')}</div>
        <p class="note">Mění barvy a písmo. Synchronizuje se přes Disk, takže ho uvidíš na všech zařízeních.</p></div>
      <div class="fld"><span class="lbl">Světlý nebo tmavý režim</span>${seg('st-theme',[['auto','Podle zařízení'],['light','☀︎ Světlý'],['dark','☾ Tmavý']],theme)}</div>
      <div class="fld"><span class="lbl">Velikost textu</span>${seg('st-fs',FS_STEPS.map(v=>[v,Math.round(v*100)+' %']),FS_STEPS.includes(fs)?fs:1)}
        <p class="note">Režim a velikost textu platí jen pro toto zařízení a nenahrávají se na Disk. Každý motiv má světlou i tmavou variantu.</p></div>
    </section>

    <section class="set-pane" data-pane="school">
      <label class="chk"><input type="checkbox" id="st-school" ${isSchool()?'checked':''}> <b>Školní režim</b></label>
      <p class="note" style="margin-top:-8px;padding-left:26px">Přidá Rozvrh, Index (předměty, kredity, body a známky), týden výuky a bloky <b>/předmět</b> v poznámkách. Vypnutím se nic nesmaže, jen se to schová.</p>
      <div class="set-school" id="st-school-box" ${isSchool()?'':'hidden'}>
        <label class="chk"><input type="checkbox" id="st-ix" ${S.settings.noIndex===true?'':'checked'}> Zobrazovat Index</label>
        <p class="note" style="margin-top:-8px;padding-left:26px">Předměty, kredity, body a známky. Bez Indexu zůstane rozvrh s vlastními názvy hodin, výběr předmětu a bloky /předmět se nenabízejí. Vypnutím se nic nesmaže.</p>
        <div class="fld"><label for="st-start">Začátek výuky (pondělí 1. týdne)</label><input type="date" id="st-start" value="${esc(st.semesterStart)}"><p class="note">Podle něj se počítá číslo týdne a lichý/sudý týden.</p></div>
        <h3 class="set-h">Rozvrh</h3>
        <div class="grid2"><div class="fld"><label for="st-h0">Od (hodina)</label><select id="st-h0">${Array.from({length:14},(_,i)=>i+5).map(h=>`<option ${+st.dayStart===h?'selected':''}>${h}</option>`).join('')}</select></div><div class="fld"><label for="st-h1">Do (hodina)</label><select id="st-h1">${Array.from({length:12},(_,i)=>i+13).map(h=>`<option ${+st.dayEnd===h?'selected':''}>${h}</option>`).join('')}</select></div></div>
        <div class="fld"><label for="st-hs">Výška hodiny</label><select id="st-hs">${HOUR_SCALES.map(v=>`<option value="${v}" ${(+st.hourScale||1)===v?'selected':''}>${String(v).replace('.',',')}×</option>`).join('')}</select><p class="note">Vyšší políčka = u krátkých hodin se vejde víc textu. Celé informace ukáže najetí myší na hodinu.</p></div>
        <label class="chk"><input type="checkbox" id="st-we" ${st.showWeekend?'checked':''}> Zobrazovat i víkend</label>
      </div>
      <div class="set-sep lk-hide"></div>
      <div class="fld lk-hide"><span class="lbl">Školní data</span>
        <div class="m-actions"><button type="button" class="btn danger" id="st-clear" ${cnt.subj+cnt.sem+cnt.ev?'':'disabled'}>Smazat školní data…</button><span class="note">${cnt.subj+cnt.sem+cnt.ev?`${cnt.subj} ${plural(cnt.subj,'předmět','předměty','předmětů')}, ${cnt.sem} ${plural(cnt.sem,'semestr','semestry','semestrů')}, ${hodin(cnt.ev)} v rozvrhu`:'Žádná školní data tu nejsou.'}</span></div>
        <p class="note">Smaže předměty a semestry v Indexu a hodiny v rozvrhu. Poznámky, úkoly a nastavení zůstanou, bloky /předmět se změní na obyčejné nadpisy.</p></div>
    </section>

    <section class="set-pane" data-pane="sync">
      <div class="fld" id="st-drive"><span class="lbl">Připojení</span>
        <div class="drive-state ${ds==='ok'?'cl-ok':ds==='expired'?'cl-exp':'cl-off'}">${cloudSvg(ds==='off')}<span>${ds==='ok'?`Připojeno. ${META.lastUpload?'Naposledy nahráno '+fmtTime(META.lastUpload)+'.':'Zatím nic nenahráno.'}`:ds==='expired'?'Přihlášení vypršelo. Připoj se znovu.':'Nepřipojeno.'}</span></div>
        <label for="st-cid" class="note">OAuth Client ID (typ „Webová aplikace“) z Google Cloud. Ukládá se jen v tomto prohlížeči.</label>
        <input id="st-cid" value="${esc(cid)}" placeholder="123456789-abc….apps.googleusercontent.com" autocomplete="off" spellcheck="false">
        <label for="st-acc" class="note">Účet Google (nepovinné). Když ho vyplníš, Google při přihlášení nenabízí výběr účtu. Platí jen pro toto zařízení.</label>
        <input id="st-acc" type="email" value="${esc(DriveSync.account())}" placeholder="tvuj.ucet@gmail.com" autocomplete="email" spellcheck="false">
        <div class="m-actions">
          ${ds==='ok'?`<button type="button" class="btn" id="st-up">↑ Nahrát na Disk</button><button type="button" class="btn" id="st-down">↓ Stáhnout z Disku…</button><span class="sp"></span><button type="button" class="btn danger" id="st-disc">Odpojit</button>`
            :`<button type="button" class="btn pri" id="st-conn">${ds==='expired'?'Připojit znovu':'Přihlásit k Disku'}</button>`}
        </div>
        <p class="note">↑ uloží aktuální stav jako novou zálohu (drží se posledních 10), ↓ nahradí data v tomto zařízení vybranou verzí. Obrázky se nezálohují, na jiném zařízení se ukážou jako rámeček s názvem.</p>
        <h3 class="set-h">Stahování z Disku</h3>
        <label class="chk"><input type="checkbox" id="st-auto" ${autoPull()?'checked':''}> Po otevření aplikace stáhnout novější verzi z Disku</label>
        <p class="note" style="margin-top:-8px;padding-left:26px">Stáhne se sama, jen když tady nemáš změny, které na Disku nejsou. Když se změnilo obojí, Úkolníček se zeptá. Před každým stažením se uloží místní záloha. Platí jen pro toto zařízení.</p>
        <label class="chk"><input type="checkbox" id="st-dll" ${lsGet('uk-dl-latest',false)?'checked':''}> Šipka ↓ stáhne rovnou nejnovější verzi (bez výběru z 10)</label>
        <p class="note" style="margin-top:-8px;padding-left:26px">Starší verzi pak vybereš po kliknutí na mráček → „Vybrat starší verzi…“. Platí jen pro toto zařízení.</p>
      </div>
    </section>

    <section class="set-pane" data-pane="backup">
      <div class="fld"><span class="lbl">Soubor se zálohou</span>
        <div class="m-actions"><button type="button" class="btn" id="st-exp">Exportovat do souboru</button><label class="btn" for="st-imp" style="cursor:pointer">Importovat ze souboru…</label><input type="file" id="st-imp" accept=".json,application/json" hidden></div>
        <p class="note">Import přidá stránky a události ze souboru (i ze zálohy z Claude verze). Stejné stránky přepíše.</p></div>
      <div class="set-sep"></div>
      <div class="fld"><span class="lbl">Místní zálohy</span>
        ${backups.length?`<div class="bk-list scroll">${backups.map(b=>`<div class="bk"><span><b>${esc(fmtTime(b.id))}</b> · ${esc(b.label||'Záloha')}</span><button type="button" class="btn" data-bk="${b.id}">Obnovit</button></div>`).join('')}</div>`:'<p class="note">Zatím žádné. Vytvoří se samy před každým stažením z Disku (i automatickým) nebo obnovením.</p>'}
      </div>
    </section>

    <section class="set-pane" data-pane="help">
      <button type="button" class="guide-link" data-guide="navod"><span class="gl-ic" aria-hidden="true">📖</span><span><b>Návod</b><small>Základní funkce Úkolníčku v kostce</small></span><span class="gl-arr" aria-hidden="true">›</span></button>
      <button type="button" class="guide-link" data-guide="novinky"><span class="gl-ic" aria-hidden="true">✨</span><span><b>Novinky</b><small>Co přibylo v posledních verzích</small></span><span class="gl-arr" aria-hidden="true">›</span></button>
    </section>
    <p class="set-foot">Úkolníček ${APP_VERSION} · <a href="#" class="set-news" id="st-news">co je nového</a></p>
    </form></div>`,'set-m');

  /* přepínání kategorií */
  const showTab=k=>{ S.setTab=k; $$('.set-nav [data-tab]',m).forEach(b=>{ b.classList.toggle('on',b.dataset.tab===k); b.setAttribute('aria-selected',String(b.dataset.tab===k)); }); $$('.set-pane',m).forEach(p=>p.hidden=p.dataset.pane!==k); };
  showTab(tab);
  $('.set-nav',m).addEventListener('click',e=>{ const b=e.target.closest('[data-tab]'); if(b) showTab(b.dataset.tab); });
  $('#stf',m).addEventListener('submit',e=>e.preventDefault());

  /* obecné a vzhled se ukládají hned při změně */
  const commit=()=>{
    Object.assign(S.settings,{name:$('#st-name',m).value.trim()||'Úkolníček',semesterStart:$('#st-start',m).value,dayStart:+$('#st-h0',m).value,dayEnd:+$('#st-h1',m).value,showWeekend:$('#st-we',m).checked,miniCal:$('#st-mc',m).checked,miniCalWeeks:$('#st-mcw',m).checked,showHidden:$('#st-hid',m).checked,hourScale:+$('#st-hs',m).value});
    if(S.settings.semesterStart){ const d=parseD(S.settings.semesterStart); if(d.getDay()!==1){ S.settings.semesterStart=ymd(mondayOf(d)); $('#st-start',m).value=S.settings.semesterStart; } }
    $('#st-mcw',m).disabled=!S.settings.miniCal;
    saveSettings(); renderSidebar(); renderMain();
  };
  ['#st-name','#st-start','#st-h0','#st-h1','#st-hs','#st-we','#st-mc','#st-mcw','#st-hid'].forEach(sel=>$(sel,m).addEventListener('change',commit));
  /* školní režim: v datech je jen když je zapnutý; přepínač Indexu z verze 2.6 se při změně odstraní */
  $('#st-school',m).addEventListener('change',e=>{
    if(e.target.checked) S.settings.school=true; else delete S.settings.school;
    delete S.settings.index;
    $('#st-school-box',m).hidden=!e.target.checked;
    saveSettings(); renderSidebar(); renderMain();
  });
  /* Index: v datech jen noIndex=true, když je skrytý */
  $('#st-ix',m).addEventListener('change',e=>{
    if(e.target.checked) delete S.settings.noIndex; else S.settings.noIndex=true;
    saveSettings(); renderSidebar(); renderMain();
  });
  $('#st-clear',m).addEventListener('click',()=>{ if(!LOCK) confirmClearSchool(); });
  $('#st-skin',m).addEventListener('click',e=>{
    const b=e.target.closest('[data-v]'); if(!b) return;
    const v=b.dataset.v;
    if(skinOf()!==v){ if(v==='default') delete S.settings.theme; else S.settings.theme=v; saveSettings(); applySkin(); }
    $$('#st-skin .skin',m).forEach(x=>{ x.classList.toggle('on',x===b); x.setAttribute('aria-pressed',String(x===b)); });
  });
  $('#st-theme',m).addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(!b) return; lsSet('uk-theme',b.dataset.v); applyTheme(); $$('#st-theme button',m).forEach(x=>x.classList.toggle('on',x===b)); });
  $('#st-fs',m).addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(!b) return; lsSet('uk-fs',+b.dataset.v); applyFontScale(); $$('#st-fs button',m).forEach(x=>x.classList.toggle('on',x===b)); });
  $$('[data-guide]',m).forEach(b=>b.addEventListener('click',()=>openGuide(b.dataset.guide)));

  const saveCid=()=>{ const v=$('#st-cid',m).value.trim(); if(v!==DriveSync.clientId()){ DriveSync.setClientId(v); DriveSync.preload(); updateSyncUI(); } };
  $('#st-cid',m).addEventListener('change',saveCid);
  $('#st-acc',m).addEventListener('change',e=>{ DriveSync.setAccount(e.target.value); });
  $('#st-dll',m).addEventListener('change',e=>{ lsSet('uk-dl-latest',e.target.checked); updateSyncUI(); });
  $('#st-auto',m).addEventListener('change',e=>{ lsSet('uk-auto-pull',e.target.checked); if(e.target.checked){ Sync.lastCheck=0; Sync.check('setting'); } else Sync.disarm(); });
  $('#st-news',m).addEventListener('click',e=>{ e.preventDefault(); openGuide('novinky'); });
  const conn=$('#st-conn',m); if(conn) conn.addEventListener('click',async()=>{
    saveCid(); DriveSync.setAccount($('#st-acc',m).value);
    if(!DriveSync.clientId()){ toast('Nejdřív vlož Client ID.'); $('#st-cid',m).focus(); return; }
    if(await Sync.ensure()){ toast('Připojeno k Google Disku'); closeModal(); await openSettings('drive'); Sync.check('login'); }
  });
  const up=$('#st-up',m); if(up) up.addEventListener('click',()=>{ closeModal(); Sync.upload(); });
  const down=$('#st-down',m); if(down) down.addEventListener('click',()=>{ closeModal(); Sync.openDownload(); });
  const disc=$('#st-disc',m); if(disc) disc.addEventListener('click',()=>{ DriveSync.disconnect(); updateSyncUI(); closeModal(); toast('Odpojeno od Google Disku. Data v zařízení zůstala.'); });
  $('#st-exp',m).addEventListener('click',()=>{
    downloadFile(`ukolnicek-zaloha-${ymd(new Date())}.json`,JSON.stringify(Object.assign({app:'ukolnicek',version:2,exported:new Date().toISOString()},dataForSave()),null,1));
  });
  $('#st-imp',m).addEventListener('change',e=>{
    const f=e.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=async()=>{
      try{
        const d=JSON.parse(rd.result); if(!d||typeof d.pages!=='object') throw 0;
        await Local.addBackup(stateForStorage(),'Před importem ze souboru');
        const n=normalizeImport(d);
        Object.assign(S.pages,n.pages); Object.assign(S.events,n.events); Object.assign(S.subjects,n.subjects); Object.assign(S.semesters,n.semesters);
        if(d.settings){ S.settings=Object.assign(defaultSettings(),n.settings); applySkin(); }
        HIST.clear(); Store.queue();
        closeModal(); renderSidebar(); renderMain(); const np=Object.keys(n.pages).length, ne=Object.keys(n.events).length; toast(`Importováno: ${np} ${np===1?'stránka':np<5&&np>0?'stránky':'stránek'}, ${ne} ${ne===1?'událost':ne<5&&ne>0?'události':'událostí'}`);
      }catch(_){ toast('Soubor se nepodařilo načíst. Vyber zálohu exportovanou z Úkolníčku.'); }
    };
    rd.readAsText(f);
  });
  $$('[data-bk]',m).forEach(b=>b.addEventListener('click',async()=>{
    const bk=await Local.getBackup(+b.dataset.bk); if(!bk) return;
    await Local.addBackup(stateForStorage(),'Před obnovením místní zálohy');
    applyData(bk.state); Store.queue(); closeModal(); toast('Záloha z '+fmtTime(bk.id)+' obnovena');
  }));
  if(focus==='drive'&&!DriveSync.clientId()) setTimeout(()=>$('#st-cid',m).focus(),30);
}

/* potvrzení smazání školních dat (před smazáním se uloží místní záloha, v oznámení jde vrátit) */
function confirmClearSchool(){
  const c=schoolCounts(), parts=[c.subj&&`${c.subj} ${plural(c.subj,'předmět','předměty','předmětů')}`,c.sem&&`${c.sem} ${plural(c.sem,'semestr','semestry','semestrů')}`,c.ev&&`${hodin(c.ev)} v rozvrhu`].filter(Boolean);
  const m=openModal('Smazat školní data?',`<div class="m-body">
    <p>Smaže se ${parts.join(', ').replace(/, ([^,]*)$/,' a $1')}.</p>
    <p class="note">Poznámky, úkoly a nastavení zůstanou.${c.blk?` ${c.blk} ${plural(c.blk,'blok /předmět se změní','bloky /předmět se změní','bloků /předmět se změní')} na obyčejný nadpis H1 s názvem předmětu.`:''} Před smazáním se uloží místní záloha (Nastavení → Zálohy → Místní zálohy).</p>
    <div class="m-actions"><span class="sp"></span><button type="button" class="btn" id="cs-no">Zrušit</button><button type="button" class="btn pri danger-pri" id="cs-yes">Smazat školní data</button></div></div>`);
  $('#cs-no',m).addEventListener('click',()=>{ closeModal(); openSettings(); });
  $('#cs-yes',m).addEventListener('click',async()=>{
    closeModal();
    const undo=await clearSchoolData();
    toast('Školní data smazána. Poznámky zůstaly.','Vrátit',undo);
  });
}

/* ================= návod a novinky (obsah je v souboru navod.html) ================= */
let GUIDE=null;
async function loadGuide(){
  if(GUIDE) return GUIDE;
  const res=await fetch('navod.html',{cache:'no-cache'}).catch(()=>null) || await caches.match('navod.html').catch(()=>null);
  if(!res||!res.ok) throw new Error('navod');
  const doc=new DOMParser().parseFromString(await res.text(),'text/html');
  const secs=$$('#navod > section[data-tab]',doc).map(sc=>({k:sc.dataset.tab,title:sc.dataset.title||sc.dataset.tab,html:sc.innerHTML}));
  if(!secs.length) throw new Error('navod');
  GUIDE=secs; return secs;
}
async function openGuide(tab){
  const m=openModal('Návod a novinky','<div class="m-body guide"><div class="loading">Načítám…</div></div>','guide-m');
  let secs; try{ secs=await loadGuide(); }catch(_){ $('.guide',m).innerHTML='<p class="note">Návod se nepodařilo načíst. Zkus to znovu, až budeš online.</p>'; return; }
  if(S.modal!==m.parentElement) return;
  const k0=secs.some(s=>s.k===tab)?tab:secs[0].k;
  $('.guide',m).innerHTML=`<div class="g-tabs" role="tablist">${secs.map(s=>`<button type="button" role="tab" data-k="${esc(s.k)}">${esc(s.title)}</button>`).join('')}</div>${secs.map(s=>`<div class="g-pane" data-k="${esc(s.k)}">${s.html}</div>`).join('')}`;
  const show=k=>{ $$('.g-tabs button',m).forEach(b=>{ b.classList.toggle('on',b.dataset.k===k); b.setAttribute('aria-selected',String(b.dataset.k===k)); }); $$('.g-pane',m).forEach(p=>p.hidden=p.dataset.k!==k); $('.guide',m).scrollTop=0; };
  show(k0);
  $('.g-tabs',m).addEventListener('click',e=>{ const b=e.target.closest('[data-k]'); if(b) show(b.dataset.k); });
}

/* posluchače a nastavení při startu (volá main.js ve stejném pořadí jako dřív) */
export function initSettings(){
  try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme); }catch(_){}
}

export { applyFontScale, applyTheme, openSettings };
