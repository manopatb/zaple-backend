# ZAPLE Backend API

Serverless API backend for ZAPLE. Runs on Vercel. Holds the Claude API key securely.

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/compress` | POST | Compress a prompt to English shorthand |
| `/api/expand` | POST | Expand English shorthand to user language |
| `/api/health` | GET | Health check |

## Compress request

```json
POST /api/compress
{
  "text": "สวัสดีครับ อยากทำข้าวมันไก่...",
  "source": "web"
}
```

## Compress response

```json
{
  "compressed": "Khao man gai recipe. Never made. Step by step.",
  "originalTokens": 101,
  "compressedTokens": 36,
  "saved": 65,
  "pct": 64,
  "lang": "Thai",
  "source": "web"
}
```

## Deploy to Vercel (5 minutes)

### Step 1 — Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2 — Login to Vercel
```bash
vercel login
```
Sign in with GitHub, Google, or email.

### Step 3 — Deploy
```bash
cd zaple-backend
vercel
```
Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N**
- Project name: **zaple-backend**
- Directory: **./**
- Override settings? **N**

### Step 4 — Add your API key (IMPORTANT)
Go to **vercel.com/dashboard** → your project → **Settings** → **Environment Variables**

Add:
```
Name:  ANTHROPIC_API_KEY
Value: sk-ant-your-real-key-here
```

Click Save. Then redeploy:
```bash
vercel --prod
```

### Step 5 — Test it
```bash
curl -X POST https://zaple-backend.vercel.app/api/compress \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello! I was wondering if you could help me with something please?"}'
```

Expected response:
```json
{"compressed":"Help needed.","originalTokens":18,"compressedTokens":3,"saved":15,"pct":83}
```

## Update the Chrome extension

In `background.js`, replace the direct Claude API call with:
```javascript
var ZAPLE_API = 'https://zaple-backend.vercel.app';

fetch(ZAPLE_API + '/api/compress', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: msg.text, source: 'extension' })
})
```

Users no longer need their own API key.

## Update the website live demo

In `zaple-landing.html`, replace the local compress() function call with:
```javascript
fetch('https://zaple-backend.vercel.app/api/compress', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: input, source: 'web-demo' })
})
.then(r => r.json())
.then(data => {
  document.getElementById('compressed-out').textContent = data.compressed;
  document.getElementById('tok-before').textContent = data.originalTokens + ' tokens';
  document.getElementById('tok-after').textContent = data.compressedTokens + ' tokens';
  document.getElementById('pct-badge').textContent = '⚡ ' + data.pct + '% saved';
});
```

## Rate limiting

The free tier allows 20 compressions per IP per day.
This protects your API bill during public launch.
Increase the FREE_LIMIT constant in api/compress.js when ready.

## Cost estimate

- Claude Haiku: $0.25 per 1M input tokens
- Average compression call: ~150 tokens input + 30 tokens output
- Cost per compression: ~$0.000045
- 10,000 free daily compressions: ~$0.45/day
