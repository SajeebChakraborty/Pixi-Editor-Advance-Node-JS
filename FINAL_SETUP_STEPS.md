# ✅ Supabase Connection Successful!

## Current Status

✅ **Connection Working!**

- URL: `https://wdmuccxauztdsifrraka.supabase.co`
- Key: Valid (208 characters)
- Database: Connected
- Storage: Connected

## ⚠️ Manual Setup Required

Due to security policies, you need to create the storage bucket and database table manually through the Supabase Dashboard.

---

## Step 1: Create Storage Bucket (2 minutes)

1. **Go to Supabase Dashboard**
   - Open: https://supabase.com/dashboard
   - Select your project: `wdmuccxauztdsifrraka`

2. **Navigate to Storage**
   - Click **"Storage"** in the left sidebar
   - Click **"New bucket"** button

3. **Create the Bucket**
   - Bucket name: `assets` (exactly this, lowercase)
   - **Make it PUBLIC** ✅ (toggle the switch)
   - File size limit: 50MB (optional)
   - Allowed MIME types: Leave empty or add: `image/*,video/*,audio/*`
   - Click **"Create bucket"**

4. **Verify**
   - You should see "assets" bucket in the list
   - It should show as "Public"

---

## Step 2: Create Database Table (1 minute)

1. **Go to SQL Editor**
   - In Supabase Dashboard, click **"SQL Editor"** in left sidebar
   - Click **"New query"**

2. **Run the Setup Script**
   - Open this file: `/Users/user/shuvos_magic/conva-first/scripts/setup-supabase.sql`
   - Copy ALL the contents
   - Paste into the SQL Editor
   - Click **"Run"** (or press Cmd/Ctrl + Enter)

3. **Verify Success**
   - You should see: "Success. No rows returned"
   - Go to **"Table Editor"** in sidebar
   - You should see "assets" table listed

---

## Step 3: Test Everything

After completing steps 1 & 2, run this command:

```bash
npx tsx scripts/test-supabase.ts
```

You should see:

```
✅ Storage Buckets: Found 1 bucket(s)
   - assets (public)
✅ Database (assets table): Connected
```

---

## Step 4: Test Asset Upload

1. **Start your dev server** (if not running):

   ```bash
   npm run dev
   ```

2. **Go to Admin Panel**:
   - Open: http://localhost:3000/admin/assets

3. **Upload a Test Asset**:
   - Click "Upload New Asset"
   - Select an image or video
   - Wait for upload to complete

4. **Verify in Editor**:
   - Go to: http://localhost:3000/editor
   - Open "Photos" or "Videos" tool
   - Your uploaded asset should appear!

---

## Troubleshooting

### Bucket creation fails

- Make sure you're logged into the correct Supabase project
- Check that the bucket name is exactly `assets` (lowercase)
- Ensure "Public" is toggled ON

### SQL script fails

- Check for any error messages in red
- Make sure you copied the ENTIRE script
- Try running it in smaller sections if needed

### Assets don't appear in editor

- Refresh the page
- Check browser console for errors (F12)
- Verify the asset was uploaded to Supabase Storage (check Storage tab)

---

## Quick Reference

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Your Project**: `wdmuccxauztdsifrraka`
- **SQL Script**: `/Users/user/shuvos_magic/conva-first/scripts/setup-supabase.sql`
- **Admin Panel**: http://localhost:3000/admin/assets
- **Editor**: http://localhost:3000/editor

---

**Need help?** Run `npx tsx scripts/diagnose-supabase.ts` to check your setup status!
