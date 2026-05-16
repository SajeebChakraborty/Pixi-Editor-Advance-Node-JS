# 🔧 Fix: 400 Unauthorized Error on Upload

## Problem

You're getting a **400 Bad Request** error when trying to upload files to Supabase Storage. This means the storage bucket policies are not configured correctly.

## Solution: Set Up Storage Policies

### Option 1: Using Supabase Dashboard (Recommended - 2 minutes)

1. **Go to Storage Settings**
   - Open: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka/storage/buckets
   - Click on the **"assets"** bucket
   - Click **"Policies"** tab at the top

2. **Create Upload Policy**
   - Click **"New Policy"**
   - Choose **"For full customization"**
   - Policy name: `Allow public uploads`
   - Allowed operation: Check **INSERT**
   - Policy definition (use this code):

   ```sql
   bucket_id = 'assets'
   ```

   - Target roles: Leave as `public` or select `authenticated`
   - Click **"Review"** then **"Save policy"**

3. **Create Read Policy**
   - Click **"New Policy"** again
   - Policy name: `Allow public reads`
   - Allowed operation: Check **SELECT**
   - Policy definition:

   ```sql
   bucket_id = 'assets'
   ```

   - Click **"Review"** then **"Save policy"**

4. **Create Delete Policy** (optional, for admin)
   - Click **"New Policy"**
   - Policy name: `Allow public deletes`
   - Allowed operation: Check **DELETE**
   - Policy definition:
   ```sql
   bucket_id = 'assets'
   ```

   - Click **"Review"** then **"Save policy"**

### Option 2: Using SQL (Alternative - 1 minute)

1. **Go to SQL Editor**
   - Open: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka/sql/new

2. **Run the Policy Script**
   - Copy contents from: `/Users/user/shuvos_magic/conva-first/scripts/fix-storage-policies.sql`
   - Paste into SQL Editor
   - Click **"Run"**

3. **Verify**
   - You should see "Success" message
   - Check the output table shows your new policies

---

## Test the Fix

After setting up the policies:

1. **Refresh your admin page**: http://localhost:3000/admin/assets

2. **Try uploading again**:
   - Click "Upload New Asset"
   - Select an image
   - It should upload successfully! ✅

3. **Check Supabase Storage**:
   - Go to: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka/storage/buckets/assets
   - You should see your uploaded file in the `images/` folder

---

## Understanding the Error

The **400 Bad Request** happened because:

- ✅ Your bucket exists
- ✅ Your connection works
- ❌ But the bucket has **no policies** allowing uploads

Supabase uses Row Level Security (RLS) for storage. Without policies, all operations are blocked by default.

---

## Quick Reference

**Your Supabase Project**: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka

**Direct Links**:

- Storage Buckets: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka/storage/buckets
- SQL Editor: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka/sql/new
- Policies: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka/storage/policies

**Local Files**:

- SQL Script: `/Users/user/shuvos_magic/conva-first/scripts/fix-storage-policies.sql`
- Admin Panel: http://localhost:3000/admin/assets

---

## Still Having Issues?

If uploads still fail after setting policies:

1. **Check browser console** (F12) for detailed error messages
2. **Verify bucket is public**: Storage → assets → Settings → Public Access should be ON
3. **Check file size**: Default limit is 50MB
4. **Try a smaller file**: Use a small image (< 1MB) to test

Run this to diagnose:

```bash
npx tsx scripts/diagnose-supabase.ts
```
