'use strict';
// ─── Background service worker — persists when popup is closed ─────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['apiKey'], () => {});
});

// ─── Active scans: tabId → { status, patterns, pageCtx, cfg } ─────────────────
const scans = {};

// ─── Message broker ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // ── Popup: start a scan for a tab ─────────────────────────────────────────
  if (msg.action === 'startScan') {
    const { tabId, cfg } = msg;
    startScan(tabId, cfg);
    sendResponse({ ok: true });
    return true;
  }

  // ── Popup: get current scan state ─────────────────────────────────────────
  if (msg.action === 'getScanState') {
    const { tabId } = msg;
    sendResponse(scans[tabId] || { status: 'idle' });
    return true;
  }

  // ── Highlights: save state ─────────────────────────────────────────────────
  if (msg.action === 'saveHighlights') {
    const { tabId, items } = msg;
    const key = `hl_${tabId}`;
    if (!items || items.length === 0) {
      chrome.storage.local.remove(key);
    } else {
      chrome.storage.local.set({ [key]: { items, ts: Date.now() } });
    }
    sendResponse({ ok: true });
    return true;
  }

  // ── Content script: get saved highlights ──────────────────────────────────
  if (msg.action === 'getHighlights') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ items: null }); return true; }
    const key = `hl_${tabId}`;
    chrome.storage.local.get(key, data => {
      const saved = data[key];
      if (saved && Date.now() - saved.ts < 30 * 60 * 1000) {
        sendResponse({ items: saved.items });
      } else {
        chrome.storage.local.remove(key);
        sendResponse({ items: null });
      }
    });
    return true;
  }

  // ── Screenshot capture (called from background scan) ──────────────────────
  if (msg.action === 'captureTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 75 })
      .then(url => sendResponse({ ok: true, url }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

// ─── Tab navigation: clear stale state ────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    chrome.storage.local.remove(`hl_${tabId}`);
    delete scans[tabId];
  }
  // Re-apply highlights after page loads
  if (changeInfo.status === 'complete') {
    const key = `hl_${tabId}`;
    chrome.storage.local.get(key, data => {
      const saved = data[key];
      if (!saved || Date.now() - saved.ts > 30 * 60 * 1000 || !saved.items?.length) return;
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: 'applyHighlights', items: saved.items }).catch(() => {});
      }, 800);
    });
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  const key = `hl_${tabId}`;
  chrome.storage.local.get(key, data => {
    const saved = data[key];
    if (!saved || Date.now() - saved.ts > 30 * 60 * 1000 || !saved.items?.length) return;
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: 'applyHighlights', items: saved.items }).catch(() => {});
    }, 200);
  });
});

// ─── GPT helper (runs in background, survives popup close) ────────────────────
async function gptCall(apiKey, model, messages, maxTokens = 300) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: model || 'gpt-4o-mini', messages, max_tokens: maxTokens, temperature: 0.1 }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error?.message || `HTTP ${r.status}`);
  }
  const d = await r.json();
  const raw = (d.choices?.[0]?.message?.content || '').trim().replace(/^```json\n?|^```\n?|```$/gm, '').trim();
  return JSON.parse(raw);
}

// ─── Notify popup if open ─────────────────────────────────────────────────────
function notifyPopup(tabId, event, data) {
  chrome.runtime.sendMessage({ action: 'scanEvent', tabId, event, data }).catch(() => {});
}

// ─── Main scan (runs entirely in background) ───────────────────────────────────
async function startScan(tabId, cfg) {
  scans[tabId] = { status: 'scanning', phase: 'reading', patterns: [], pageCtx: null };
  notifyPopup(tabId, 'phase', { phase: 'reading', label: 'Phase 1/4: reading page' });

  try {
    // Phase 1: extract page data via content script
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageDataFn,
    });
    const pd = res?.result;
    if (!pd?.elements?.length) throw new Error('Could not read page content');
    scans[tabId].pd = pd;

    notifyPopup(tabId, 'phase', { phase: 'classifying', label: 'Phase 2/4: classifying' });

    // Phase 2: classify locally
    const localType = classifyPageFn(pd);
    const allowedTypes = ALLOWED_TYPES[localType] || ALLOWED_TYPES.other;
    const pageCtx = { pageType: localType, purpose: null, sensitiveAreas: [], darkPatternRisk: 'medium', notes: '' };
    scans[tabId].pageCtx = pageCtx;
    notifyPopup(tabId, 'context', { pageCtx });

    // Phase 3: detect locally
    notifyPopup(tabId, 'phase', { phase: 'detecting', label: 'Phase 3/4: detecting patterns' });
    const patterns = detectLocallyFn(pd.elements, allowedTypes);
    scans[tabId].patterns = patterns;
    notifyPopup(tabId, 'patterns', { patterns });

    // Phase 3b: GPT page context (background, non-blocking)
    if (cfg.apiKey && cfg.aiEnabled) {
      gptPageContextFn(pd, cfg).then(ctx => {
        if (ctx) {
          scans[tabId].pageCtx = { ...pageCtx, ...ctx };
          notifyPopup(tabId, 'context', { pageCtx: scans[tabId].pageCtx });
        }
      }).catch(() => {});
    }

    // Phase 4: Vision scan via screenshot
    if (cfg.apiKey && cfg.aiEnabled && cfg.visionEnabled !== false) {
      notifyPopup(tabId, 'phase', { phase: 'vision', label: 'Phase 4/4: vision scan…' });
      try {
        const screenshot = await chrome.tabs.captureVisibleTab(tabId, { format: 'jpeg', quality: 75 });
        const ctxStr = `${localType} page`;
        const visionResults = await gptVisionScanFn(screenshot, ctxStr, cfg);
        const foundTypes = new Set(patterns.map(p => p.type));
        for (const vr of visionResults) {
          if (!CATEGORIES[vr.type]) continue;
          if (!allowedTypes.includes(vr.type)) continue;
          const cat = CATEGORIES[vr.type];
          if (!foundTypes.has(vr.type)) {
            patterns.push({
              type: vr.type, sev: vr.severity || cat.sev,
              desc: cat.desc, icon: cat.icon,
              text: vr.text || '(detected visually)',
              confidence: 85, source: 'vision',
              allSnippets: [vr.text || ''],
              aiAnalysis: {
                isRealDarkPattern: true, type: vr.type,
                explanation: vr.explanation, hint: vr.hint,
                severity: vr.severity, confidence: 85, source: 'vision',
              },
            });
            foundTypes.add(vr.type);
          }
        }
        patterns.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.sev] - { high: 0, medium: 1, low: 2 }[b.sev]));
        scans[tabId].patterns = patterns;
        notifyPopup(tabId, 'patterns', { patterns });
      } catch (ve) {
        console.warn('[BG Vision]', ve.message);
      }
    }

    // GPT per-pattern analysis (background, updates popup as each finishes)
    if (cfg.apiKey && cfg.aiEnabled) {
      patterns.forEach((p, idx) => {
        if (p.aiAnalysis) return; // already has analysis (vision)
        gptPatternFn(p, scans[tabId].pageCtx, cfg).then(res => {
          if (!res || !scans[tabId]) return;
          scans[tabId].patterns[idx].aiAnalysis = res;
          if (res.confidence) scans[tabId].patterns[idx].confidence = res.confidence;
          notifyPopup(tabId, 'patternAnalysis', { idx, analysis: res });
          // Update highlights with new hint
          const hlKey = `hl_${tabId}`;
          chrome.storage.local.get(hlKey, data => {
            const saved = data[hlKey];
            if (saved?.items) {
              // Update hint for this pattern type
              const item = saved.items.find(i => i.type === p.type);
              if (item) {
                item.hint = res.hint || res.explanation?.split('.')[0] || item.hint;
                chrome.storage.local.set({ [hlKey]: saved });
                chrome.tabs.sendMessage(tabId, { action: 'applyHighlights', items: saved.items }).catch(() => {});
              }
            }
          });
        }).catch(() => {});
      });
    }

    scans[tabId].status = 'done';
    notifyPopup(tabId, 'done', { patterns, pageCtx: scans[tabId].pageCtx });

  } catch (err) {
    scans[tabId] = { status: 'error', error: err.message };
    notifyPopup(tabId, 'error', { error: err.message });
  }
}

// ─── Functions that run in background (not injected) ──────────────────────────

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

const ALLOWED_TYPES = {
  ecommerce: ['Urgency','Scarcity','Social Proof','Sneaking','Trick Questions','Misdirection','Forced Action','Confirmshaming','Fake Discount'],
  booking:   ['Urgency','Scarcity','Social Proof','Sneaking','Misdirection','Forced Action','Fake Discount'],
  saas:      ['Urgency','Scarcity','Trick Questions','Misdirection','Forced Action','Confirmshaming','Sneaking'],
  news:      ['Misdirection','Forced Action'],
  policy:    [],
  social:    ['Forced Action','Trick Questions'],
  other:     ['Urgency','Scarcity','Social Proof','Confirmshaming','Forced Action','Fake Discount'],
};

function classifyPageFn(pd) {
  const all = [pd.url, pd.title, pd.metaDesc, ...(pd.headings||[]), pd.bodyText].join(' ').toLowerCase();
  if (/\b(terms|privacy|policy|regulamin|zasady|warunki|faq|help|polityka)\b/.test(all) ||
      /\/(terms|privacy|faq|help|policy|regulamin)\b/i.test(pd.url)) return 'policy';
  const scores = {
    ecommerce: (/\b(cart|checkout|buy|price|koszyk|shop|sklep|order)\b/.test(all)?3:0)+(/amazon|allegro|ebay|etsy|temu/.test(all)?2:0),
    booking:   (/\b(hotel|booking|reservation|check.?in|room|flight)\b/.test(all)?3:0)+(/booking\.com|airbnb/.test(all)?3:0),
    saas:      (/\b(subscription|plan|pricing|trial|upgrade|premium)\b/.test(all)?3:0),
    news:      (/\b(article|news|blog|author|published)\b/.test(all)?2:0),
    social:    (/\b(follow|like|comment|share|profile|feed)\b/.test(all)?2:0),
  };
  const best = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
  return best[1] >= 2 ? best[0] : 'other';
}

const RULES_BG = [
  { type:'Urgency', must:[/\bonly\s+\d+\s+(left|remaining)\b/i,/\bhurry[\s!,]/i,/\blimited[\s-]time\s+(offer|deal)\b/i,/\bact\s+now\b/i,/\blast\s+chance\b/i,/\bselling\s+out\s+fast\b/i,/posp[ie][es]sz\s+si[eę]/i,/tylko\s+(dzi[sś]|dzisiaj|teraz)/i,/oferta\s+(wygasa|ko[nń]czy)/i,/\bflash\s+sale\b/i,/\boferta\s+dnia\b/i], not:[/\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/,/godzin[ay]/i,/cisza\s+nocna/i,/harmonogram/i]},
  { type:'Scarcity', must:[/\bonly\s+\d+\s+in\s+stock\b/i,/\blow\s+stock\b/i,/\balmost\s+gone\b/i,/ostatni[ae]\s+(sztuk[ai]|para)/i,/prawie\s+wyprzedane/i,/tylko\s+\d+\s+sztuk/i], not:[/regulamin/i]},
  { type:'Social Proof', must:[/\bbestseller\b/i,/[+]?\d+\s+sprzedano/i,/\d+\s+(kupiono|zamówień)/i,/bestseller\s+aliexpress/i,/najpopularniejsz[yi]/i,/\b\d+\s+orders?\b/i], not:[]},
  { type:'Fake Discount', must:[/\d[\d,.]*\s*z[lł]\s+[-–]\d{1,3}%/,/\byou\s+save\s+\d+%/i,/\binstant\s+opportunity\b/i,/supercen[ay]/i,/nowy\s+klient/i,/najniższa\s+cena\s+wśród/i,/oszczędzasz\s+\d/i], not:[/regulamin/i,/\b(formula|freshness|shampoo|3-in-1|for\s+(men|women|body|hair))\b/i]},
  { type:'Confirmshaming', must:[/\bno\s+thanks?,?\s+i\s+(don'?t|prefer\s+not)\b/i,/\bi\s+don'?t\s+want\s+to\s+(save|get)\b/i,/nie,?\s+dziękuję/i], not:[]},
  { type:'Sneaking', must:[/\bautomatically\s+(added|selected)\b/i,/\bpre[\s-]?selected\b/i,/automatycznie\s+(dodano|zaznaczono)/i], not:[/regulamin/i]},
  { type:'Misdirection', must:[/\bskip\s+free\s+trial\b/i,/najniższa\s+cena\s+wśród/i], not:[]},
  { type:'Forced Action', must:[/\byou\s+must\s+(create|sign\s+up)\s+to\s+(continue|purchase)\b/i,/musisz\s+założyć\s+konto/i], not:[]},
];

const MAX_LEN_BG = {'Fake Discount':120,'Urgency':160,'Scarcity':130,'Social Proof':140,'Misdirection':180,'Sneaking':220,'Trick Questions':300,'Forced Action':300,'Confirmshaming':220};

function detectLocallyFn(elements, allowedTypes) {
  const found=[], seenType=new Set(), seenText=new Set();
  for (const {text} of elements) {
    if (!text||text.length<4) continue;
    for (const rule of RULES_BG) {
      if (!allowedTypes.includes(rule.type)) continue;
      if (text.length>(MAX_LEN_BG[rule.type]||300)) continue;
      if (rule.not.some(re=>re.test(text))) continue;
      if (!rule.must.find(re=>re.test(text))) continue;
      const snippet=text.substring(0,140);
      const key=rule.type+'|'+snippet;
      if (seenText.has(key)) continue;
      seenText.add(key);
      const cat=CATEGORIES[rule.type];
      if (!seenType.has(rule.type)) {
        found.push({type:rule.type,sev:cat.sev,desc:cat.desc,icon:cat.icon,text:snippet,confidence:72+Math.floor(Math.random()*18),aiAnalysis:null,highlighted:false,allSnippets:[snippet]});
        seenType.add(rule.type);
      } else {
        const ex=found.find(p=>p.type===rule.type);
        if (ex&&ex.allSnippets.length<20) ex.allSnippets.push(snippet);
      }
    }
  }
  return found.sort((a,b)=>({high:0,medium:1,low:2}[a.sev]-{high:0,medium:1,low:2}[b.sev]));
}

async function gptPageContextFn(pd, cfg) {
  try {
    return await gptCall(cfg.apiKey, cfg.model, [{ role:'user', content:
      `Analyze this webpage for dark pattern detection. Respond ONLY as JSON.\nURL: ${pd.url}\nTitle: ${pd.title}\nMeta: ${pd.metaDesc}\nHeadings: ${(pd.headings||[]).slice(0,6).join(' | ')}\nText: ${(pd.bodyText||'').substring(0,400)}\n{"pageType":"ecommerce|booking|saas|news|policy|social|other","language":"en|pl|other","purpose":"one sentence","sensitiveAreas":[],"darkPatternRisk":"low|medium|high","notes":""}`
    }]);
  } catch { return null; }
}

async function gptPatternFn(p, ctx, cfg) {
  const ctxStr = ctx ? `Page: ${ctx.pageType}. Purpose: ${ctx.purpose||'—'}. Notes: ${ctx.notes||'—'}` : 'No page context.';
  try {
    return await gptCall(cfg.apiKey, cfg.model, [{ role:'user', content:
      `You are a UX dark patterns expert. Evaluate this flagged text.\nPAGE CONTEXT: ${ctxStr}\nFLAGGED TEXT: "${p.text}"\nInitial: ${p.type} — ${p.desc}\nRules: schedules, opening hours, check-in times are NOT dark patterns.\nRespond ONLY as JSON:\n{"isRealDarkPattern":true,"type":"pattern name or Not a Dark Pattern","explanation":"2-3 sentences","severity":"low|medium|high","confidence":0-100,"hint":"short tooltip why this is a dark pattern"}`
    }], 280);
  } catch(e) { return {error:e.message}; }
}

async function gptVisionScanFn(screenshotDataUrl, pageContext, cfg) {
  const model = (cfg.model==='gpt-4o-mini'||cfg.model==='gpt-4o') ? 'gpt-4o' : cfg.model;
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${cfg.apiKey}`},
      body: JSON.stringify({ model, max_tokens:800, temperature:0.1, messages:[{role:'user',content:[
        {type:'image_url',image_url:{url:screenshotDataUrl,detail:'high'}},
        {type:'text',text:`You are a UX dark patterns expert. Identify ALL dark patterns visible in this screenshot of a ${pageContext}.\nLook for: crossed-out inflated prices, "Nowy klient" badges, "Supercena miesiąca", sold counts, countdown timers, "only X left".\nRespond ONLY as JSON array (no markdown):\n[{"type":"Fake Discount|Social Proof|Urgency|Scarcity|Misdirection|Sneaking|Trick Questions|Forced Action|Confirmshaming","text":"exact text","severity":"high|medium|low","explanation":"1-2 sentences","hint":"short tooltip"}]\nIf none: []`}
      ]}]}),
    });
    if (!r.ok) return [];
    const d = await r.json();
    const raw = (d.choices?.[0]?.message?.content||'').trim().replace(/^```json\n?|^```\n?|```$/gm,'').trim();
    const results = JSON.parse(raw);
    return Array.isArray(results) ? results : [];
  } catch { return []; }
}

// extractPageData must be serializable — defined as standalone function
function extractPageDataFn() {
  const title=document.title||'';
  const metaDesc=document.querySelector('meta[name="description"]')?.content||'';
  const url=location.href;
  const headings=Array.from(document.querySelectorAll('h1,h2,h3')).map(h=>(h.innerText||'').trim()).filter(t=>t.length>2&&t.length<100).slice(0,10);
  const bodyText=(document.body?.innerText||'').replace(/\s+/g,' ').substring(0,1200);
  const selectors=['button','a','label','[role="button"]','[class*="badge"],[class*="urgency"],[class*="countdown"],[class*="timer"]','[class*="stock"],[class*="popular"],[class*="sold"]','[class*="cart"],[class*="deal"],[class*="offer"],[class*="promo"],[class*="sale"],[class*="discount"]','strong','b','span','small','h1','h2','h3','h4','p','li'].join(',');
  const seen=new Set(),elements=[];
  document.querySelectorAll(selectors).forEach(el=>{
    if(el.offsetParent===null)return;
    const txt=(el.innerText||'').trim().replace(/\s+/g,' ');
    if(!txt||txt.length<8||txt.length>400||seen.has(txt))return;
    seen.add(txt);elements.push({text:txt});
  });
  return {title,metaDesc,url,headings,bodyText,elements:elements.slice(0,500)};
}
