/* Úkolníček – Markdown: import souboru .md do stránky (/ → Import Markdownu) a export stránky do .md (tlačítko u zámku) */
import { esc, TEXT_TYPES } from '../core.js';
import { S } from '../state.js';
import { savePage } from '../store.js';
import { newBlock, pTitle } from '../pages.js';
import { subjBlockText } from '../school.js';
import { isBlank, sanitize } from '../sanitize.js';
import { focusBlock } from './caret.js';
import { renderSidebar } from '../sidebar.js';
import { renderPage } from './render.js';
import { toast } from '../ui.js';

/* ================= import: text .md → bloky ================= */
/* GitHub/Obsidian rámečky > [!NOTE] → zvýrazněný blok */
const CALLOUT_MAP={note:['💡','blue'],info:['💡','blue'],tip:['✅','green'],important:['❗','purple'],warning:['⚠️','orange'],caution:['🔴','red'],danger:['🔴','red']};
const CALLOUT_BACK={'💡':'NOTE','✅':'TIP','❗':'IMPORTANT','⚠️':'WARNING','🔴':'CAUTION'};

/* řádkový markdown → bezpečné HTML (výsledek se stejně ještě čistí přes sanitize) */
function mdInline(s){
  const keep=[]; const put=h=>`\u0000${keep.push(h)-1}\u0000`;
  s=String(s||'');
  s=s.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g,(_,q,c)=>put(`<code>${esc(c.trim()===''?c:c.replace(/^ (.*) $/,'$1'))}</code>`));
  s=s.replace(/\\([\\`*_{}\[\]()#+\-.!|~=<>])/g,(_,c)=>put(esc(c)));
  s=esc(s);
  /* pár povolených HTML značek, které se v .md běžně píšou */
  s=s.replace(/&lt;br\s*\/?&gt;/gi,'<br>').replace(/&lt;(u|b|i|s|mark)&gt;([\s\S]*?)&lt;\/\1&gt;/gi,(_,t,x)=>`<${t==='mark'?'mark class="hl-yellow"':t}>${x}</${t}>`);
  /* obrázky jdou jen jako odkaz (soubory obrázků v .md nejsou) */
  s=s.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\s*\)/g,(_,alt,u)=>put(`<a href="${u}">${alt||'obrázek'}</a>`));
  s=s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\s*\)/g,(_,t,u)=>put(`<a href="${u}">${t}</a>`));
  s=s.replace(/&lt;((?:https?:\/\/|mailto:)[^\s&]+)&gt;/g,(_,u)=>put(`<a href="${u}">${u}</a>`));
  s=s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,a,b)=>b||a);   /* wiki odkazy z Obsidianu → text */
  s=s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g,'<b>$2</b>');
  s=s.replace(/\*(?=[^\s*])([^*]*?[^\s*])\*/g,'<i>$1</i>').replace(/(^|[^\w])_(?=[^\s_])([^_]*?[^\s_])_(?![\w])/g,'$1<i>$2</i>');
  s=s.replace(/~~(?=\S)([\s\S]*?\S)~~/g,'<s>$1</s>');
  s=s.replace(/==(?=\S)([\s\S]*?\S)==/g,'<mark class="hl-yellow">$1</mark>');
  return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>keep[+i]).replace(/\u0000(\d+)\u0000/g,(_,i)=>keep[+i]);
}
const RE_H=/^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/, RE_HR=/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,
  RE_LI=/^([ \t]*)([-*+•]|\d{1,9}[.)])[ \t]+(.*)$/, RE_Q=/^ {0,3}>[ \t]?(.*)$/, RE_FENCE=/^ {0,3}(```+|~~~+)/,
  RE_TSEP=/^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const width=s=>s.replace(/\t/g,'    ').length;
function splitRow(line){
  let t=line.trim(); if(t.startsWith('|')) t=t.slice(1); if(t.endsWith('|')&&!t.endsWith('\\|')) t=t.slice(0,-1);
  const out=[]; let cur='';
  for(let i=0;i<t.length;i++){ if(t[i]==='\\'&&t[i+1]==='|'){ cur+='\\|'; i++; } else if(t[i]==='|'){ out.push(cur); cur=''; } else cur+=t[i]; }
  out.push(cur); return out.map(c=>c.trim());
}
function cellLines(c){
  return c.split(/<br\s*\/?>/i).map(x=>{
    let m; x=x.trim();
    if((m=x.match(/^[-*+][ \t]+\[( |x|X)\][ \t]+(.*)$/))) return Object.assign({t:'todo',html:mdInline(m[2])},m[1]!==' '?{done:true}:{});
    if((m=x.match(/^[-*+•][ \t]+(.*)$/))) return {t:'bullet',html:mdInline(m[1])};
    return {t:'p',html:mdInline(x)};
  });
}
/* hlavní převod: vrací {blocks}; bloky jsou čisté objekty bez id (doplní je vložení) */
function mdToBlocks(text){
  const L=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
  const out=[]; let i=0, para=null, stack=[], lastList=null;
  const flush=()=>{ if(para){ out.push({type:'p',html:para.map(mdInline).join('<br>')}); para=null; } };
  const endList=()=>{ stack=[]; lastList=null; };
  /* úvodní hlavička YAML (Obsidian) se přeskočí */
  if(/^---\s*$/.test(L[0]||'')){ const e=L.findIndex((l,k)=>k>0&&/^(---|\.\.\.)\s*$/.test(l)); if(e>0) i=e+1; }
  for(;i<L.length;i++){
    const line=L[i]; let m;
    if(!line.trim()){ flush(); continue; }
    if((m=line.match(RE_FENCE))){
      flush(); endList(); const fence=m[1], code=[];
      for(i++;i<L.length&&!L[i].trim().startsWith(fence[0].repeat(fence.length));i++) code.push(L[i]);
      out.push({type:'p',html:code.map(c=>c?`<code>${esc(c)}</code>`:'').join('<br>')});
      continue;
    }
    if((m=line.match(RE_H))){ flush(); endList(); out.push({type:'h'+Math.min(3,m[1].length),html:mdInline(m[2])}); continue; }
    if(RE_HR.test(line)&&!para){ endList(); out.push({type:'divider',html:''}); continue; }
    if(line.includes('|')&&L[i+1]!=null&&RE_TSEP.test(L[i+1])&&L[i+1].includes('-')){
      flush(); endList();
      const rows=[splitRow(line)]; i+=2;
      for(;i<L.length&&L[i].trim()&&L[i].includes('|');i++) rows.push(splitRow(L[i]));
      i--;
      const nc=Math.max(...rows.map(r=>r.length));
      out.push({type:'table',hrow:true,hcol:false,rows:rows.map(r=>({cells:Array.from({length:nc},(_,c)=>({lines:cellLines(r[c]||'')}))}))});
      continue;
    }
    if((m=line.match(RE_Q))&&!para){
      endList(); const q=[m[1]];
      for(;i+1<L.length&&(m=L[i+1].match(RE_Q));i++) q.push(m[1]);
      const c=q[0].match(/^\[!(\w+)\][+-]?[ \t]*(.*)$/);
      if(c){ const [ic,col]=CALLOUT_MAP[c[1].toLowerCase()]||CALLOUT_MAP.note; const rest=[c[2],...q.slice(1)].filter((x,k)=>k>0||x.trim());
        out.push({type:'callout',icon:ic,color:col,html:rest.map(mdInline).join('<br>')}); }
      else out.push({type:'quote',html:q.map(mdInline).join('<br>')});
      continue;
    }
    if((m=line.match(RE_LI))&&!(para&&/^\d/.test(m[2])&&m[2]!=='1.'&&m[2]!=='1)')){
      flush();
      const ind=width(m[1]);
      while(stack.length&&stack[stack.length-1]>ind) stack.pop();
      if(!stack.length||stack[stack.length-1]<ind) stack.push(ind);
      const level=Math.min(4,stack.length-1);
      let body=m[3], b, t;
      if((t=body.match(/^\[( |x|X)\](?:[ \t]+(.*))?$/))) b=Object.assign({type:'todo',html:mdInline(t[2]||'')},t[1]!==' '?{done:true}:{});
      else b={type:/^\d/.test(m[2])?'num':'bullet',html:mdInline(body)};
      if(level) b.level=level;
      out.push(b); lastList=b; continue;
    }
    /* odsazené pokračování položky seznamu */
    if(lastList&&/^[ \t]+\S/.test(line)&&!para){ lastList.html+=(lastList.html?'<br>':'')+mdInline(line.trim()); continue; }
    endList();
    (para||(para=[])).push(line.replace(/(\\| {2,})$/,'').trim());
  }
  flush();
  return out;
}

/* vloží .md soubor do stránky: prázdný řádek nahradí, jinak vloží pod blok */
function pickMdFile(){
  return new Promise(res=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept='.md,.markdown,.mdown,.txt,text/markdown,text/plain'; inp.hidden=true;
    document.body.appendChild(inp);
    inp.addEventListener('change',()=>{ res(inp.files[0]||null); inp.remove(); });
    inp.addEventListener('cancel',()=>{ res(null); inp.remove(); });
    inp.click();
  });
}
function cleanBlock(x){
  const b=newBlock(x.type,{html:x.type==='table'||x.type==='divider'?'':sanitize(x.html)});
  if(x.level) b.level=x.level;
  if(x.done) b.done=true;
  if(x.type==='callout'){ b.icon=x.icon; b.color=x.color; }
  if(x.type==='table'){ delete b.html; b.hrow=x.hrow; b.hcol=x.hcol; b.rows=x.rows.map(r=>({cells:r.cells.map(c=>({lines:c.lines.map(l=>Object.assign({t:l.t,html:sanitize(l.html)},l.done?{done:true}:{}))}))})); }
  return b;
}
async function importMd(pg,blockId,file){
  file=file||await pickMdFile(); if(!file) return;
  if(file.size>3*1024*1024) return toast('Soubor je moc velký (víc než 3 MB).');
  let text; try{ text=await file.text(); }catch(e){ return toast('Soubor se nepodařilo přečíst.'); }
  const parsed=mdToBlocks(text);
  if(!parsed.length) return toast('V souboru není žádný text.');
  let titled=false;
  if(!String(pg.title||'').trim()){
    /* stránka bez názvu: název z prvního nadpisu # (pokud je na začátku), jinak ze jména souboru */
    if(parsed[0].type==='h1'){ pg.title=parsed.shift().html.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim(); }
    else pg.title=file.name.replace(/\.(md|markdown|mdown|txt)$/i,'');
    titled=true;
  }
  const blocks=parsed.map(cleanBlock);
  let bi=pg.blocks.findIndex(b=>b.id===blockId); if(bi<0) bi=pg.blocks.length-1;
  const cur=pg.blocks[bi];
  const replace=cur&&TEXT_TYPES.includes(cur.type)&&isBlank(cur.html);
  if(blocks.length) pg.blocks.splice(replace?bi:bi+1,replace?1:0,...blocks);
  const last=blocks[blocks.length-1]; let ni=pg.blocks.indexOf(last), next=pg.blocks[ni+1];
  if(!next||next.type!=='p'||!isBlank(next.html)){ next=newBlock('p'); pg.blocks.splice(ni+1,0,next); }
  savePage(pg); if(titled) renderSidebar(); renderPage(pg); focusBlock(next.id,0);
  toast(`Vloženo z „${file.name}“: ${blocks.length} ${blocks.length===1?'blok':blocks.length<5?'bloky':'bloků'}`);
}

/* ================= export: stránka → text .md ================= */
const escMd=s=>s.replace(/([\\`*\[\]~|<>])/g,'\\$1').replace(/(^|[^\p{L}\p{N}])_|_(?=[^\p{L}\p{N}]|$)/gu,(m)=>m.replace('_','\\_')).replace(/==/g,'=\\=');
function htmlToMd(html,br){
  if(!html) return '';
  const t=document.createElement('template'); t.innerHTML=html;
  const wrap=(m,x)=>{ const s=x.match(/^(\s*)([\s\S]*?)(\s*)$/); return s[2]?s[1]+m+s[2]+m+s[3]:x; };
  const walk=n=>[...n.childNodes].map(ch=>{
    if(ch.nodeType===3) return escMd(ch.nodeValue.replace(/\u00A0/g,' '));
    if(ch.nodeType!==1) return '';
    const tg=ch.tagName, inner=()=>walk(ch);
    if(tg==='BR') return br;
    if(tg==='B'||tg==='STRONG') return wrap('**',inner());
    if(tg==='I'||tg==='EM') return wrap('*',inner());
    if(tg==='S'||tg==='STRIKE') return wrap('~~',inner());
    if(tg==='U') return `<u>${inner()}</u>`;
    if(tg==='MARK') return wrap('==',inner());
    if(tg==='CODE'){ const c=ch.textContent; const q=c.includes('`')?'`` ':'`'; return q+c+q.split('').reverse().join(''); }
    if(tg==='IMG') return `*[obrázek${ch.getAttribute('data-name')?': '+escMd(ch.getAttribute('data-name')):''}]*`;
    if(tg==='A'){ if(ch.hasAttribute('data-page')||ch.hasAttribute('data-subj')) return escMd(ch.textContent);
      const h=ch.getAttribute('href')||''; const tx=inner(); return h?`[${tx||escMd(h)}](${h.replace(/[()\s]/g,c=>encodeURIComponent(c))})`:tx; }
    return inner();
  }).join('');
  return walk(t.content).replace(/[ \t]+$/,'');
}
function pageToMd(pg){
  const out=[], bl=pg.blocks||[];
  const push=(s,tight)=>{ if(out.length&&!tight) out.push(''); out.push(s); };
  out.push('# '+escMd(pTitle(pg)).replace(/\n/g,' '));
  (pg.props||[]).filter(p=>p.k||p.v).forEach((p,k)=>push(`- **${escMd(p.k||'')}:** ${htmlToMd(p.v||'',' ')}`,k>0));
  const isList=t=>t==='bullet'||t==='num'||t==='todo';
  let prev=null;
  for(const b of bl){
    const lv=b.level||0, ind='  '.repeat(lv), tight=prev&&isList(prev.type)&&isList(b.type);
    let s=null;
    switch(b.type){
      case 'p': s=htmlToMd(b.html,'  \n'); if(!s.trim()){ prev=b; continue; } break;
      case 'h1': case 'h2': case 'h3': s='#'.repeat(+b.type[1])+' '+htmlToMd(b.html,' '); break;
      case 'subj': s='# '+escMd(subjBlockText(b)); break;
      case 'bullet': s=ind+'- '+htmlToMd(b.html,'  \n'+ind+'  '); break;
      case 'num': s=ind+'1. '+htmlToMd(b.html,'  \n'+ind+'   '); break;
      case 'todo': s=ind+(b.done?'- [x] ':'- [ ] ')+htmlToMd(b.html,'  \n'+ind+'  '); break;
      case 'quote': s='> '+htmlToMd(b.html,'  \n> '); break;
      case 'callout': s=`> [!${CALLOUT_BACK[b.icon]||'NOTE'}]\n> `+(b.icon&&!CALLOUT_BACK[b.icon]?b.icon+' ':'')+htmlToMd(b.html,'  \n> '); break;
      case 'divider': s='---'; break;
      case 'page': s=`↗ ${escMd(pTitle(S.pages[b.pageId]||null))}`; break;
      case 'image': s=`*[obrázek${b.name?': '+escMd(b.name):''}]*`+(b.caption?`  \n${htmlToMd(b.caption,' ')}`:''); break;
      case 'table': {
        const rows=(b.rows||[]).map(r=>r.cells.map(c=>c.lines.map(l=>(l.t==='bullet'?'- ':l.t==='todo'?(l.done?'- [x] ':'- [ ] '):'')+htmlToMd(l.html,'<br>')).filter((x,k,a)=>x||a.length===1).join('<br>').replace(/\n/g,' ')));
        if(!rows.length) { prev=b; continue; }
        const nc=Math.max(...rows.map(r=>r.length)), line=r=>'| '+Array.from({length:nc},(_,c)=>r[c]||'').join(' | ')+' |';
        s=[line(rows[0]),'|'+Array.from({length:nc},()=>' --- ').join('|')+'|',...rows.slice(1).map(line)].join('\n');
        break;
      }
      default: s=htmlToMd(b.html||'','  \n');
    }
    push(s,tight); prev=b;
  }
  return out.join('\n').replace(/\n{3,}/g,'\n\n')+'\n';
}
function exportMd(pg){
  if(!pg) return;
  const text=pageToMd(pg);
  const name=(pTitle(pg).replace(/[\\/:*?"<>|\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim()||'stranka').slice(0,80)+'.md';
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'})); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500);
  toast(`Stránka uložena jako „${name}“`);
}

export { exportMd, importMd };
