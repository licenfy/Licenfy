/**
 * Licenfy — Glossary Hover System
 * Agrega términos del glosario subrayados en las preguntas.
 * Al tocar → tarjeta flotante con la definición bilingüe.
 *
 * USO: Añade ANTES de </body> en licenfy-app.html:
 *   <script src="glossary-hover.js"></script>
 */

(function () {
  'use strict';

  /* ─── CSS ─────────────────────────────────────────────────────── */
  const CSS = `
.ghl{
  display:inline;
  border-bottom:2.5px dotted currentColor;
  cursor:pointer;
  border-radius:3px;
  padding:0 2px;
  transition:background .15s,border-bottom-style .1s;
}
.ghl:hover,.ghl.ghla{
  background:rgba(0,139,255,.12)!important;
  border-bottom-style:solid!important;
}
#ghlWrap{
  position:fixed;
  inset:0;
  z-index:8880;
  pointer-events:none;
}
#ghlWrap.open{pointer-events:auto}
#ghlBackdrop{
  position:absolute;
  inset:0;
  background:transparent;
}
#ghlPopup{
  position:absolute;
  width:min(340px,calc(100vw - 28px));
  background:#fff;
  border-radius:20px;
  box-shadow:
    0 20px 64px rgba(0,0,0,.18),
    0 6px 20px rgba(0,0,0,.09),
    0 0 0 1.5px rgba(0,0,0,.06);
  overflow:hidden;
  transform-origin:top center;
  will-change:transform,opacity;
}
.ghl-enter{animation:ghlIn .24s cubic-bezier(.34,1.45,.64,1) both}
.ghl-exit{animation:ghlOut .18s cubic-bezier(.2,0,.4,1) both}
@keyframes ghlIn{
  from{opacity:0;transform:scale(.84) translateY(-8px)}
  to{opacity:1;transform:scale(1) translateY(0)}
}
@keyframes ghlOut{
  from{opacity:1;transform:scale(1)}
  to{opacity:0;transform:scale(.9) translateY(-4px)}
}
.ghl-header{
  padding:14px 16px 11px;
  display:flex;
  align-items:flex-start;
  gap:10px;
}
.ghl-headtext{flex:1;min-width:0}
.ghl-term{
  color:#fff;
  font-weight:800;
  font-size:.9rem;
  line-height:1.3;
  letter-spacing:-.01em;
}
.ghl-chip{
  display:inline-flex;
  align-items:center;
  gap:3px;
  font-size:.6rem;
  font-weight:700;
  letter-spacing:.05em;
  text-transform:uppercase;
  padding:3px 9px;
  border-radius:20px;
  background:rgba(255,255,255,.24);
  color:#fff;
  margin-top:5px;
}
.ghl-closebtn{
  background:rgba(255,255,255,.22);
  border:none;
  color:#fff;
  width:28px;height:28px;
  border-radius:50%;
  cursor:pointer;
  font-size:.78rem;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
  transition:background .15s;
  font-family:inherit;
  line-height:1;
}
.ghl-closebtn:hover{background:rgba(255,255,255,.42)}
.ghl-body{padding:13px 16px 15px}
.ghl-def{
  font-size:.84rem;
  line-height:1.7;
  color:#1e293b;
}
.ghl-sep{height:1px;background:#f0f4f8;margin:10px 0 9px}
.ghl-alt{
  font-size:.75rem;
  color:#94a3b8;
  line-height:1.55;
  font-style:italic;
}
.ghl-foot{
  display:flex;
  align-items:center;
  gap:6px;
  background:#f0f9ff;
  border:1px solid #bae6fd;
  border-radius:10px;
  padding:8px 11px;
  margin-top:11px;
  font-size:.72rem;
  color:#0369a1;
  font-style:normal;
}
`;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  /* ─── DOM for popup ───────────────────────────────────────────── */
  const wrapper = document.createElement('div');
  wrapper.id = 'ghlWrap';
  wrapper.innerHTML = '<div id="ghlBackdrop"></div>';
  document.body.appendChild(wrapper);

  const backdrop = wrapper.querySelector('#ghlBackdrop');

  let popup = null;
  let activeEl = null;

  /* ─── Map building ────────────────────────────────────────────── */
  let _map = null;

  function buildMap() {
    if (_map) return _map;
    const GLOSS = window.GLOSS;
    const TOPICS = window.TOPICS;
    if (!GLOSS || !TOPICS) return (_map = []);

    _map = [];
    const seen = new Set();

    GLOSS.forEach((g, idx) => {
      const addAlias = (raw) => {
        const key = raw.toLowerCase();
        if (key.length < 3 || seen.has(key)) return;
        seen.add(key);
        _map.push({ pat: key, idx });
      };

      // Both sides of " — "
      g.t.split(' — ').forEach(part => {
        addAlias(part.replace(/\(.*?\)/g, '').trim());
      });

      addAlias(g.t); // full term
    });

    // Longest first (greedy matching)
    _map.sort((a, b) => b.pat.length - a.pat.length);
    return _map;
  }

  /* ─── Highlight function ──────────────────────────────────────── */
  const WB = /[\s\(\)\[\]\/\-,\.!?;:"'`<>&]/;

  function highlight(text) {
    if (!text) return text;
    const map = buildMap();
    if (!map.length) return text;

    const low = text.toLowerCase();
    const used = new Uint8Array(text.length);
    const hits = [];

    map.forEach(({ pat, idx }) => {
      let s = 0;
      while (true) {
        const p = low.indexOf(pat, s);
        if (p < 0) break;
        const e = p + pat.length;
        const before = p === 0 || WB.test(text[p - 1]);
        const after  = e >= text.length || WB.test(text[e]);
        if (before && after) {
          let ov = false;
          for (let i = p; i < e; i++) if (used[i]) { ov = true; break; }
          if (!ov) {
            hits.push({ p, e, idx });
            for (let i = p; i < e; i++) used[i] = 1;
          }
        }
        s = p + 1;
      }
    });

    if (!hits.length) return text;
    hits.sort((a, b) => a.p - b.p);

    let out = '', last = 0;
    hits.forEach(h => {
      out += text.slice(last, h.p);
      const g = window.GLOSS[h.idx];
      const tp = window.TOPICS && window.TOPICS.find(t => t.id === g.tp);
      const col = tp ? tp.color : '#008bff';
      out +=
        `<span class="ghl" ` +
        `style="color:${col};border-color:${col}" ` +
        `data-gi="${h.idx}">` +
        text.slice(h.p, h.e) +
        `</span>`;
      last = h.e;
    });
    return out + text.slice(last);
  }

  /* ─── Apply to a DOM node ─────────────────────────────────────── */
  function applyHL(node) {
    if (!node || node.dataset.ghl) return;
    node.dataset.ghl = '1';
    // Recursively process text nodes, preserving existing HTML
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const toReplace = [];
    let n;
    while ((n = walker.nextNode())) {
      if (n.parentElement && n.parentElement.closest('.ghl, #ghlPopup')) continue;
      if (n.textContent.trim().length < 3) continue;
      toReplace.push(n);
    }
    toReplace.forEach(textNode => {
      const hl = highlight(textNode.textContent);
      if (hl === textNode.textContent) return;
      const span = document.createElement('span');
      span.innerHTML = hl;
      textNode.parentNode.replaceChild(span, textNode);
    });
  }

  /* ─── Popup ───────────────────────────────────────────────────── */
  function openPopup(idx, triggerEl) {
    const g = window.GLOSS && window.GLOSS[idx];
    if (!g) return;

    closePopup(false);
    triggerEl.classList.add('ghla');
    activeEl = triggerEl;

    const tp = window.TOPICS && window.TOPICS.find(t => t.id === g.tp);
    const col  = tp ? tp.color : '#008bff';
    const icon = tp ? tp.icon : '📚';
    const L = window.L || 'es';
    const tname = tp ? (tp[L] || {}).n || '' : '';
    const def   = L === 'es' ? g.es : g.en;
    const alt   = L === 'es' ? g.en : g.es;
    const flag  = L === 'es' ? '🇺🇸' : '🇲🇽';
    const tip   = L === 'es'
      ? 'Este término puede aparecer en el examen CDI.'
      : 'This term may appear on the CDI exam.';

    const pop = document.createElement('div');
    pop.id = 'ghlPopup';
    pop.className = 'ghl-enter';
    pop.innerHTML =
      `<div class="ghl-header" style="background:linear-gradient(135deg,${col},${col}cc)">` +
        `<div class="ghl-headtext">` +
          `<div class="ghl-term">${g.t}</div>` +
          `<div class="ghl-chip">${icon} ${tname}</div>` +
        `</div>` +
        `<button class="ghl-closebtn" id="ghlCloseBtn">✕</button>` +
      `</div>` +
      `<div class="ghl-body">` +
        `<div class="ghl-def">${def}</div>` +
        (alt
          ? `<div class="ghl-sep"></div><div class="ghl-alt">${flag} ${alt.substring(0, 150)}${alt.length > 150 ? '…' : ''}</div>`
          : '') +
        `<div class="ghl-foot">💡 ${tip}</div>` +
      `</div>`;

    wrapper.appendChild(pop);
    popup = pop;
    wrapper.classList.add('open');

    // Position
    const tr = triggerEl.getBoundingClientRect();
    const pw = Math.min(340, window.innerWidth - 28);
    let left = tr.left + tr.width / 2 - pw / 2;
    let top  = tr.bottom + 12;

    left = Math.max(14, Math.min(left, window.innerWidth - pw - 14));

    // Flip if goes below viewport
    if (top + 400 > window.innerHeight - 80) {
      pop.style.transformOrigin = 'bottom center';
      top = tr.top - 12;
      pop.style.bottom = (window.innerHeight - top) + 'px';
      pop.style.top = 'auto';
    } else {
      pop.style.top = top + 'px';
    }
    pop.style.left = left + 'px';

    pop.querySelector('#ghlCloseBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      closePopup(true);
    });
  }

  function closePopup(restoreEl = true) {
    if (popup) {
      popup.classList.remove('ghl-enter');
      popup.classList.add('ghl-exit');
      setTimeout(() => { if (popup) { popup.remove(); popup = null; } }, 200);
    }
    wrapper.classList.remove('open');
    if (restoreEl && activeEl) { activeEl.classList.remove('ghla'); activeEl = null; }
  }

  /* ─── Event delegation ────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    const ghl = e.target.closest('.ghl');
    if (ghl) {
      e.stopPropagation();
      const idx = parseInt(ghl.dataset.gi, 10);
      if (!isNaN(idx)) {
        // Toggle
        if (activeEl === ghl) { closePopup(true); return; }
        openPopup(idx, ghl);
      }
      return;
    }
    if (e.target === backdrop || !e.target.closest('#ghlPopup')) {
      closePopup(true);
    }
  }, true);

  document.addEventListener('scroll', () => closePopup(true), { passive: true, capture: true });

  /* ─── MutationObserver ────────────────────────────────────────── */
  const TARGETS = ['.qtext', '.exptxt', '.expbox'];

  function scanNewNodes(nodes) {
    nodes.forEach(node => {
      if (node.nodeType !== 1) return;
      TARGETS.forEach(sel => {
        if (node.matches && node.matches(sel)) applyHL(node);
        node.querySelectorAll && node.querySelectorAll(sel).forEach(applyHL);
      });
    });
  }

  // Apply to any already-existing elements
  TARGETS.forEach(sel => document.querySelectorAll(sel).forEach(applyHL));

  // Watch for new ones
  const obs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.addedNodes.length) scanNewNodes(Array.from(m.addedNodes));
    });
  });

  obs.observe(document.body, { childList: true, subtree: true });

  console.log('[Licenfy] Glossary Hover cargado ✓');
})();
