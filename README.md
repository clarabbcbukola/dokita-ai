# Dokita AI — Vercel Deployment Fix

## Why you got 404
The previous version was structured as a Next.js app. This version is restructured
as a plain static + Vercel serverless functions project. No framework needed.

## Project structure (what Vercel expects)
```
dokita-ai/
├── vercel.json          ← Routing config (CRITICAL — do not delete)
├── package.json
├── .gitignore
├── public/
│   ├── index.html       ← Served at /
│   ├── admin.html       ← Served at /admin
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── api/
│   ├── chat.js          ← Served at /api/chat
│   ├── analyze-image.js ← Served at /api/analyze-image
│   └── admin/
│       ├── books.js     ← Served at /api/admin/books
│       └── index-book.js← Served at /api/admin/index-book
└── lib/
    ├── gemini.js
    ├── supabase.js
    ├── processor.js
    ├── drive.js
    └── auth.js
```

## Deploy steps (fresh from scratch)

### 1. Push to GitHub
- Go to github.com → New repository → name: `dokita-ai` → Create
- Upload ALL files in this zip (maintain the folder structure exactly)

### 2. Connect to Vercel
- Go to vercel.com → Add New Project → Import Git Repository
- Select your `dokita-ai` repo
- **IMPORTANT**: On the "Configure Project" screen:
  - Framework Preset: **Other** (NOT Next.js, NOT Create React App)
  - Build Command: leave BLANK
  - Output Directory: leave BLANK
  - Install Command: `npm install`

### 3. Add Environment Variables in Vercel
Click "Environment Variables" and add these one by one:

| Name | Value |
|------|-------|
| GEMINI_API_KEY | your Gemini API key |
| SUPABASE_URL | https://cnlluyuwyqkykggigwqv.supabase.co |
| SUPABASE_ANON_KEY | your anon key |
| SUPABASE_SERVICE_ROLE_KEY | your service role key |
| ADMIN_PASSWORD | your chosen password |
| GOOGLE_SERVICE_ACCOUNT_EMAIL | from service account JSON |
| GOOGLE_PRIVATE_KEY | from service account JSON |
| GOOGLE_DRIVE_FOLDER_ID | your Drive folder ID |

### 4. Deploy
Click Deploy. Wait ~1 minute.
Visit your-app.vercel.app — you should see Dokita AI.
Visit your-app.vercel.app/admin — you should see the admin login.

## Test API is working
Visit: your-app.vercel.app/api/chat
You should see: `{"error":"Method not allowed"}` — this means the API is live!

## Common errors

**Still getting 404 on /**
→ In Vercel project settings → General → make sure Framework is set to "Other"
→ Redeploy

**404 on /api/chat**
→ Check that vercel.json is in the ROOT of your repo (not inside a subfolder)

**500 on API calls**
→ Check Vercel → your project → Functions tab → click the function → View logs
→ Usually means an env variable is missing or wrong

**Books not indexing**
→ Make sure the Drive file is shared as "Anyone with the link can view"
→ Check Vercel function logs for the exact error
