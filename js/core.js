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
const EMOJI=['📘','📗','📙','📕','📓','📒','🎓','⚛️','⚙️','☢️','🔬','🧪','🧮','📐','⚡','🔋','🧲','🌡️','💧','🏭','💡','📡','🖥️','🗓️','📅','📌','📝','🗂️','📊','🧠','🎯','✅','🔥','⭐','🧭','🏃','☕','🎒'];
const CALLOUT_IC=['💡','📌','⚠️','🗓️','✅','❗','📎','🔴'];
const TEXT_TYPES=['p','h1','h2','h3','bullet','num','todo','quote','callout'];
const LIST_TYPES=['bullet','num','todo'];
const TYPE_ICON={link:'🔗',p:'T',h1:'H1',h2:'H2',h3:'H3',bullet:'•',num:'1.',todo:'☐',quote:'❝',callout:'!',table:'▦',divider:'—',page:'↗',image:'▣',subj:'🎓'};
const TYPE_LABEL={link:'Odkaz',p:'Text',h1:'Nadpis 1',h2:'Nadpis 2',h3:'Nadpis 3',bullet:'Odrážky',num:'Číslovaný seznam',todo:'Úkol',quote:'Citace',callout:'Zvýrazněný blok',table:'Tabulka',divider:'Oddělovač',page:'Podstránka',image:'Obrázek',subj:'Předmět'};
const SLASH=[
  {k:'p',hint:'Obyčejný odstavec',kw:'text odstavec paragraph'},
  {k:'h1',hint:'Velký nadpis sekce',kw:'nadpis heading h1'},
  {k:'subj',hint:'Nadpis s předmětem z Indexu',kw:'predmet subject kurz index',school:true},
  {k:'h2',hint:'Střední nadpis',kw:'nadpis heading h2'},
  {k:'h3',hint:'Malý nadpis',kw:'nadpis heading h3'},
  {k:'todo',hint:'Zaškrtávací políčko',kw:'ukol todo checkbox zaskrtavaci'},
  {k:'bullet',hint:'Seznam s odrážkami',kw:'odrazky seznam bullet list'},
  {k:'num',hint:'Seznam 1, 2, 3',kw:'cislovany seznam number list'},
  {k:'table',hint:'Řádky a sloupce, v buňkách odrážky i úkoly',kw:'tabulka table mrizka'},
  {k:'callout',hint:'Barevný rámeček s ikonou',kw:'zvyrazneny callout upozorneni info poznamka'},
  {k:'quote',hint:'Odsazený citát',kw:'citace quote'},
  {k:'divider',hint:'Vodorovná čára',kw:'oddelovac cara divider'},
  {k:'image',hint:'Ze souboru; v úkolu či odrážce se vloží do textu',kw:'obrazek image foto fotka picture screenshot'},
  {k:'link',hint:'Webová adresa s vlastním názvem',kw:'odkaz link url web adresa hypertext'},
  {k:'page',hint:'Nová stránka uvnitř této',kw:'podstranka stranka page'}
];
const PH={p:'Piš, nebo stiskni / pro příkazy',h1:'Nadpis 1',h2:'Nadpis 2',h3:'Nadpis 3',bullet:'Odrážka',num:'Položka',todo:'Úkol',quote:'Citace',callout:'Poznámka'};

const ICONS={
  today:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  schedule:'<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8 13.5h3M8 17h6"/></svg>',
  tasks:'<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
  index:'<svg viewBox="0 0 24 24"><path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11.2v4.6c1.5 1.4 3.4 2.2 5.5 2.2s4-.8 5.5-2.2v-4.6"/><path d="M21.5 9v5"/></svg>',
  eyeOff:'<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a16.5 16.5 0 0 1-2.7 3.5M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7c1.9 0 3.5-.5 4.9-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
};

function downloadFile(name,text){
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'application/json'})); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500);
}
const plural=(n,one,few,many)=>n===1?one:n>1&&n<5?few:many;

export { $, $$, CALLOUT_IC, clamp, clone, COLOR_CZ, COLORS, DAYS, DAYS_FULL, downloadFile, EMOJI, esc, ICONS, LIST_TYPES, lsGet, lsSet, MONTHS, norm, pad, PH, plain, plural, rid, SLASH, TEXT_TYPES, TYPE_ICON, TYPE_LABEL, TYPE_SHORT, TYPES };
