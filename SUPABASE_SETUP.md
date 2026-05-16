# Supabase Setup Guide for Pixigen

## 🔴 CRITICAL: Your Supabase credentials are incomplete!

Your current `.env` file has an **incomplete anon key**. This is why the connection is failing.

## Step 1: Get Your Correct Credentials

1. Go to: https://supabase.com/dashboard
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL**: Should look like `https://xxxxx.supabase.co`
   - **anon/public key**: A LONG string (usually 100+ characters starting with `eyJ...`)

## Step 2: Update Your .env File

Replace the values in `/Users/user/shuvos_magic/conva-first/.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjc4ODg4ODg4LCJleHAiOjE5OTQ0NjQ4ODh9.YOUR_ACTUAL_KEY_HERE
```

⚠️ **Important**: The anon key should be VERY LONG (100+ characters)

## Step 3: Create Storage Bucket

1. In Supabase Dashboard → **Storage**
2. Click **"New bucket"**
3. Bucket name: `assets`
4. **Make it PUBLIC** ✅ (very important!)
5. Click **"Create bucket"**

### Set Bucket Policies:

After creating the bucket, click on it and go to **Policies**:

**Policy 1: Public Read**

- Name: "Public Access"
- Allowed operation: SELECT
- Policy definition: `(bucket_id = 'assets')`

**Policy 2: Authenticated Upload**

- Name: "Authenticated Upload"
- Allowed operation: INSERT
- Policy definition: `(bucket_id = 'assets' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role'))`

**Policy 3: Authenticated Delete**

- Name: "Authenticated Delete"
- Allowed operation: DELETE
- Policy definition: `(bucket_id = 'assets' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role'))`

## Step 4: Create Database Table

1. In Supabase Dashboard → **SQL Editor**
2. Click **"New query"**
3. Copy and paste the contents of: `/Users/user/shuvos_magic/conva-first/scripts/setup-supabase.sql`
4. Click **"Run"**

## Step 5: Verify Connection

After completing steps 1-4, run:

```bash
npx tsx scripts/test-supabase.ts
```

You should see all ✅ green checkmarks!

## Troubleshooting

### "fetch failed" error

- Check your anon key is complete and correct
- Verify the URL is correct
- Make sure you're connected to the internet

### "Bucket not found"

- Create the bucket in Storage section
- Make sure it's named exactly "assets" (lowercase)
- Set it to PUBLIC

### "Table not found"

- Run the SQL script in SQL Editor
- Check for any SQL errors in the output

---

**Need help?** The anon key in your current `.env` appears to be: `sb_publishable_oVoPXWcvm0m_P42qhrt0Ew_7l21iSQG`

This looks like a placeholder or incomplete key. A real Supabase anon key is much longer (100+ characters) and starts with `eyJ`.
