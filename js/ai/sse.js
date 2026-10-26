/* Úkolníček – AI: společné pomůcky adaptérů – chyba s kódem a čtení streamované odpovědi (Server-Sent Events) po událostech {event, data}.
   Adaptéry importují jen odsud, ne z js/ai.js (jinak by vznikl kruhový import). */
/* code: none | key | credit | limit | model | net | busy | blocked | long | empty | other (texty v AI_ERR v js/ai.js) */

class AiError extends Error{ constructor(code,detail){ super(code); this.code=code; this.detail=detail||''; } }

async function* aiSse(res){
  const rd=res.body.getReader(), dec=new TextDecoder(); let buf='';
  const one=chunk=>{ const ev={event:'message',data:''};
    chunk.split(/\r?\n/).forEach(l=>{ if(l.startsWith('event:')) ev.event=l.slice(6).trim(); else if(l.startsWith('data:')) ev.data+=(ev.data?'\n':'')+l.slice(5).replace(/^ /,''); });
    return ev.data?ev:null; };
  for(;;){
    const {value,done}=await rd.read(); if(done) break;
    buf+=dec.decode(value,{stream:true});
    let m; while((m=/\r?\n\r?\n/.exec(buf))){ const ev=one(buf.slice(0,m.index)); buf=buf.slice(m.index+m[0].length); if(ev) yield ev; }
  }
  if(buf.trim()){ const ev=one(buf); if(ev) yield ev; }
}
/* JSON z události; neplatný řádek se přeskočí */
const aiJson=s=>{ try{ return JSON.parse(s); }catch(_){ return null; } };

export { AiError, aiJson, aiSse };
