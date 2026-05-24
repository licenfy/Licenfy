/**
 * Licenfy — Glossary Hover
 * Requiere: <script src="/glossary-hover.js"></script> antes de </body>
 */
(function(){
'use strict';

// ── CSS ──────────────────────────────────────────────────────────
const css=`
.ghl{display:inline;border-bottom:2.5px dotted currentColor;cursor:pointer;
  border-radius:2px;padding:0 2px;transition:background .15s}
.ghl:hover,.ghl.ghla{background:rgba(0,139,255,.12)!important;border-bottom-style:solid!important}
#ghlPopup{
  position:fixed;z-index:9500;
  width:min(330px,calc(100vw - 28px));
  background:#fff;border-radius:18px;
  box-shadow:0 16px 56px rgba(0,0,0,.2),0 4px 16px rgba(0,0,0,.08),0 0 0 1.5px rgba(0,0,0,.06);
  overflow:hidden;
  animation:ghlIn .22s cubic-bezier(.34,1.45,.64,1) both;
  pointer-events:auto;
}
@keyframes ghlIn{from{opacity:0;transform:scale(.86) translateY(-6px)}to{opacity:1;transform:scale(1) translateY(0)}}
.ghl-h{padding:14px 15px 10px;display:flex;align-items:flex-start;gap:9px}
.ghl-title{color:#fff;font-weight:800;font-size:.88rem;line-height:1.3;flex:1}
.ghl-chip{display:inline-flex;align-items:center;gap:3px;font-size:.6rem;font-weight:700;
  text-transform:uppercase;padding:3px 9px;border-radius:20px;
  background:rgba(255,255,255,.22);color:#fff;margin-top:5px}
.ghl-x{background:rgba(255,255,255,.22);border:none;color:#fff;
  width:27px;height:27px;border-radius:50%;cursor:pointer;
  font-size:.78rem;display:flex;align-items:center;justify-content:center;
  flex-shrink:0;transition:background .15s;font-family:inherit}
.ghl-x:hover{background:rgba(255,255,255,.4)}
.ghl-b{padding:12px 15px 15px}
.ghl-def{font-size:.83rem;line-height:1.68;color:#1e293b}
.ghl-sep{height:1px;background:#f0f4f8;margin:9px 0}
.ghl-alt{font-size:.74rem;color:#94a3b8;line-height:1.55;font-style:italic}
.ghl-tip{display:flex;align-items:center;gap:6px;background:#f0f9ff;
  border-radius:10px;padding:8px 11px;margin-top:10px;
  font-size:.72rem;color:#0369a1;font-style:normal}
`;
const st=document.createElement('style');
st.textContent=css;
document.head.appendChild(st);

// ── Globals (son const en Licenfy, NO están en window) ──────────
function getGLOSS(){ try{ return GLOSS; }catch(e){ return null; } }
function getTOPICS(){ try{ return TOPICS; }catch(e){ return null; } }
function getL(){ try{ return L; }catch(e){ return 'es'; } }

// ── Build term map ───────────────────────────────────────────────
let _map=null;
function buildMap(){
  if(_map) return _map;
  const G=getGLOSS();
  if(!G){ return (_map=[]); }
  _map=[];
  const seen=new Set();
  G.forEach((g,idx)=>{
    const add=(s)=>{
      const k=s.trim().toLowerCase();
      if(k.length<3||seen.has(k)) return;
      seen.add(k); _map.push({pat:k,idx});
    };
    g.t.split(' — ').forEach(p=>add(p.replace(/\(.*?\)/g,'')));
    add(g.t);
  });
  _map.sort((a,b)=>b.pat.length-a.pat.length);
  return _map;
}

// ── Highlight text (only inside text nodes, skips HTML tags) ────
const WB=/[\s\(\)\[\]\/\-,\.!?;:"'`<>&]/;
function hlText(text){
  const map=buildMap();
  if(!map.length) return text;
  const low=text.toLowerCase();
  const used=new Uint8Array(text.length);
  const hits=[];
  map.forEach(({pat,idx})=>{
    let s=0;
    while(true){
      const p=low.indexOf(pat,s); if(p<0) break;
      const e=p+pat.length;
      const b=p===0||WB.test(text[p-1]);
      const a=e>=text.length||WB.test(text[e]);
      if(b&&a){
        let ov=false;
        for(let i=p;i<e;i++) if(used[i]){ov=true;break;}
        if(!ov){
          hits.push({p,e,idx});
          for(let i=p;i<e;i++) used[i]=1;
        }
      }
      s=p+1;
    }
  });
  if(!hits.length) return text;
  hits.sort((a,b)=>a.p-b.p);
  let out='',last=0;
  hits.forEach(h=>{
    const g=getGLOSS()[h.idx];
    const tp=getTOPICS()&&getTOPICS().find(t=>t.id===g.tp);
    const col=tp?tp.color:'#008bff';
    out+=text.slice(last,h.p);
    out+=`<span class="ghl" style="color:${col};border-color:${col}" data-gi="${h.idx}">${text.slice(h.p,h.e)}</span>`;
    last=h.e;
  });
  return out+text.slice(last);
}

// Highlight inside HTML: only process text between tags
function hlHTML(html){
  return html.split(/(<[^>]+>)/).map((chunk,i)=>i%2===0?hlText(chunk):chunk).join('');
}

// Apply to element
function applyHL(el){
  if(!el||el.dataset.ghl) return;
  el.dataset.ghl='1';
  el.innerHTML=hlHTML(el.innerHTML);
}

// ── Popup ────────────────────────────────────────────────────────
let _popup=null,_activeEl=null;

function openPopup(idx,triggerEl){
  const G=getGLOSS(); if(!G) return;
  const g=G[idx]; if(!g) return;
  closePopup(false);
  triggerEl.classList.add('ghla');
  _activeEl=triggerEl;

  const tp=getTOPICS()&&getTOPICS().find(t=>t.id===g.tp);
  const col=tp?tp.color:'#008bff';
  const icon=tp?tp.icon:'📚';
  const L2=getL();
  const tname=tp?(tp[L2]||{}).n||'':'' ;
  const def=L2==='es'?g.es:g.en;
  const alt=L2==='es'?g.en:g.es;
  const flag=L2==='es'?'🇺🇸':'🇲🇽';
  const tip=L2==='es'?'Este término puede aparecer en el examen CDI.':'This term may appear on the CDI exam.';

  const pop=document.createElement('div');
  pop.id='ghlPopup';
  pop.innerHTML=
    `<div class="ghl-h" style="background:linear-gradient(135deg,${col},${col}bb)">`+
      `<div style="flex:1;min-width:0">`+
        `<div class="ghl-title">${g.t}</div>`+
        `<div class="ghl-chip">${icon} ${tname}</div>`+
      `</div>`+
      `<button class="ghl-x" id="ghlXBtn">✕</button>`+
    `</div>`+
    `<div class="ghl-b">`+
      `<div class="ghl-def">${def}</div>`+
      (alt?`<div class="ghl-sep"></div><div class="ghl-alt">${flag} ${alt.substring(0,150)}${alt.length>150?'…':''}</div>`:'')+
      `<div class="ghl-tip">💡 ${tip}</div>`+
    `</div>`;

  document.body.appendChild(pop);
  _popup=pop;

  // Position
  const r=triggerEl.getBoundingClientRect();
  const pw=Math.min(330,window.innerWidth-28);
  let left=r.left+r.width/2-pw/2;
  let top=r.bottom+10;
  left=Math.max(14,Math.min(left,window.innerWidth-pw-14));
  if(top+420>window.innerHeight-80) top=Math.max(60,r.top-420-10);
  pop.style.left=left+'px';
  pop.style.top=top+'px';

  pop.querySelector('#ghlXBtn').addEventListener('click',e=>{e.stopPropagation();closePopup(true);});
}

function closePopup(restore=true){
  if(_popup){ _popup.remove(); _popup=null; }
  if(restore&&_activeEl){ _activeEl.classList.remove('ghla'); _activeEl=null; }
}

// ── Events ───────────────────────────────────────────────────────
document.addEventListener('click',e=>{
  const ghl=e.target.closest('.ghl');
  if(ghl){
    e.stopPropagation();
    const idx=parseInt(ghl.dataset.gi,10);
    if(_activeEl===ghl){closePopup(true);return;}
    if(!isNaN(idx)) openPopup(idx,ghl);
    return;
  }
  if(!e.target.closest('#ghlPopup')) closePopup(true);
},true);
document.addEventListener('scroll',()=>closePopup(true),{passive:true,capture:true});

// ── MutationObserver ─────────────────────────────────────────────
const SELS=['.qtext','.exptxt','.expok .exptxt','.expng .exptxt'];

function scan(root){
  SELS.forEach(sel=>{
    root.querySelectorAll&&root.querySelectorAll(sel).forEach(applyHL);
    if(root.matches&&root.matches(sel)) applyHL(root);
  });
}

// Apply to any already-existing elements
SELS.forEach(sel=>document.querySelectorAll(sel).forEach(applyHL));

// Watch for new ones added by render()
new MutationObserver(muts=>{
  muts.forEach(m=>{
    m.addedNodes.forEach(n=>{ if(n.nodeType===1) scan(n); });
  });
}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});

console.log('[Licenfy] glossary-hover.js ✓ — GLOSS:',getGLOSS()?.length,'términos');
})();
