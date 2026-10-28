/* Úkolníček – Základní pomůcky (DOM, text, localStorage, plural) a konstanty (barvy, dny, typy bloků, ikony) */

/* ================= utilities ================= */

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const rid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const pad=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
/* text bez HTML; <template> nic nenačítá ani nespouští (bezpečné i pro importovaná data) */
const plain=h=>{ if(!h) return ''; if(h.indexOf('<')<0&&h.indexOf('&')<0) return h; const t=document.createElement('template'); t.innerHTML=h; return t.content.textContent||''; };
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};

const COLORS=['purple','pink','red','orange','yellow','green','blue','gray'];
const COLOR_CZ={purple:'Fialová',pink:'Růžová',red:'Červená',orange:'Oranžová',yellow:'Žlutá',green:'Zelená',blue:'Modrá',gray:'Šedá'};
const DAYS=['Po','Út','St','Čt','Pá','So','Ne'];
const DAYS_FULL=['pondělí','úterý','středa','čtvrtek','pátek','sobota','neděle'];
const MONTHS=['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];
const TYPES=['Přednáška','Cvičení','Laboratoř','Zkouška','Jiné'];
const TYPE_SHORT={'Přednáška':'Přednáška','Cvičení':'Cvičení','Laboratoř':'Lab','Zkouška':'Zkouška','Jiné':''};
const CALLOUT_IC=['💡','📌','⚠️','🗓️','✅','❗','📎','🔴'];
/* kontrola pravopisu (od 4.16.0): jen v zařízení, výchozí zapnuto */
const spellOn=()=>lsGet('uk-spell',true)!==false;
const TEXT_TYPES=['p','h1','h2','h3','bullet','num','todo','quote','callout','code'];
const LIST_TYPES=['bullet','num','todo'];
/* jedna sada čárových ikon pro ovládací prvky (od 4.19.0): třída .ic, tloušťka čáry --ic-w v base.css, .f = vyplněná tečka */
const IC={
  plus:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  minus:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
  x:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  more:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle class="f" cx="5.5" cy="12" r="1.6"/><circle class="f" cx="12" cy="12" r="1.6"/><circle class="f" cx="18.5" cy="12" r="1.6"/></svg>',
  moreV:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle class="f" cx="12" cy="5.5" r="1.6"/><circle class="f" cx="12" cy="12" r="1.6"/><circle class="f" cx="12" cy="18.5" r="1.6"/></svg>',
  grip:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle class="f" cx="9" cy="6" r="1.5"/><circle class="f" cx="15" cy="6" r="1.5"/><circle class="f" cx="9" cy="12" r="1.5"/><circle class="f" cx="15" cy="12" r="1.5"/><circle class="f" cx="9" cy="18" r="1.5"/><circle class="f" cx="15" cy="18" r="1.5"/></svg>',
  menu:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  chevL:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg>',
  chevR:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>',
  chevD:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9.5 6 6 6-6"/></svg>',
  up:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  left:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  right:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  restore:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4L4.5 9"/><path d="M4.5 4.5V9H9"/></svg>',
  copy:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/></svg>',
  edit:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5l1-4L16 5a2.1 2.1 0 0 1 3 3L8.5 18.5z"/><path d="M14 7l3 3"/></svg>',
  swap:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/></svg>',
  resize:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  foldTo:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  splitR:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15M15 9h2.5M15 12h2.5"/></svg>',
  splitL:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15M6.5 9H9M6.5 12H9"/></svg>',
  toTop:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14M19 12H9M13 8l-4 4 4 4"/></svg>',
  archive:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4.5" rx="1.2"/><path d="M4.8 8.5v9.5a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2V8.5M10 12.5h4"/></svg>',
  link:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  spark:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c.6 4.4 3.1 6.9 7.5 7.5-4.4.6-6.9 3.1-7.5 7.5-.6-4.4-3.1-6.9-7.5-7.5 4.4-.6 6.9-3.1 7.5-7.5z"/></svg>',
  subject:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11.2v4.6c1.5 1.4 3.4 2.2 5.5 2.2s4-.8 5.5-2.2v-4.6"/></svg>',
  page:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4"/></svg>',
  pageLink:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16 16 8M9.5 8H16v6.5"/></svg>',
  smile:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 14c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2"/><circle class="f" cx="9" cy="10" r="1.1"/><circle class="f" cx="15" cy="10" r="1.1"/></svg>',
  calendar:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  eye:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="2.8"/></svg>',
  laptop:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="10.5" rx="1.5"/><path d="M2.5 19h19"/></svg>',
  cloud:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10.5a4 4 0 0 0 .6-8 6 6 0 0 0-11.6 1.3A3.4 3.4 0 0 0 7 18.5z"/></svg>',
  newline:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5v6a3 3 0 0 1-3 3H6M10 10l-4 4 4 4"/></svg>',
  wide:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>',
  narrow:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h6.5M21 12h-6.5M6 8.5 9.5 12 6 15.5M18 8.5 14.5 12l3.5 3.5"/></svg>',
  tpl:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.5h16M10 9.5V20"/></svg>',
  image:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 2.5-2.5L20 18.5"/></svg>',
  table:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 10h17M3.5 14.5h17M10 4.5v15"/></svg>',
  /* od 4.20.0: jednotné nabídky */
  trash:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 12.1a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7M9.5 7V4.5h5V7"/></svg>',
  dup:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2M14 11.5v5M11.5 14h5"/></svg>',
  clip:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5H7.5a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2H15"/><rect x="9" y="3" width="6" height="3.5" rx="1"/></svg>',
  caption:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 9.5h16M4 14h10M4 18.5h7"/></svg>',
  download:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  filter:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  textT:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h9M8.5 6v12M15 10h5M17.5 10v8"/></svg>',
  bullets:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 7h10M10 12h10M10 17h10M4.6 7h.1M4.6 12h.1M4.6 17h.1"/></svg>',
  todo:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="1.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>'
};
const TYPE_ICON={tpl:IC.tpl,link:IC.link,p:'T',h1:'H1',h2:'H2',h3:'H3',bullet:'•',num:'1.',todo:'☐',quote:'❝',callout:'!',code:'&lt;/&gt;',table:IC.table,divider:'—',page:IC.pageLink,image:IC.image,subj:IC.subject,mdimport:'M↓',eq:'∑',draw:IC.edit,ai:IC.spark,aisum:IC.spark};
const TYPE_LABEL={tpl:'Šablona',link:'Odkaz',p:'Text',h1:'Nadpis 1',h2:'Nadpis 2',h3:'Nadpis 3',bullet:'Odrážky',num:'Číslovaný seznam',todo:'Úkol',quote:'Citace',callout:'Zvýrazněný blok',code:'Kód',table:'Tabulka',divider:'Oddělovač',page:'Podstránka',image:'Obrázek',subj:'Předmět',mdimport:'Import Markdownu',eq:'Rovnice',draw:'Kresba',ai:'AI',aisum:'Shrnutí'};
const SLASH=[
  {k:'p',hint:'Obyčejný odstavec',kw:'text odstavec paragraph'},
  {k:'h1',hint:'Velký nadpis sekce',kw:'nadpis heading h1'},
  {k:'subj',hint:'Nadpis s předmětem z Indexu',kw:'predmet subject kurz index',school:true},
  {k:'h2',hint:'Střední nadpis',kw:'nadpis heading h2'},
  {k:'h3',hint:'Malý nadpis',kw:'nadpis heading h3'},
  {k:'todo',hint:'Zaškrtávací políčko',kw:'ukol todo checkbox zaskrtavaci'},
  {k:'bullet',hint:'Seznam s odrážkami',kw:'odrazky seznam bullet list'},
  {k:'num',hint:'Seznam 1, 2, 3',kw:'cislovany seznam number list'},
  {k:'table',adv:true,hint:'Řádky a sloupce, v buňkách odrážky i úkoly',kw:'tabulka table mrizka'},
  {k:'callout',hint:'Barevný rámeček s ikonou',kw:'zvyrazneny callout upozorneni info poznamka'},
  {k:'quote',hint:'Odsazený citát',kw:'citace quote'},
  {k:'code',adv:true,hint:'Neformátovaný text na víc řádků, třeba struktura složek',kw:'kod code blok slozky struktura strom prikaz terminal monospace'},
  {k:'divider',hint:'Vodorovná čára',kw:'oddelovac cara divider'},
  {k:'image',hint:'Ze souboru; v úkolu či odrážce se vloží do textu',kw:'obrazek image foto fotka picture screenshot'},
  {k:'draw',hint:'Rychlá skica perem, fixem nebo zvýrazňovačem',kw:'kreslit kresba nakreslit malovat skica nacrt tuzka pero fix draw sketch'},
  {k:'eq',hint:'LaTeX; v prázdném řádku na samostatný řádek, jinak do textu',kw:'rovnice vzorec latex tex math matematika equation jednotka velicina symbol zlomek'},
  {k:'link',hint:'Webová adresa s vlastním názvem',kw:'odkaz link url web adresa hypertext'},
  {k:'page',hint:'Odkaz na stránku nebo nová podstránka',kw:'podstranka stranka page odkaz'},
  {k:'tpl',adv:true,tpl:true,hint:'Předmět, přehled týdnů, obecné informace',kw:'sablona template vzor predloha'},
  {k:'mdimport',adv:true,hint:'Vloží obsah souboru .md (nadpisy, seznamy, úkoly, tabulky)',kw:'markdown md import soubor nahrat obsidian'},
  {k:'ai',hint:'Napíše text podle zadání',kw:'ai umela inteligence napsat napis generovat vytvor gemini claude',ai:true},
  {k:'aisum',hint:'Shrne celou stránku do pár bodů',kw:'shrnuti shrnout souhrn ai summary',ai:true}
];
const PH={p:'Text, nebo / pro příkazy',h1:'Nadpis 1',h2:'Nadpis 2',h3:'Nadpis 3',bullet:'Odrážka',num:'Položka',todo:'Úkol',quote:'Citace',callout:'Poznámka',code:'Kód'};

const ICONS={
  today:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  schedule:'<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8 13.5h3M8 17h6"/></svg>',
  tasks:'<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
  index:'<svg viewBox="0 0 24 24"><path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11.2v4.6c1.5 1.4 3.4 2.2 5.5 2.2s4-.8 5.5-2.2v-4.6"/><path d="M21.5 9v5"/></svg>',
  mindmap:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.8"/><circle cx="4.5" cy="5.5" r="1.9"/><circle cx="19.5" cy="5.5" r="1.9"/><circle cx="4.5" cy="18.5" r="1.9"/><circle cx="19.5" cy="18.5" r="1.9"/><path d="M5.9 6.9 9.9 10.2M18.1 6.9l-4 3.3M5.9 17.1l4-3.3M18.1 17.1l-4-3.3"/></svg>',
  archive:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4.5" rx="1.2"/><path d="M4.8 8.5v9.5a2 2 0 0 0 2 2h10.4a2 2 0 0 0 2-2V8.5"/><path d="M10 12.5h4"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  eyeOff:'<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a16.5 16.5 0 0 1-2.7 3.5M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7c1.9 0 3.5-.5 4.9-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
};

function downloadFile(name,text){
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'application/json'})); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500);
}
/* jednoduchý režim (od 4.18.0): úzké okno (≤ 860 px, telefon, tablet na výšku) = jen základní úpravy; nové funkce se sem
   dostanou jen výslovně. Rozhoduje šířka, ne zařízení. Data se nemění: co se tu neukazuje nebo neupravuje, zůstane jak je. */
const NARROW=matchMedia('(max-width:860px)');
const simpleUi=()=>NARROW.matches;
const plural=(n,one,few,many)=>n===1?one:n>1&&n<5?few:many;

export { $, $$, CALLOUT_IC, clamp, clone, COLOR_CZ, COLORS, DAYS, DAYS_FULL, downloadFile, esc, IC, ICONS, LIST_TYPES, lsGet, lsSet, MONTHS, norm, pad, PH, plain, plural, rid, simpleUi, SLASH, spellOn, TEXT_TYPES, TYPE_ICON, TYPE_LABEL, TYPE_SHORT, TYPES };
