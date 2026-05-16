# 🔑 How to Get Your Real Supabase Anon Key

## Current Problem

Your `.env` file has: `NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_oVoPXWcvm0m_P42qhrt0Ew_7l21iSQG`

This is **NOT** a valid Supabase key. It's a placeholder.

## What a Real Key Looks Like

A real Supabase anon key:

- ✅ Starts with `eyJ`
- ✅ Is 100+ characters long
- ✅ Looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind...` (continues for 100+ chars)

## Step-by-Step: Get Your Real Key

### 1. Open Supabase Dashboard

Go to: **https://supabase.com/dashboard**

### 2. Select Your Project

- If you don't have a project, click "New Project"
- Project name: `pixigen` (or any name you want)
- Database password: (create a strong password)
- Region: Choose closest to you
- Click "Create new project" (takes ~2 minutes)

### 3. Get Your API Credentials

Once your project is ready:

1. Click on your project
2. Go to **Settings** (gear icon in sidebar)
3. Click **API** in the settings menu
4. You'll see two sections:

#### Project URL

```
https://xxxxxxxxxxxxx.supabase.co
```

Copy this entire URL

#### Project API keys

You'll see two keys:

- **anon public** ← This is what you need! (starts with `eyJ`)
- service_role (don't use this one)

Click the copy icon next to **anon public** key

### 4. Update Your .env File

Open `/Users/user/shuvos_magic/conva-first/.env` and replace:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY3ODg4ODg4OCwiZXhwIjoxOTk0NDY0ODg4fQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **Important**: Paste the FULL key (it will be very long!)

### 5. Restart Your Dev Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### 6. Test Connection

```bash
npx tsx scripts/diagnose-supabase.ts
```

You should see ✅ green checkmarks!

## Still Having Issues?

If you're still seeing errors after updating:

1. **Check the key is complete**: The key should be 100+ characters
2. **No extra spaces**: Make sure there are no spaces before/after the key
3. **Restart dev server**: Changes to `.env` require a restart
4. **Check project status**: Make sure your Supabase project is active (not paused)

## Next: Create Storage Bucket

Once connection works, you need to:

1. Go to **Storage** in Supabase Dashboard
2. Click "New bucket"
3. Name: `assets`
4. Make it **PUBLIC** ✅
5. Click "Create bucket"

Then run the SQL script to create the database table!
