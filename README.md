# YourMate — Vercel Deployment

## Project Structure
```
yourmate/
├── api/
│   └── proxy.js        ← Vercel serverless function (CORS proxy)
├── public/
│   └── index.html      ← Your frontend app
├── vercel.json         ← Vercel routing config
└── README.md
```

## Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "YourMate initial deploy"
git remote add origin https://github.com/YOUR_USERNAME/yourmate.git
git push -u origin main
```

### 2. Import on Vercel
- Go to https://vercel.com/new
- Import your GitHub repo
- Click **Deploy** (no build settings needed)

### 3. Add Environment Variable
- Vercel Dashboard → Your Project → **Settings → Environment Variables**
- Add: `GAS_URL` = `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`
- Click **Save**
- Vercel auto-redeploys

### 4. Done!
Your app at `https://yourmate.vercel.app` now proxies all API calls through `/api/proxy` — no CORS issues.

## How It Works
```
Browser  →  /api/proxy (Vercel)  →  Google Apps Script
         ←  JSON response        ←
```
The proxy runs server-side, so the browser never touches GAS directly — CORS is irrelevant.

## Google Apps Script
No CORS headers needed in your Apps Script. Keep `doPost` returning plain `ContentService` JSON.
The `setHeader()` calls you had before can be removed — they were being ignored by GAS anyway.
