// api/expand.js
// ZAPLE expansion endpoint — converts dense English shorthand back to user language

const CLAUDE_MODEL  = 'claude-haiku-4-5-20251001';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const LANG_NAMES = {
  th: 'Thai', zh: 'Chinese', ja: 'Japanese',
  ko: 'Korean', ar: 'Arabic', en: 'English',
};

function buildExpandPrompt(lang) {
  const langName = LANG_NAMES[lang] || 'English';
  return `You are a response formatter. Expand the following dense English shorthand into a complete, natural, helpful response in ${langName}.

Rules:
- Write in natural ${langName} — warm, clear, complete sentences
- Include all information from the shorthand — do not add anything new
- Sound like a helpful assistant, not a machine
- Output ONLY the expanded ${langName} response — no explanation, no preamble`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, lang } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Missing text' });

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
        max_tokens: 1024,
        system:     buildExpandPrompt(lang || 'en'),
        messages:   [{ role: 'user', content: text }],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: 'Expansion failed' });

    return res.status(200).json({ expanded: data.content[0].text.trim() });

  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
