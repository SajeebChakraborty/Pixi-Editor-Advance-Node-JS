# 🔧 Fix: 401 Database RLS Policy Error

## Problem

Error: `"new row violates row-level security policy for table 'assets'"`

This means:

- ✅ File uploaded to storage successfully
- ❌ But saving metadata to database failed due to RLS policy

## Solution: Fix Database Policies

### Quick Fix (1 minute)

1. **Go to SQL Editor**
   - Open: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka/sql/new

2. **Run the Fix Script**
   - Copy ALL contents from: `/Users/user/shuvos_magic/conva-first/scripts/fix-database-policies.sql`
   - Paste into SQL Editor
   - Click **"Run"** (or press Cmd/Ctrl + Enter)

3. **Verify Success**
   - You should see a table with 4 policies:
     - Allow public delete
     - Allow public insert
     - Allow public select
     - Allow public update

4. **Test Upload Again**
   - Go to: http://localhost:3000/admin/assets
   - Try uploading an asset
   - It should work now! ✅

---

## What This Does

The script creates 4 permissive policies on the `assets` table:

1. **SELECT** - Anyone can view assets
2. **INSERT** - Anyone can add assets
3. **DELETE** - Anyone can delete assets
4. **UPDATE** - Anyone can update assets

> **Note**: These are very permissive policies for development. In production, you should restrict these to authenticated users only.

---

## Making It More Secure (Optional)

If you want to restrict to authenticated users only, replace `TO public` with `TO authenticated` in the policies:

```sql
CREATE POLICY "Allow authenticated insert"
ON assets FOR INSERT
TO authenticated
WITH CHECK (true);
```

But for now, the permissive policies will let you test everything!

---

## Test the Complete Flow

After running the SQL script:

1. **Upload from Admin**:
   - Go to: http://localhost:3000/admin/assets
   - Click "Upload New Asset"
   - Select an image
   - Should upload successfully ✅

2. **Verify in Database**:
   - Go to: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka/editor
   - Click "assets" table
   - You should see your uploaded asset record

3. **Check in Editor**:
   - Go to: http://localhost:3000/editor
   - Open "Photos" tool
   - Your uploaded image should appear! ✅

---

## Quick Reference

**SQL Script**: `/Users/user/shuvos_magic/conva-first/scripts/fix-database-policies.sql`

**Supabase Links**:

- SQL Editor: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka/sql/new
- Table Editor: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka/editor
- Storage: https://supabase.com/dashboard/project/wdmuccxauztdsifrraka/storage/buckets/assets

**Local Links**:

- Admin Panel: http://localhost:3000/admin/assets
- Editor: http://localhost:3000/editor
