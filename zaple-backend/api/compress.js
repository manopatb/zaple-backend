// api/compress.js
// ZAPLE compression endpoint
// Holds the Claude API key server-side — never exposed to users

const CLAUDE_MODEL  = 'claude-haiku-4-5-20251001';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// ── Rate limiting (simple in-memory, resets per serverless instance) ──────
const CALLS = {};
const FREE_LIMIT = 20; // free calls per IP per day

function getRateKey(ip) {
  const day = new Date().toISOString().slice(0, 10);
  return `${ip}:${day}`;
}

function isRateLimited(ip) {
  const key = getRateKey(ip);
  CALLS[key] = (CALLS[key] || 0) + 1;
  return CALLS[key] > FREE_LIMIT;
}

// ── Language detection ────────────────────────────────────────────────────
function detectLang(text) {
  const thai    = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
  const chinese = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
  const japanese= (text.match(/[\u3040-\u30FF]/g) || []).length;
  const korean  = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const arabic  = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const total   = text.length || 1;

  if (thai    / total > 0.12) return 'Thai';
  if (chinese / total > 0.12) return 'Chinese';
  if (japanese/ total > 0.08) return 'Japanese';
  if (korean  / total > 0.12) return 'Korean';
  if (arabic  / total > 0.12) return 'Arabic';
  return 'English';
}

// ── Token estimator ───────────────────────────────────────────────────────
function estimateTokens(text) {
  const thai  = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
  const cjk   = (text.match(/[\u3000-\u9FFF\uAC00-\uD7AF]/g) || []).length;
  const other = text.length - thai - cjk;
  return Math.max(1, Math.ceil((other / 4) + (thai / 1.5) + (cjk / 1.5)));
}

// ── System prompt ─────────────────────────────────────────────────────────
function buildSystemPrompt(lang) {
  return `You are a prompt compressor. Rewrite the user's ${lang} text as short English shorthand that keeps the full meaning and intent.

Rules:
- Remove ALL greetings, thank yous, apologies, politeness, filler phrases
- Keep: core question/request, names, numbers, dates, locations, URLs, code
- Output ONLY the compressed English text — no explanation, no preamble
- Use simple direct English. As short as possible while preserving full intent.

Example input (Thai): "สวัสดีครับ อยากทำข้าวมันไก่กินเองที่บ้านครับ ไม่เคยทำเลย ช่วยบอกวิธีทำแบบละเอียดหน่อยได้ไหมครับ ขอบคุณมากครับ"
Example output: "Khao man gai recipe. Never made. Step by step."`;
}

// ── Main handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get client IP for rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
             req.headers['x-real-ip'] || 
             'unknown';

  // Rate limit check
  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: 'rate_limited',
      message: 'Free daily limit reached. Install ZAPLE Pro for unlimited compression.',
    });
  }

  const { text, source } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing text field' });
  }

  if (text.length > 5000) {
    return res.status(400).json({ error: 'Text too long (max 5000 chars)' });
  }

  const lang           = detectLang(text);
  const originalTokens = estimateTokens(text);

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 500,
        system:     buildSystemPrompt(lang),
        messages:   [{ role: 'user', content: text }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Claude error:', data.error);
      return res.status(500).json({ error: 'Compression failed' });
    }

    const compressed       = data.content[0].text.trim();
    const compressedTokens = estimateTokens(compressed);
    const saved            = Math.max(0, originalTokens - compressedTokens);
    const pct              = Math.max(0, Math.round((saved / originalTokens) * 100));

    return res.status(200).json({
      compressed,
      originalTokens,
      compressedTokens,
      saved,
      pct,
      lang,
      source: source || 'web',
    });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
