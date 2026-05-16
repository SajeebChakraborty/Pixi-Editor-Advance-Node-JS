-- =====================================================
-- Fix Database RLS Policies for "assets" table
-- =====================================================
-- This fixes the "new row violates row-level security policy" error

-- Step 1: Drop existing policies (if any)
DROP POLICY IF EXISTS "Public assets are viewable by everyone" ON assets;
DROP POLICY IF EXISTS "Authenticated users can insert assets" ON assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON assets;
DROP POLICY IF EXISTS "Users can delete their own assets" ON assets;
DROP POLICY IF EXISTS "Allow public insert" ON assets;
DROP POLICY IF EXISTS "Allow public select" ON assets;
DROP POLICY IF EXISTS "Allow public delete" ON assets;

-- Step 2: Create permissive policies that allow operations

-- Allow anyone to view public assets
CREATE POLICY "Allow public select"
ON assets FOR SELECT
TO public
USING (true);

-- Allow anyone to insert assets (you can restrict this later)
CREATE POLICY "Allow public insert"
ON assets FOR INSERT
TO public
WITH CHECK (true);

-- Allow anyone to delete assets (you can restrict this later)
CREATE POLICY "Allow public delete"
ON assets FOR DELETE
TO public
USING (true);

-- Allow anyone to update assets (you can restrict this later)
CREATE POLICY "Allow public update"
ON assets FOR UPDATE
TO public
USING (true);

-- Step 3: Verify RLS is enabled
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Step 4: Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'assets'
ORDER BY policyname;

-- You should see 4 policies listed:
-- - Allow public delete
-- - Allow public insert
-- - Allow public select
-- - Allow public update
