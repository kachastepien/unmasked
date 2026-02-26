'use strict';

// ─── Pattern definitions ──────────────────────────────────────────────────────
const CATEGORIES = {
  'Urgency':         { sev: 'high',   desc: 'Artificial time pressure',              icon: 'ic-clock'    },
  'Scarcity':        { sev: 'high',   desc: 'False product scarcity',                icon: 'ic-box'      },
  'Sneaking':        { sev: 'high',   desc: 'Hidden additions to cart/order',        icon: 'ic-sneaking' },
  'Trick Questions': { sev: 'high',   desc: 'Deliberately confusing UI/forms',       icon: 'ic-help'     },
  'Fake Discount':   { sev: 'high',   desc: 'Inflated original price / fake %off',   icon: 'ic-tag'      },
  'Misdirection':    { sev: 'medium', desc: 'Distracting from important info',       icon: 'ic-eye-off'  },
  'Social Proof':    { sev: 'medium', desc: 'Manipulative social validation',        icon: 'ic-users'    },
  'Forced Action':   { sev: 'medium', desc: 'Requiring unnecessary user actions',    icon: 'ic-lock'     },
  'Confirmshaming':  { sev: 'low',    desc: 'Shaming users for declining',           icon: 'ic-frown'    },
};

const PAGE_TYPES = { ECOMMERCE:'ecommerce', BOOKING:'booking', SAAS:'saas', NEWS:'news', POLICY:'policy', SOCIAL:'social', OTHER:'other' };

const ALLOWED = {
  ecommerce: ['Urgency','Scarcity','Social Proof','Sneaking','Trick Questions','Misdirection','Forced Action','Confirmshaming','Fake Discount'],
  booking:   ['Urgency','Scarcity','Social Proof','Sneaking','Misdirection','Forced Action','Fake Discount'],
  saas:      ['Urgency','Scarcity','Trick Questions','Misdirection','Forced Action','Confirmshaming','Sneaking'],
  news:      ['Misdirection','Forced Action'],
  policy:    [],
  social:    ['Forced Action','Trick Questions'],
  other:     ['Urgency','Scarcity','Social Proof','Confirmshaming','Forced Action','Fake Discount'],
};

const RULES = [
  { type: 'Urgency', must: [
      /\bonly\s+\d+\s+(left|remaining)\b/i,
      /\b\d+\s*(people|customers?|viewers?)\s*(are\s*)?(viewing|watching|looking at)\b/i,
      /\bhurry[\s!,]/i,
      /\blimited[\s-]time\s+(offer|deal|discount|sale)\b/i,
      /\boffer\s+ends?\s+in\b/i,
      /\bact\s+now\b/i,
      /\blast\s+chance\b/i,
      /\bends?\s+in\s+\d+/i,
      /\bselling\s+out\s+fast\b/i,
      /\b(expires?|ends?)\s+in\s+\d+:\d+/i,
      /\blightning\s+deal\b/i,
      /\blimited.time\s+deal\b/i,
      /\btoday[''s]*\s+deal\b/i,
      /\bdeal\s+of\s+the\s+day\b/i,
      /posp[ie][es]sz\s+si[e\u0119]/i,
      /tylko\s+(dzi[s\u015b]|dzisiaj|teraz)/i,
      /oferta\s+(wygasa|ko[n\u0144]czy\s+si[e\u0119])/i,
      /\bflash\s+sale\b/i,
      /\boferta\s+dnia\b/i,
    ], not: [
      /\d{1,2}:\d{2}\s*[-\u2013\u2014]\s*\d{1,2}:\d{2}/,
      /godzin[ay]/i,
      /check[\s-]?(in|out)/i,
      /opening?\s+hours/i,
      /cisza\s+nocna/i,
      /quiet\s+hours?/i,
      /harmonogram/i,
    ]
  },
  { type: 'Scarcity', must: [
      /\bonly\s+\d+\s+in\s+stock\b/i,
      /\bonly\s+\d+\s+items?\s+left\b/i,
      /\blow\s+stock\b/i,
      /\balmost\s+gone\b/i,
      /\blast\s+\d+\s+items?\b/i,
      /\b\d+\s+left\s+in\s+stock\b/i,
      /\brunning\s+low\b/i,
      /ostatni[ae]\s+(sztuk[ai]|egzemplarze?|para|kopia)/i,
      /ostatnie\s+\d+\s+sztuk/i,
      /prawie\s+wyprzedane/i,
      /tylko\s+\d+\s+sztuk/i,
    ], not: [/regulamin/i, /zasady/i]
  },
  { type: 'Social Proof', must: [
      /\b\d+\s+(people|customers?|visitors?|others?)\s+(are\s+)?(viewing|watching|looking|bought)\b/i,
      /\b\d+\s+os[o\u00f3]b\s+(ogl[a\u0105]da|kupi[l\u0142]o|patrzy)/i,
      /\bbestseller\b/i,
      /\bbest\s+seller\b/i,
      /\btop\s+rated\b/i,
      /\bmost\s+popular\s+(product|item|choice)\b/i,
      /\btrending\s+now\b/i,
      /[+]?\d+\s+sprzedano/i,
      /\d+\s+(kupiono|zam[o\u00f3]wie[n\u0144])/i,
      /\bbestseller\s+aliexpress\b/i,
      /bestseller\s+allegro/i,
      /\bamazon[''s]*\s+choice\b/i,
      /\bbest\s+seller\s+in\b/i,
      /\b#\s*\d+\s+best\s+sell/i,
      /\bhighly\s+rated\b/i,
      /najpopularniejsz[yi]/i,
      /wyb[o\u00f3]r\s+klient[o\u00f3]w/i,
      /\b\d+[km]?\+?\s+sold\b/i,
      /\b\d+\s+orders?\b/i,
      /polecany\s+przez/i,
    ], not: []
  },
  { type: 'Fake Discount', must: [
      // Crossed-out price + big % e.g. "73,63zł -15%"
      /\d[\d,.]*\s*z[l\u0142]\s+[-\u2013]\d{1,3}%/,
      // Amazon "You save 58%" / "You save 237.01 PLN"
      /\byou\s+save\s+\d+%/i,
      /\byou\s+save\s+\d[\d,.]+/i,
      /\binstant\s+opportunity\b/i,
      /\bsave\s+\d+%\s+with/i,
      /\bcoupon:\s+save/i,
      // Supercena
      /supercen[ay]/i,
      /cena\s+miesi[a\u0105]ca/i,
      /super\s+(deal|price|cena)/i,
      // New customer / welcome
      /nowy\s+klient/i,
      /new\s+(user|customer)\s+coupon/i,
      /first\s+order\s+(discount|coupon)/i,
      /na\s+powitanie/i,
      /welcome\s+(discount|offer|deal)/i,
      // Polish Amazon
      /oszcz[e\u0119]dzasz\s+\d/i,
      /zaoszcz[e\u0119]d[z\u017a]\s+\d/i,
      /najni[z\u017c]sza\s+cena\s+w[s\u015b]r[o\u00f3]d/i,
    ], not: [
      /regulamin/i, /polityk/i, /faktur/i,
      // Exclude product titles / descriptions — these contain ingredients, features, specs
      /\b(formula|freshness|shampoo|conditioner|moistur|ingredi|ml\b|szampon|formula)\b/i,
      /\b(universal|wielofunkcyjn|3-in-1|washing|3w1)\b/i,
      // Long product descriptions mentioning "save" incidentally
      /\b(formula|description|features?|specifications?|about\s+this)\b/i,
      // If text is a full sentence about the product itself (has "for" + noun)
      /\bfor\s+(men|women|kids|body|hair|face|skin|home)\b/i,
    ]
  },
  { type: 'Confirmshaming', must: [
      /\bno\s+thanks?,?\s+i\s+(don'?t|prefer\s+not|hate)\b/i,
      /\bi\s+don'?t\s+want\s+to\s+(save|get|receive)\b/i,
      /\bno,?\s+i\s+prefer\s+to\s+pay\s+full\s+price\b/i,
      /\bno,?\s+i\s+don'?t\s+want\s+(a\s+discount|to\s+save)\b/i,
      /nie,?\s+dzi[e\u0119]kuj[e\u0119]/i,
    ], not: []
  },
  { type: 'Sneaking', must: [
      /\bautomatically\s+(added|included|selected)\b/i,
      /\bpre[\s-]?selected\b/i,
      /\badded\s+to\s+(your\s+)?cart\s+automatically\b/i,
      /\btravel\s+insurance\s+(has\s+been\s+)?added\b/i,
      /automatycznie\s+(dodano|dodane|wybrano|zaznaczono)/i,
    ], not: [/regulamin/i]
  },
  { type: 'Trick Questions', must: [
      /\buncheck\s+(this|the)\s+box\s+if\s+you\s+do\s+NOT\b/i,
      /\buntick\s+to\s+(opt[\s-]?out|unsubscribe)\b/i,
      /\bcheck\s+(this|the)\s+box\s+if\s+you\s+do\s+NOT\s+want\b/i,
    ], not: []
  },
  { type: 'Misdirection', must: [
      /\bskip\s+free\s+trial\b/i,
      /\bcontinue\s+without\s+(the\s+)?discount\b/i,
      /\bno,?\s+i\s+don'?t\s+want\s+free\s+shipping\b/i,
      /najni[z\u017c]sza\s+cena\s+w[s\u015b]r[o\u00f3]d/i,
    ], not: []
  },
  { type: 'Forced Action', must: [
      /\byou\s+must\s+(create|sign\s+up|register|log\s+in)\s+to\s+(continue|purchase|checkout)\b/i,
      /\bcreate\s+an?\s+account\s+to\s+(continue|check\s*out|see\s+prices)\b/i,
      /\bsign\s+up\s+required\s+to\s+(continue|view|access)\b/i,
    ], not: []
  },
];

// ─── State ─────────────────────────────────────────────────────────────────────
let patterns    = [];
let cfg         = {};
let pageCtx     = null;
let activeHl    = new Set(); // indices of currently highlighted patterns

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(id)?.classList.add('active');
}

function toast(msg, ms = 2500) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), ms);
}

function setStatus(msg) {
  const el = $('statusMsg');
  if (el) el.textContent = msg;
}

// ── Scan progress bar ──────────────────────────────────────────────────────────
const PHASE_MAP = {
  'reading':     { step: 1, pct: 15, label: 'Reading page…' },
  'classifying': { step: 2, pct: 35, label: 'Classifying page…' },
  'detecting':   { step: 3, pct: 55, label: 'Detecting patterns…' },
  'vision':      { step: 4, pct: 80, label: 'AI vision scan…' },
  'ai':          { step: 4, pct: 90, label: 'AI analysis…' },
  'done':        { step: 4, pct: 100, label: 'Done!' },
};

function showProgress(show) {
  const pg = $('scanProgress'), es = $('emptyState');
  if (!pg) return;
  pg.style.display = show ? 'flex' : 'none';
  if (es) es.style.display = show ? 'none' : 'flex';
}

function setProgress(phaseKey) {
  const info = PHASE_MAP[phaseKey];
  if (!info) return;
  const bar = $('spBar'), lbl = $('spLabel');
  if (bar) bar.style.width = info.pct + '%';
  if (lbl) lbl.textContent = info.label;

  // Update step dots
  for (let i = 1; i <= 4; i++) {
    const step = $(`sp${i}`);
    const line = $(`spl${i}`);
    if (!step) continue;
    if (i < info.step)      { step.className = 'sp-step done'; if (line) line.className = 'sp-line done'; }
    else if (i === info.step) { step.className = 'sp-step active'; if (line) line.className = 'sp-line active'; }
    else                    { step.className = 'sp-step'; if (line) line.className = 'sp-line'; }
  }
}

function setEmptyState(iconId, title, sub) {
  const es = $('emptyState');
  if (!es) return;
  es.style.display = 'flex';
  const iw = es.querySelector('.empty-icon-wrap');
  if (iw) iw.innerHTML = `<svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.3"><use href="#${iconId}"/></svg>`;
  const t = es.querySelector('.empty-title');
  const s = es.querySelector('.empty-sub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
}

// ─── Config ───────────────────────────────────────────────────────────────────
async function loadCfg() {
  return new Promise(resolve => {
    chrome.storage.local.get({
      apiKey: '', model: 'gpt-4o-mini',
      aiEnabled: true, autoScan: false, highlightEnabled: true, visionEnabled: true,
    }, data => { cfg = data; resolve(data); });
  });
}

function saveCfg(newCfg, cb) {
  cfg = newCfg;
  chrome.storage.local.set(newCfg, () => {
    if (chrome.runtime.lastError) { toast('Save failed: ' + chrome.runtime.lastError.message); return; }
    if (cb) cb();
  });
}

// ─── Page classification ──────────────────────────────────────────────────────
function classifyPage(pd) {
  const all = [pd.url, pd.title, pd.metaDesc, ...(pd.headings||[]), pd.bodyText].join(' ').toLowerCase();
  if (/\b(terms|privacy|policy|regulamin|zasady|warunki|faq|help|support|rules|polityka)\b/.test(all) ||
      /\/(terms|privacy|faq|help|policy|regulamin)\b/i.test(pd.url)) return PAGE_TYPES.POLICY;
  const scores = {
    ecommerce: (/\b(cart|checkout|buy|price|koszyk|shop|sklep|order)\b/.test(all)?3:0)+(/\b(product|produkt|shipping|payment)\b/.test(all)?2:0)+(/amazon|allegro|ebay|etsy|shopify|temu/.test(all)?2:0),
    booking:   (/\b(hotel|booking|reservation|check.?in|check.?out|room|flight)\b/.test(all)?3:0)+(/booking\.com|airbnb|trivago|expedia/.test(all)?3:0),
    saas:      (/\b(subscription|plan|pricing|trial|upgrade|premium|enterprise)\b/.test(all)?3:0)+(/\b(dashboard|account|login|register)\b/.test(all)?1:0),
    news:      (/\b(article|news|blog|author|published)\b/.test(all)?2:0),
    social:    (/\b(follow|like|comment|share|profile|feed)\b/.test(all)?2:0)+(/facebook|twitter|instagram|tiktok|linkedin/.test(all)?2:0),
  };
  const best = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
  return best[1] >= 2 ? best[0] : PAGE_TYPES.OTHER;
}

// ─── GPT calls ────────────────────────────────────────────────────────────────
async function gptCall(messages, maxTokens = 300) {
  if (!cfg.apiKey) throw new Error('No API key');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model || 'gpt-4o-mini', messages, max_tokens: maxTokens, temperature: 0.1 }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error?.message || `HTTP ${r.status}`);
  }
  const d = await r.json();
  const raw = (d.choices?.[0]?.message?.content || '').trim().replace(/^```json\n?|^```\n?|```$/gm, '').trim();
  return JSON.parse(raw);
}

async function gptPageContext(pd) {
  if (!cfg.apiKey || !cfg.aiEnabled) return null;
  try {
    return await gptCall([{ role: 'user', content:
      `Analyze this webpage context for dark pattern detection. Respond ONLY as JSON.

URL: ${pd.url}
Title: ${pd.title}
Meta: ${pd.metaDesc}
Headings: ${(pd.headings||[]).slice(0,6).join(' | ')}
Text sample: ${(pd.bodyText||'').substring(0,400)}

JSON response:
{"pageType":"ecommerce|booking|saas|news|policy|social|other","language":"en|pl|other","purpose":"one sentence","sensitiveAreas":["sections that are NOT dark patterns"],"darkPatternRisk":"low|medium|high","notes":"anything useful"}`
    }]);
  } catch { return null; }
}

async function gptPattern(p, ctx) {
  if (!cfg.apiKey || !cfg.aiEnabled) return null;
  const ctxStr = ctx
    ? `Page: ${ctx.pageType}. Purpose: ${ctx.purpose||'—'}. Language: ${ctx.language||'?'}.
Non-dark-pattern sections: ${(ctx.sensitiveAreas||[]).join(', ')||'none'}.
Notes: ${ctx.notes||'—'}`
    : 'No page context.';
  try {
    return await gptCall([{ role: 'user', content:
      `You are a UX dark patterns expert. Evaluate this flagged text.

PAGE CONTEXT: ${ctxStr}

FLAGGED TEXT: "${p.text}"
Initial classification: ${p.type} — ${p.desc}

Rules: schedules, house rules, check-in times, quiet hours, opening hours are NOT dark patterns.

Respond ONLY as JSON:
{"isRealDarkPattern":true,"type":"pattern name or Not a Dark Pattern","explanation":"2-3 sentences in English","severity":"low|medium|high","confidence":0-100,"hint":"one short sentence a user can hover over to understand why this is a dark pattern"}`
    }], 280);
  } catch (e) { return { error: e.message }; }
}


// ─── Screenshot + GPT Vision analysis ────────────────────────────────────────
async function gptVisionScan(screenshotDataUrl, pageContext) {
  if (!cfg.apiKey || !cfg.aiEnabled) return [];
  // Only use vision-capable model
  const model = (cfg.model === 'gpt-4o-mini' || cfg.model === 'gpt-4o') ? 'gpt-4o' : cfg.model;
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: screenshotDataUrl, detail: 'high' },
            },
            {
              type: 'text',
              text: `You are a UX dark patterns expert analyzing a screenshot of a webpage.
Page context: ${pageContext || 'e-commerce page'}

Identify ALL dark patterns visible in this screenshot. Look specifically for:
- Crossed-out inflated original prices (e.g. "73,63zł -15%", "450,67zł -20%") — Fake Discount
- "Nowy klient" / "New customer" discount badges on every product — Fake Discount  
- "Supercena miesiąca" / "Super price of the month" labels — Fake Discount
- "200 sprzedano" / "+500 sprzedano" / sold counts — Social Proof
- "Bestseller AliExpress/Allegro" badges — Social Proof
- "Najniższa cena wśród podobnych" — Misdirection
- Countdown timers, "ends in X" — Urgency
- "Only X left" / "ostatnia sztuka" — Scarcity
- "Na powitanie · Darmowa dostawa" welcome discount banners — Fake Discount

For each dark pattern found, identify the EXACT text visible in the screenshot.

Respond ONLY as JSON array (no markdown):
[
  {
    "type": "Fake Discount|Social Proof|Urgency|Scarcity|Misdirection|Sneaking|Trick Questions|Forced Action|Confirmshaming",
    "text": "exact text visible in screenshot",
    "severity": "high|medium|low",
    "explanation": "1-2 sentences why this is a dark pattern",
    "hint": "short tooltip text for user"
  }
]
If no dark patterns found, respond: []`,
            },
          ],
        }],
      }),
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error?.message || `HTTP ${r.status}`); }
    const d = await r.json();
    const raw = (d.choices?.[0]?.message?.content || '').trim().replace(/^```json\n?|^```\n?|```$/gm, '').trim();
    const results = JSON.parse(raw);
    if (!Array.isArray(results)) return [];
    return results;
  } catch (e) {
    console.warn('[DarkScan Vision]', e.message);
    return [];
  }
}

// ─── Local detection ──────────────────────────────────────────────────────────
function detectLocally(elements, allowedTypes) {
  const found = [];
  // seenType: first detection per type (for the card shown in popup)
  // seenTypeTexts: all unique text snippets per type (for multi-highlight)
  const seenType = new Set();
  const seenText = new Set();

  const MAX_LEN = {
    'Fake Discount': 120, 'Urgency': 160, 'Scarcity': 130,
    'Social Proof': 140, 'Misdirection': 180, 'Sneaking': 220,
    'Trick Questions': 300, 'Forced Action': 300, 'Confirmshaming': 220,
  };

  for (const { text } of elements) {
    if (!text || text.length < 4) continue;
    for (const rule of RULES) {
      if (allowedTypes && !allowedTypes.includes(rule.type)) continue;
      if (text.length > (MAX_LEN[rule.type] || 300)) continue;
      if (rule.not.some(re => re.test(text))) continue;
      if (!rule.must.find(re => re.test(text))) continue;

      const snippet = text.substring(0, 140);
      const key = rule.type + '|' + snippet;
      if (seenText.has(key)) continue;
      seenText.add(key);

      const cat = CATEGORIES[rule.type];
      if (!seenType.has(rule.type)) {
        // First occurrence → create the card shown in popup
        found.push({
          type: rule.type, sev: cat.sev, desc: cat.desc, icon: cat.icon,
          text: snippet, confidence: 72 + Math.floor(Math.random() * 18),
          aiAnalysis: null, highlighted: false,
          allSnippets: [snippet],   // collect ALL snippets for multi-highlight
        });
        seenType.add(rule.type);
      } else {
        // Additional occurrence → just add snippet to existing card
        const existing = found.find(p => p.type === rule.type);
        if (existing && existing.allSnippets.length < 20) {
          existing.allSnippets.push(snippet);
        }
      }
    }
  }
  return found.sort((a,b) => ({high:0,medium:1,low:2}[a.sev] - {high:0,medium:1,low:2}[b.sev]));
}

// ─── Highlight injection (runs in page context) ───────────────────────────────
function injectHighlights(items) {
  // Remove old
  document.querySelectorAll('[data-ds-hl]').forEach(el => {
    el.removeAttribute('data-ds-hl');
    el.querySelectorAll('[data-ds-tooltip]').forEach(t => t.remove());
  });
  document.getElementById('ds-style')?.remove();

  if (!items.length) return;

  const style = document.createElement('style');
  style.id = 'ds-style';
  style.textContent = `
    [data-ds-hl] { position: relative !important; z-index: 9999 !important; }

    /* High — red, very visible */
    [data-ds-hl="high"] {
      outline: 3px solid #ff3b3b !important;
      outline-offset: 4px !important;
      box-shadow:
        0 0 0 6px rgba(255,59,59,0.25),
        0 0 18px 4px rgba(255,59,59,0.35) !important;
      background-color: rgba(255,59,59,0.08) !important;
    }
    /* Medium — amber */
    [data-ds-hl="medium"] {
      outline: 3px solid #f5a623 !important;
      outline-offset: 4px !important;
      box-shadow:
        0 0 0 6px rgba(245,166,35,0.22),
        0 0 18px 4px rgba(245,166,35,0.30) !important;
      background-color: rgba(245,166,35,0.07) !important;
    }
    /* Low — green */
    [data-ds-hl="low"] {
      outline: 3px solid #3ecf8e !important;
      outline-offset: 4px !important;
      box-shadow:
        0 0 0 6px rgba(62,207,142,0.20),
        0 0 18px 4px rgba(62,207,142,0.28) !important;
      background-color: rgba(62,207,142,0.07) !important;
    }

    /* Badge pill above the element */
    [data-ds-badge] {
      position: absolute !important;
      top: -26px !important; left: 0 !important;
      font: 700 10px/1 -apple-system, BlinkMacSystemFont, sans-serif !important;
      padding: 3px 8px !important; border-radius: 4px !important;
      white-space: nowrap !important; z-index: 2147483646 !important;
      pointer-events: none !important; text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
    }
    [data-ds-badge="high"]   { background: #ff3b3b !important; color: #fff !important; }
    [data-ds-badge="medium"] { background: #f5a623 !important; color: #000 !important; }
    [data-ds-badge="low"]    { background: #3ecf8e !important; color: #000 !important; }

    /* Tooltip on hover */
    [data-ds-tooltip] {
      display: none !important;
      position: absolute !important;
      bottom: calc(100% + 10px) !important; left: 50% !important;
      transform: translateX(-50%) !important;
      background: #111 !important; color: #f0f0f0 !important;
      font: 500 12px/1.5 -apple-system, BlinkMacSystemFont, sans-serif !important;
      padding: 8px 12px !important; border-radius: 7px !important;
      white-space: normal !important; max-width: 280px !important; min-width: 160px !important;
      box-shadow: 0 6px 24px rgba(0,0,0,0.5) !important;
      z-index: 2147483647 !important; pointer-events: none !important;
      border: 1px solid #333 !important;
      text-align: left !important;
    }
    [data-ds-tooltip]::after {
      content: '' !important; position: absolute !important;
      top: 100% !important; left: 50% !important;
      transform: translateX(-50%) !important;
      border: 6px solid transparent !important;
      border-top-color: #333 !important;
    }
    [data-ds-hl]:hover [data-ds-tooltip] { display: block !important; }

    /* Pulsing animation on high severity */
    @keyframes ds-pulse {
      0%, 100% { box-shadow: 0 0 0 6px rgba(255,59,59,0.25), 0 0 18px 4px rgba(255,59,59,0.35); }
      50%       { box-shadow: 0 0 0 8px rgba(255,59,59,0.15), 0 0 28px 8px rgba(255,59,59,0.20); }
    }
    [data-ds-hl="high"] { animation: ds-pulse 2s ease-in-out infinite !important; }

    /* Flash on scroll-to */
    @keyframes ds-flash {
      0%   { outline-width: 3px; outline-offset: 4px; }
      20%  { outline-width: 6px; outline-offset: 8px; }
      60%  { outline-width: 4px; outline-offset: 5px; }
      100% { outline-width: 3px; outline-offset: 4px; }
    }
    [data-ds-flash] {
      animation: ds-flash 0.6s ease-out !important;
      z-index: 99999 !important;
    }
    /* Overlay dimmer when flashing — dark everything except target */
    body:has([data-ds-flash])::before {
      content: '' !important;
      position: fixed !important; inset: 0 !important;
      background: rgba(0,0,0,0.35) !important;
      z-index: 99990 !important;
      pointer-events: none !important;
      animation: ds-flash-fade 1.8s ease-out forwards !important;
    }
    @keyframes ds-flash-fade {
      0%   { opacity: 1; }
      60%  { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  const candidates = Array.from(document.querySelectorAll(
    'button,a,label,strong,b,em,span,p,li,div,h1,h2,h3,h4,' +
    '[class*="badge"],[class*="urgency"],[class*="stock"],[class*="countdown"],' +
    '[class*="offer"],[class*="deal"],[class*="promo"],[class*="price"],' +
    '[class*="discount"],[class*="save"],[class*="saving"],[class*="percent"],' +
    '[class*="label"],[class*="tag"],[class*="banner"],[class*="ribbon"],' +
    '[class*="opportunit"],[class*="instant"],[class*="sale"]'
  ));

  // Helper: mark an element with highlight + badge + tooltip
  function elHasText(el) {
    // Must have actual readable text — excludes images, icons, empty wrappers
    const txt = (el.innerText || '').trim();
    return txt.length >= 3;
  }

  function markEl(el, sev, type, hint) {
    // Don't mark images or elements without text
    if (el.tagName === 'IMG' || el.tagName === 'PICTURE' || el.tagName === 'SVG') return;
    if (!elHasText(el)) return;
    // Don't double-badge same element
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

  // Helpers
  function elOk(el) {
    if (el.dataset.dsDone) return false;
    // Never highlight image elements or containers whose primary child is an image
    if (el.tagName === 'IMG' || el.tagName === 'PICTURE' || el.tagName === 'SVG') return false;
    if (el.querySelector('img, picture')) return false;
    // Must have actual text
    const txt = (el.innerText || '').trim();
    if (txt.length < 3) return false;
    const r = el.getBoundingClientRect();
    // Must be visible, small enough to be a label/badge (not a whole product card)
    return r.height >= 1 && r.height <= 80 && r.width >= 1 && r.width <= window.innerWidth * 0.75;
  }

  // Sort: smallest area first — we want leaf badge elements, not containers
  const bySize = [...candidates].sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return (ra.width * ra.height) - (rb.width * rb.height);
  });

  // Per-type max element height — prevents matching product cards instead of badges
  const TYPE_MAX_H = {
    'Fake Discount':   32,
    'Urgency':         80,
    'Scarcity':        40,
    'Social Proof':    28,
    'Sneaking':        80,
    'Misdirection':    32,
    'Trick Questions': 100,
    'Forced Action':   60,
    'Confirmshaming':  28,
  };

  items.forEach(({ snippets, words, sev, type, hint }) => {
    const maxH = TYPE_MAX_H[type] || 80;
    const allSnippets = snippets && snippets.length ? snippets : [words.slice(0,3).join(' ')];

    allSnippets.forEach(snippet => {
      const w = snippet.split(/\s+/).filter(Boolean);
      if (w.length === 0) return;
      let matched = false;

      // ── Strategy 1: element whose text contains the snippet, respecting maxH ──
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
          if (!(el.innerText || '').trim().includes(snip)) continue;
          const r = el.getBoundingClientRect();
          if (r.height > maxH) continue;
          markEl(el, sev, type, hint);
          matched = true;
          break;
        }
      }

      // ── Strategy 2: split-span walk (sibling spans share the same parent) ────
      if (!matched && w.length >= 2) {
        const w0 = w[0], w1 = w[1];
        for (const el of bySize) {
          if (el.dataset.dsDone) continue;
          if (el.tagName === 'IMG' || el.querySelector?.('img')) continue;
          const r0 = el.getBoundingClientRect();
          if (r0.height < 1 || r0.height > maxH) continue;
          if (!(el.innerText || '').includes(w0)) continue;
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

      // ── Strategy 3: specific keyword only — no generic words ─────────────────
      const GENERIC = new Set(['only','just','save','get','free','best','deal','new','last','more','sold','this','that','your','from','with','have','also','been','some','will','dont','most','over','very']);
      if (!matched) {
        const kws = w.filter(k => k.length >= 7 && !GENERIC.has(k.toLowerCase()));
        outer: for (const kw of kws) {
          const re2 = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
          for (const el of bySize) {
            if (!elOk(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.height > maxH) continue;
            if (!re2.test(el.innerText || '')) continue;
            markEl(el, sev, type, hint);
            matched = true;
            break outer;
          }
        }
      }
    }); // end allSnippets.forEach
  });

  // Cleanup temp markers
  candidates.forEach(el => delete el.dataset.dsDone);
}

function clearHighlights() {
  // Runs in page — called via executeScript
}
function _clearHighlights() {
  document.querySelectorAll('[data-ds-hl]').forEach(el => {
    el.removeAttribute('data-ds-hl');
    el.querySelectorAll('[data-ds-tooltip],[data-ds-badge]').forEach(t => t.remove());
  });
  document.getElementById('ds-style')?.remove();
}

// ─── Execute in tab ───────────────────────────────────────────────────────────
let _tabId = null;

async function execInTab(fn, args = []) {
  if (!_tabId) return;
  return chrome.scripting.executeScript({ target: { tabId: _tabId }, func: fn, args }).catch(() => {});
}

// ─── Highlight toggle logic ───────────────────────────────────────────────────
async function applyHighlights() {
  if (!_tabId) return;
  const active = patterns.filter((_, i) => activeHl.has(i));
  const items = active.map(p => ({
    snippets: (p.allSnippets || [p.text]).map(s => s.substring(0, 45)),
    words: p.text.trim().split(/\s+/).slice(0, 10),
    sev: p.sev,
    type: p.type,
    hint: p.aiAnalysis?.hint || p.aiAnalysis?.explanation?.split('.')[0] || null,
  }));

  if (items.length === 0) {
    await execInTab(_clearHighlights);
    // Clear saved state
    chrome.runtime.sendMessage({ action: 'saveHighlights', tabId: _tabId, items: [] });
    return;
  }

  // Save to background so highlights survive popup close
  chrome.runtime.sendMessage({ action: 'saveHighlights', tabId: _tabId, items });

  // Also inject via executeScript for immediate effect
  await execInTab(injectHighlights, [items]);
}


// ─── Scroll to highlighted element in page ────────────────────────────────────
function scrollToHighlight(snippet) {
  const candidates = document.querySelectorAll('[data-ds-hl]');
  let target = null;

  // First try: find by snippet text
  for (const el of candidates) {
    if ((el.innerText || '').trim().includes(snippet)) { target = el; break; }
  }
  // Fallback: first highlighted element
  if (!target) target = candidates[0];
  if (!target) return false;

  // Scroll into view with offset
  const rect = target.getBoundingClientRect();
  const scrollY = window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
  window.scrollTo({ top: scrollY, behavior: 'smooth' });

  // Flash animation: temporarily boost the highlight
  target.setAttribute('data-ds-flash', '1');
  setTimeout(() => target.removeAttribute('data-ds-flash'), 1800);
  return true;
}

async function toggleHighlight(idx, btn) {
  const wasActive = activeHl.has(idx);
  if (wasActive) {
    activeHl.delete(idx);
    btn.classList.remove('active', 'active-h', 'active-m', 'active-l');
    btn.querySelector('.hl-dot-label').textContent = 'Highlight';
    await applyHighlights();
  } else {
    activeHl.add(idx);
    const sev = patterns[idx]?.sev;
    btn.classList.add('active', `active-${sev?.[0]||'l'}`);
    btn.querySelector('.hl-dot-label').textContent = 'Highlighted';
    await applyHighlights();
    // Scroll to element after highlight is injected
    const snippet = patterns[idx]?.text?.substring(0, 45) || '';
    await execInTab(scrollToHighlight, [snippet]);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────
const SEV_LABEL = { high: 'Critical', medium: 'Warning', low: 'Info' };
const SEV_CLS   = { high: 'sev-h', medium: 'sev-m', low: 'sev-l' };
const SEV_SFXS  = { high: 'h', medium: 'm', low: 'l' };

function renderCard(p, idx) {
  const div = document.createElement('div');
  div.className = 'p-card';

  const aiTag = p.aiAnalysis
    ? (p.aiAnalysis.isRealDarkPattern === false
        ? '<span class="p-ai-tag fp">· likely false positive</span>'
        : '<span class="p-ai-tag verified">✓ AI verified</span>')
    : p.source==='vision' ? '<span class="p-ai-tag verified">👁 vision scan</span>' : '<span class="p-ai-tag">· local detection</span>';

  const isHl   = activeHl.has(idx);
  const sfx    = SEV_SFXS[p.sev];
  const hlCls  = isHl ? `active active-${sfx}` : '';
  const hlLbl  = isHl ? 'Highlighted' : 'Highlight';

  const count = p.allSnippets?.length || 1;
  const countTag = count > 1 ? `<span class="p-count">${count}×</span>` : '';

  div.innerHTML = `
    <div class="p-top">
      <span class="p-icon"><svg width="13" height="13"><use href="#${p.icon||'ic-warn'}"/></svg></span>
      <span class="p-name">${p.type}</span>
      ${countTag}
      <span class="p-sev ${SEV_CLS[p.sev]}">${SEV_LABEL[p.sev]}</span>
    </div>
    <div class="p-excerpt">${p.text}</div>
    <div class="p-footer">
      <div>${aiTag}</div>
      <button class="hl-toggle ${hlCls}" data-idx="${idx}" title="Highlight on page and scroll to it">
        <span class="hl-dot"></span>
        <svg class="hl-eye" width="10" height="10"><use href="#ic-eye"/></svg>
        <span class="hl-dot-label">${hlLbl}</span>
      </button>
    </div>`;

  // Click on main card area → detail
  div.querySelector('.p-top').addEventListener('click', () => openDetail(idx));
  div.querySelector('.p-excerpt').addEventListener('click', () => openDetail(idx));

  // Toggle button
  div.querySelector('.hl-toggle').addEventListener('click', e => {
    e.stopPropagation();
    toggleHighlight(idx, e.currentTarget);
  });

  return div;
}

function renderContextBadge(ctx) {
  const badge = $('contextBadge');
  if (!badge || !ctx) return;
  const iconMap  = { ecommerce:'ic-shop', booking:'ic-building', saas:'ic-monitor', news:'ic-file', policy:'ic-file', social:'ic-users', other:'ic-globe' };
  const labelMap = { ecommerce:'E-commerce', booking:'Booking', saas:'SaaS / App', news:'Article', policy:'Policy', social:'Social', other:'Other' };
  const riskCls  = { high:'risk-h', medium:'risk-m', low:'risk-l' }[ctx.darkPatternRisk] || 'risk-l';
  badge.style.display = 'flex';
  badge.innerHTML = `
    <svg width="12" height="12" style="color:var(--muted2)"><use href="#${iconMap[ctx.pageType]||'ic-globe'}"/></svg>
    <span class="ctx-type">${labelMap[ctx.pageType]||ctx.pageType}</span>
    <span class="ctx-sep">·</span>
    <span class="ctx-risk ${riskCls}">risk: ${ctx.darkPatternRisk||'unknown'}</span>
    ${ctx.purpose?`<span class="ctx-purpose">${ctx.purpose}</span>`:''}`;
}

function unmaskBrand() {
  const mask = document.getElementById('brandMask');
  const face = document.getElementById('brandFace');
  if (!mask || !face) return;
  mask.classList.add('falling');
  setTimeout(() => {
    mask.style.display = 'none';
    face.classList.add('visible');
  }, 480);
}

function remaskBrand() {
  const mask = document.getElementById('brandMask');
  const face = document.getElementById('brandFace');
  if (!mask || !face) return;
  face.classList.remove('visible');
  face.style.display = '';
  mask.style.display = '';
  mask.classList.remove('falling');
}

function renderResults() {
  const h = patterns.filter(p=>p.sev==='high').length;
  const m = patterns.filter(p=>p.sev==='medium').length;
  const l = patterns.filter(p=>p.sev==='low').length;
  $('sH').textContent = h; $('sM').textContent = m; $('sL').textContent = l;
  $('statsRow').style.display = 'grid';
  $('emptyState').style.display = 'none';

  const list = $('patternsList');
  list.innerHTML = ''; list.style.display = 'flex';

  unmaskBrand();

  if (!patterns.length) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon-wrap" style="color:var(--green)">
          <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.3"><use href="#ic-check"/></svg>
        </div>
        <div class="empty-title">No patterns detected</div>
        <div class="empty-sub">This page appears honest with its users</div>
      </div>`;
    return;
  }
  patterns.forEach((p, i) => list.appendChild(renderCard(p, i)));
}

// ─── Detail view ──────────────────────────────────────────────────────────────
function openDetail(idx) {
  const p = patterns[idx];
  if (!p) return;
  const col = { high:'var(--red)', medium:'var(--amber)', low:'var(--green)' }[p.sev];
  const hasKey = !!(cfg.apiKey && cfg.aiEnabled);

  let aiHTML;
  if (p.aiAnalysis) {
    if (p.aiAnalysis.error) {
      aiHTML = `<div class="ai-hint">Error: ${p.aiAnalysis.error}</div>`;
    } else if (p.aiAnalysis.isRealDarkPattern === false) {
      aiHTML = `<div class="ai-text ai-fp">AI determined this is likely <strong>not a dark pattern</strong> in this context.<br><br>${p.aiAnalysis.explanation||''}</div>`;
    } else {
      aiHTML = `<div class="ai-text">${p.aiAnalysis.explanation||'—'}</div>`;
      if (p.aiAnalysis.hint) aiHTML += `<div class="ai-hint" style="margin-top:8px">💬 ${p.aiAnalysis.hint}</div>`;
    }
  } else if (hasKey) {
    aiHTML = `<div class="ai-loading"><div class="spinner dark-spinner"></div><span>Analyzing with page context…</span></div>`;
  } else {
    aiHTML = `<div class="ai-hint">Add an OpenAI API key in Settings to enable context-aware analysis.</div>`;
  }

  const ctxLine = pageCtx
    ? `<div class="det-ctx">Context: <strong>${pageCtx.pageType}</strong>${pageCtx.purpose?' · '+pageCtx.purpose:''}</div>`
    : '';

  $('detailBody').innerHTML = `
    <div class="det-top">
      <div class="det-big-icon"><svg width="17" height="17"><use href="#${p.icon||'ic-warn'}"/></svg></div>
      <div class="det-header">
        <span class="det-sev-tag ${SEV_CLS[p.sev]}" style="border:1px solid ${col}30">${SEV_LABEL[p.sev]}</span>
        <div class="det-title">${p.type}</div>
        <div class="det-desc">${p.desc}</div>
        ${ctxLine}
      </div>
    </div>
    <div class="excerpt-box">"${p.text}"</div>
    <div class="ai-section">
      <div class="ai-head">
        <div class="ai-icon-wrap"><svg width="13" height="13"><use href="#ic-ai" stroke="#000"/></svg></div>
        <div>
          <div class="ai-label">Context-aware analysis</div>
          <div class="ai-model">${cfg.model||'gpt-4o-mini'} · OpenAI</div>
        </div>
      </div>
      <div id="aiContent">${aiHTML}</div>
      <div class="conf-row">
        <span class="conf-label">Confidence</span>
        <div class="conf-bar"><div class="conf-fill" id="confFill" style="width:0%"></div></div>
        <span class="conf-val" id="confVal">${p.confidence}%</span>
      </div>
    </div>`;

  showView('detailView');
  setTimeout(() => { const f=$('confFill'); if(f) f.style.width=`${p.confidence}%`; }, 60);

  if (!p.aiAnalysis && hasKey) {
    gptPattern(p, pageCtx).then(res => {
      if (!res) return;
      patterns[idx].aiAnalysis = res;
      if (res.confidence) patterns[idx].confidence = res.confidence;

      let html;
      if (res.error) {
        html = `<div class="ai-hint">Error: ${res.error}</div>`;
      } else if (res.isRealDarkPattern === false) {
        html = `<div class="ai-text ai-fp">AI determined this is likely <strong>not a dark pattern</strong> in this context.<br><br>${res.explanation||''}</div>`;
      } else {
        html = `<div class="ai-text">${res.explanation||'—'}</div>`;
        if (res.hint) html += `<div class="ai-hint" style="margin-top:8px">💬 ${res.hint}</div>`;
      }

      const ac = $('aiContent'), cf = $('confFill'), cv = $('confVal');
      if (ac) ac.innerHTML = html;
      if (cf) cf.style.width = `${res.confidence||p.confidence}%`;
      if (cv) cv.textContent = `${res.confidence||p.confidence}%`;

      // Update card tag
      const card = $('patternsList').querySelectorAll('.p-card')[idx];
      if (card) {
        const tag = card.querySelector('.p-ai-tag');
        if (tag) {
          tag.className = res.isRealDarkPattern===false ? 'p-ai-tag fp' : 'p-ai-tag verified';
          tag.textContent = res.isRealDarkPattern===false ? '· likely false positive' : '✓ AI verified';
        }
      }

      // Re-apply highlights to include hint in tooltip
      if (activeHl.has(idx)) applyHighlights();
    });
  }
}

// ─── Page data extraction ─────────────────────────────────────────────────────
function extractPageData() {
  const title    = document.title || '';
  const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
  const url      = location.href;
  const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
    .map(h=>(h.innerText||'').trim()).filter(t=>t.length>2&&t.length<100).slice(0,10);
  const bodyText = (document.body?.innerText||'').replace(/\s+/g,' ').substring(0,1200);
  const selectors = [
    'button','a','label','[role="button"]',
    '[class*="badge"],[class*="urgency"],[class*="countdown"],[class*="timer"]',
    '[class*="stock"],[class*="scarc"],[class*="popular"],[class*="sold"]',
    '[class*="cart"],[class*="checkout"],[class*="deal"],[class*="offer"]',
    '[class*="promo"],[class*="sale"],[class*="discount"]',
    'strong','b','span','small','h1','h2','h3','h4','p','li','legend',
  ].join(',');
  const seen = new Set(), elements = [];
  document.querySelectorAll(selectors).forEach(el => {
    if (el.offsetParent === null) return;
    const txt = (el.innerText||'').trim().replace(/\s+/g,' ');
    if (!txt||txt.length<8||txt.length>400||seen.has(txt)) return;
    seen.add(txt);
    elements.push({ text: txt });
  });
  return { title, metaDesc, url, headings, bodyText, elements: elements.slice(0,500), viewportW: window.innerWidth, viewportH: window.innerHeight };
}

// ─── Background scan events ───────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action !== 'scanEvent') return;
  if (msg.tabId !== _tabId) return;
  const { event, data } = msg;

  if (event === 'phase') {
    pageCtx = pageCtx; // keep
    const phaseKey = data.phase;
    setProgress(phaseKey);
    showProgress(true);
    setStatus(data.label || '');
  }
  if (event === 'context') {
    pageCtx = data.pageCtx;
    renderContextBadge(pageCtx);
  }
  if (event === 'patterns') {
    patterns = data.patterns;
    if (cfg.highlightEnabled) {
      patterns.forEach((_, i) => activeHl.add(i));
    }
    if (activeHl.size > 0) applyHighlights();
  }
  if (event === 'patternAnalysis') {
    if (patterns[data.idx]) {
      patterns[data.idx].aiAnalysis = data.analysis;
      // Refresh card tag
      const card = $('patternsList').querySelectorAll('.p-card')[data.idx];
      if (card) {
        const tag = card.querySelector('.p-ai-tag');
        if (tag) {
          tag.className = data.analysis.isRealDarkPattern === false ? 'p-ai-tag fp' : 'p-ai-tag verified';
          tag.textContent = data.analysis.isRealDarkPattern === false ? '· likely false positive' : '✓ AI verified';
        }
      }
      // Refresh detail view if open
      const dv = $('detailView');
      if (dv && dv.style.display !== 'none') {
        const idx = parseInt(dv.dataset.idx || '-1');
        if (idx === data.idx) openDetail(idx);
      }
    }
  }
  if (event === 'done') {
    patterns = data.patterns;
    pageCtx  = data.pageCtx || pageCtx;
    setProgress('done');
    setTimeout(() => { showProgress(false); renderResults(); }, 400);
    scanFinally();
  }
  if (event === 'error') {
    showProgress(false);
    const restricted = /Cannot access|chrome:|about:|extension/.test(data.error || '');
    const msg2 = restricted ? 'Cannot scan this page type.' : (data.error || 'Unknown error');
    toast('⚠ ' + msg2);
    setEmptyState('ic-warn', 'Scan error', msg2);
    scanFinally();
  }
});

function scanFinally() {
  try {
    const b = $('scanBtn'); if (b) b.disabled = false;
    const s = document.querySelector('#scanIcon.spinner') || $('scanIcon');
    if (s) {
      const ico = document.createElement('span'); ico.id = 'scanIcon';
      ico.innerHTML = '<svg width="14" height="14"><use href="#ic-cursor"/></svg>';
      s.replaceWith(ico);
    }
    const l = $('scanLabel'); if (l) l.textContent = 'Scan again';
    setStatus('');
  } catch (_) {}
}

// ─── Main scan ────────────────────────────────────────────────────────────────
async function scan() {
  const btn = $('scanBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  activeHl.clear();
  patterns = [];
  pageCtx  = null;
  remaskBrand();

  // Spinner in button
  const iconEl = $('scanIcon');
  if (iconEl) {
    const sp = document.createElement('div');
    sp.className = 'spinner'; sp.id = 'scanIcon';
    sp.style.cssText = 'border-color:rgba(0,0,0,0.15);border-top-color:#000;flex-shrink:0';
    iconEl.replaceWith(sp);
  }
  $('scanLabel').textContent = 'Scanning…';

  // Reset UI
  $('statsRow').style.display = 'none';
  $('patternsList').style.display = 'none';
  $('patternsList').innerHTML = '';
  $('contextBadge').style.display = 'none';
  showProgress(false);
  setEmptyState('ic-scan','Ready…','');
  setStatus('');

  try {
    const tabs = await chrome.tabs.query({ active:true, currentWindow:true });
    const tab  = tabs?.[0];
    if (!tab?.id) throw new Error('No active tab');
    _tabId = tab.id;

    // Delegate entire scan to background service worker
    // Background survives popup close / tab switching
    chrome.runtime.sendMessage({
      action: 'startScan',
      tabId: _tabId,
      cfg: {
        apiKey:        cfg.apiKey || '',
        model:         cfg.model || 'gpt-4o-mini',
        aiEnabled:     cfg.aiEnabled !== false,
        visionEnabled: cfg.visionEnabled !== false,
      }
    });

    // Background will fire scanEvent messages back to popup as it progresses
    // scanFinally() is called on 'done' or 'error' events

  } catch (err) {
    const restricted = /Cannot access|chrome:|about:|extension/.test(err.message || '');
    toast('⚠ ' + (restricted ? 'Cannot scan this page type.' : err.message));
    setEmptyState('ic-warn', 'Scan error', err.message);
    scanFinally();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadCfg();

  // Current tab URL
  chrome.tabs.query({ active:true, currentWindow:true }, tabs => {
    const el = $('currentUrl');
    if (!el) return;
    try { el.textContent = new URL(tabs?.[0]?.url||'').hostname || 'Unknown'; }
    catch { el.textContent = 'Unknown page'; }
  });

  // Populate settings
  const ai = $('apiKeyInput'), ms = $('modelSelect'),
        at = $('aiToggle'),   as_ = $('autoScanToggle'), ht = $('highlightToggle');
  if (ai)  ai.value   = cfg.apiKey || '';
  if (ms)  ms.value   = cfg.model  || 'gpt-4o-mini';
  if (at)  at.checked = cfg.aiEnabled !== false;
  if (as_) as_.checked = !!cfg.autoScan;
  if (ht)  ht.checked = cfg.highlightEnabled !== false;
  const vt = $('visionToggle');
  if (vt)  vt.checked = cfg.visionEnabled !== false;

  $('scanBtn')?.addEventListener('click', scan);
  $('openSettings')?.addEventListener('click', () => showView('settingsView'));
  $('backSettings')?.addEventListener('click', () => showView('mainView'));
  $('backDetail')?.addEventListener('click',   () => showView('mainView'));

  $('saveSettings')?.addEventListener('click', () => {
    const newCfg = {
      apiKey:           (ai?.value||'').trim(),
      model:            ms?.value || 'gpt-4o-mini',
      aiEnabled:        at?.checked !== false,
      autoScan:         !!as_?.checked,
      highlightEnabled: ht?.checked !== false,
      visionEnabled:    $('visionToggle')?.checked !== false,
    };
    const saveBtn = $('saveSettings');
    if (saveBtn) saveBtn.disabled = true;
    saveCfg(newCfg, () => {
      if (!saveBtn) return;
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<svg width="14" height="14"><use href="#ic-check" stroke="#000"/></svg> Saved!';
      setTimeout(() => {
        saveBtn.innerHTML = '<svg width="14" height="14"><use href="#ic-save" stroke="#000"/></svg> Save settings';
        showView('mainView');
      }, 1000);
    });
  });

  if (cfg.autoScan) setTimeout(scan, 300);
});
