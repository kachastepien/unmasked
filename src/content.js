// Content script — runs on every page, persists independently of popup

// ── On load: restore any saved highlights for this tab ────────────────────────
(function restoreOnLoad() {
  // Ask background if there are saved highlights for this tab
  chrome.runtime.sendMessage({ action: 'getHighlights' }, response => {
    if (chrome.runtime.lastError) return;
    if (response?.items?.length) {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyItems(response.items));
      } else {
        // Small delay to let page render
        setTimeout(() => applyItems(response.items), 600);
      }
    }
  });
})();

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_TEXTS') {
    sendResponse({ texts: extractTexts() });
    return true;
  }

  // Popup (or background restore) asks content to apply/clear highlights
  if (message.action === 'applyHighlights') {
    if (!message.items || message.items.length === 0) {
      // Clear all highlights
      document.querySelectorAll('[data-ds-hl]').forEach(el => {
        el.removeAttribute('data-ds-hl');
        el.querySelectorAll('[data-ds-tooltip],[data-ds-badge]').forEach(t => t.remove());
      });
      document.getElementById('ds-style')?.remove();
    } else {
      injectHighlightsInline(message.items);
    }
    sendResponse({ ok: true });
    return true;
  }
});

// ── Restore highlights (called from popup via executeScript) ──────────────────
// This function is also called directly via execInTab from popup.js
// (injectHighlights is serialized and sent over)

// ── Text extraction ───────────────────────────────────────────────────────────
function extractTexts() {
  const texts = [];
  const seen = new Set();
  const selectors = [
    'p', 'span', 'div', 'h1', 'h2', 'h3', 'h4',
    'button', 'a', 'label', 'li',
    '[class*="cart"]', '[class*="stock"]', '[class*="price"]',
    '[class*="timer"]', '[class*="countdown"]', '[class*="urgency"]',
    '[class*="badge"]', '[class*="tag"]', '[class*="sale"]',
    '[class*="offer"]', '[class*="deal"]', '[class*="promo"]',
  ];
  document.querySelectorAll(selectors.join(',')).forEach(el => {
    const text = el.innerText?.trim();
    if (text && text.length > 4 && text.length < 400 && !seen.has(text)) {
      seen.add(text);
      texts.push({ text, tag: el.tagName.toLowerCase() });
    }
  });
  return texts.slice(0, 300);
}

// ── Apply items (mirror of injectHighlights but callable from content.js) ─────
function applyItems(items) {
  // injectHighlights is injected via executeScript from popup.js
  // so here we just re-dispatch via background
  chrome.runtime.sendMessage({
    action: 'execInTab',
    tabId: null, // background uses sender.tab.id
    fnStr: null,
    args: null,
  });
  // Actually: content.js can't call executeScript itself
  // Instead we re-inject the highlights inline here:
  injectHighlightsInline(items);
}

// Inline version of injectHighlights that content.js can call directly
function injectHighlightsInline(items) {
  // Remove old
  document.querySelectorAll('[data-ds-hl]').forEach(el => {
    el.removeAttribute('data-ds-hl');
    el.querySelectorAll('[data-ds-tooltip],[data-ds-badge]').forEach(t => t.remove());
    el.style.animation = '';
  });
  document.getElementById('ds-style')?.remove();

  if (!items || !items.length) return;

  // Inject styles
  const style = document.createElement('style');
  style.id = 'ds-style';
  style.textContent = `
    [data-ds-hl] { position: relative !important; z-index: 9999 !important; }
    [data-ds-hl="high"]   { outline: 3px solid #ff3b3b !important; outline-offset: 4px !important; box-shadow: 0 0 0 6px rgba(255,59,59,0.25), 0 0 18px 4px rgba(255,59,59,0.35) !important; background-color: rgba(255,59,59,0.08) !important; }
    [data-ds-hl="medium"] { outline: 3px solid #f5a623 !important; outline-offset: 4px !important; box-shadow: 0 0 0 6px rgba(245,166,35,0.22), 0 0 18px 4px rgba(245,166,35,0.30) !important; background-color: rgba(245,166,35,0.07) !important; }
    [data-ds-hl="low"]    { outline: 3px solid #3ecf8e !important; outline-offset: 4px !important; box-shadow: 0 0 0 6px rgba(62,207,142,0.20), 0 0 18px 4px rgba(62,207,142,0.28) !important; background-color: rgba(62,207,142,0.07) !important; }
    [data-ds-badge] { position: absolute !important; top: -26px !important; left: 0 !important; font: 700 10px/1 -apple-system,sans-serif !important; padding: 3px 8px !important; border-radius: 4px !important; white-space: nowrap !important; z-index: 2147483646 !important; pointer-events: none !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important; }
    [data-ds-badge="high"]   { background: #ff3b3b !important; color: #fff !important; }
    [data-ds-badge="medium"] { background: #f5a623 !important; color: #000 !important; }
    [data-ds-badge="low"]    { background: #3ecf8e !important; color: #000 !important; }
    [data-ds-tooltip] { display: none !important; position: absolute !important; bottom: calc(100% + 10px) !important; left: 50% !important; transform: translateX(-50%) !important; background: #111 !important; color: #f0f0f0 !important; font: 500 12px/1.5 -apple-system,sans-serif !important; padding: 8px 12px !important; border-radius: 7px !important; white-space: normal !important; max-width: 280px !important; min-width: 160px !important; box-shadow: 0 6px 24px rgba(0,0,0,0.5) !important; z-index: 2147483647 !important; pointer-events: none !important; border: 1px solid #333 !important; }
    [data-ds-hl]:hover [data-ds-tooltip] { display: block !important; }
    @keyframes ds-pulse { 0%,100%{box-shadow:0 0 0 6px rgba(255,59,59,0.25),0 0 18px 4px rgba(255,59,59,0.35)} 50%{box-shadow:0 0 0 8px rgba(255,59,59,0.15),0 0 28px 8px rgba(255,59,59,0.20)} }
    [data-ds-hl="high"] { animation: ds-pulse 2s ease-in-out infinite !important; }
  `;
  document.head.appendChild(style);

  const candidates = Array.from(document.querySelectorAll(
    'button,a,label,strong,b,em,span,p,li,div,h1,h2,h3,h4,' +
    '[class*="badge"],[class*="urgency"],[class*="stock"],[class*="countdown"],' +
    '[class*="offer"],[class*="deal"],[class*="promo"],[class*="price"],' +
    '[class*="discount"],[class*="save"],[class*="saving"],' +
    '[class*="label"],[class*="tag"],[class*="banner"],[class*="ribbon"]'
  ));

  function elOk(el) {
    if (el.dataset.dsDone) return false;
    if (el.tagName === 'IMG' || el.tagName === 'PICTURE' || el.tagName === 'SVG') return false;
    if (el.querySelector('img, picture')) return false;
    const txt = (el.innerText || '').trim();
    if (txt.length < 3) return false;
    const r = el.getBoundingClientRect();
    return r.height >= 1 && r.height <= 80 && r.width >= 1 && r.width <= window.innerWidth * 0.75;
  }

  function markEl(el, sev, type, hint) {
    if (el.tagName === 'IMG' || el.tagName === 'PICTURE') return;
    if (!( (el.innerText || '').trim().length >= 3 )) return;
    if (el.querySelector('[data-ds-badge]')) return;
    el.setAttribute('data-ds-hl', sev);
    el.dataset.dsDone = '1';
    const badge = document.createElement('span');
    badge.setAttribute('data-ds-badge', sev);
    badge.textContent = type;
    el.appendChild(badge);
    if (hint) {
      const tip = document.createElement('span');
      tip.setAttribute('data-ds-tooltip', '');
      tip.textContent = hint;
      el.appendChild(tip);
    }
  }

  const bySize = [...candidates].sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return (ra.width * ra.height) - (rb.width * rb.height);
  });

  // Per-type max element height - prevents matching product cards instead of badges
  const TYPE_MAX_H = {
    'Fake Discount':   32,   // "You save 58%" is a one-line badge
    'Urgency':         80,   // "Only 2 left in stock! Order in next..."
    'Scarcity':        40,
    'Social Proof':    28,   // "500+ sold this week" is a tiny line
    'Sneaking':        80,
    'Misdirection':    32,
    'Trick Questions': 100,
    'Forced Action':   60,
    'Confirmshaming':  28,
  };

  items.forEach(({ snippets, sev, type, hint }) => {
    const maxH = TYPE_MAX_H[type] || 80;

    (snippets || []).forEach(snippet => {
      const w = snippet.split(/\s+/).filter(Boolean);
      if (w.length === 0) return;
      let matched = false;

      // ── Strategy 1: find element whose trimmed text IS the snippet (tight match)
      const tries = [
        snippet,
        snippet.substring(0, 50),
        w.slice(0, 6).join(' '),
        w.slice(0, 4).join(' '),
        w.slice(0, 3).join(' '),
      ].filter((s, i, a) => s && s.trim().length >= 4 && a.indexOf(s) === i);

      for (const snip of tries) {
        if (matched) break;
        for (const el of bySize) {
          if (!elOk(el)) continue;
          const txt = (el.innerText || '').trim();
          // Must CONTAIN the snip, and element must not be too tall for this type
          if (!txt.includes(snip)) continue;
          const r = el.getBoundingClientRect();
          if (r.height > maxH) continue;
          markEl(el, sev, type, hint);
          matched = true;
          break;
        }
      }

      // ── Strategy 2: split-span walk (e.g. "You save 58%" + "Instant opportunity"
      //    are in sibling spans — find parent that contains all key words)
      if (!matched && w.length >= 2) {
        const w0 = w[0], w1 = w[1];
        for (const el of bySize) {
          if (el.dataset.dsDone) continue;
          const r0 = el.getBoundingClientRect();
          if (r0.height < 1 || r0.height > maxH) continue;
          const t0 = (el.innerText || '');
          if (!t0.includes(w0)) continue;
          // Walk up to find parent that also has w1 but is still small
          let node = el;
          for (let i = 0; i < 4; i++) {
            node = node.parentElement;
            if (!node) break;
            if (node.querySelector('img, picture')) break;
            const pr = node.getBoundingClientRect();
            if (pr.height > maxH * 1.5) break;
            if ((node.innerText || '').includes(w1)) {
              markEl(node, sev, type, hint);
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
      }

      // ── Strategy 3: first-word exact match — only if word is highly specific
      //    (long enough and not a generic stop-word like "only", "just", "save")
      const GENERIC = new Set(['only','just','save','get','free','best','deal','new','last','more','sold','this','that','your','from','with','have','also','been','some','will','dont','most','over','very']);
      if (!matched) {
        const kws = w.filter(k => k.length >= 7 && !GENERIC.has(k.toLowerCase()));
        outer: for (const kw of kws) {
          const re = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b','i');
          for (const el of bySize) {
            if (!elOk(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.height > maxH) continue;
            if (!re.test(el.innerText || '')) continue;
            markEl(el, sev, type, hint);
            matched = true;
            break outer;
          }
        }
      }
    });
  });

  candidates.forEach(el => delete el.dataset.dsDone);
}
