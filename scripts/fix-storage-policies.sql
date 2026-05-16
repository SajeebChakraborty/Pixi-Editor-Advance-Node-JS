-- =====================================================
-- Storage Bucket Policies for "assets" bucket
-- =====================================================
-- Run this in Supabase SQL Editor to fix upload permissions

-- First, check if policies exist and drop them
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;

-- Policy 1: Allow public read access to assets bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

-- Policy 2: Allow anyone to upload to assets bucket (you can restrict to authenticated later)
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'assets');

-- Policy 3: Allow anyone to delete from assets bucket (you can restrict to authenticated later)
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'assets');

-- Policy 4: Allow anyone to update in assets bucket
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'assets');

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE '%assets%' OR policyname LIKE '%Public%' OR policyname LIKE '%Authenticated%';
