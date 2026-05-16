-- =====================================================
-- Pixigen Asset Management - Database Setup
-- =====================================================
-- Run this in your Supabase SQL Editor to set up the assets table

-- 1. Create the assets table
CREATE TABLE IF NOT EXISTS assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  url TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  project_id UUID,
  file_size BIGINT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_is_public ON assets(is_public);

-- 3. Enable Row Level Security
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public assets are viewable by everyone" ON assets;
DROP POLICY IF EXISTS "Authenticated users can insert assets" ON assets;
DROP POLICY IF EXISTS "Users can update their own assets" ON assets;
DROP POLICY IF EXISTS "Users can delete their own assets" ON assets;

-- 5. Create RLS Policies

-- Allow everyone to view public/global assets (project_id IS NULL or is_public = true)
CREATE POLICY "Public assets are viewable by everyone"
ON assets FOR SELECT
USING (is_public = true OR project_id IS NULL);

-- Allow authenticated users to insert assets
CREATE POLICY "Authenticated users can insert assets"
ON assets FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to update their own assets
CREATE POLICY "Users can update their own assets"
ON assets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to delete their own assets
CREATE POLICY "Users can delete their own assets"
ON assets FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 6. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STORAGE BUCKET SETUP (Manual Steps Required)
-- =====================================================
-- You need to manually create the storage bucket in Supabase Dashboard:
-- 
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name: "assets"
-- 4. Set as PUBLIC (important!)
-- 5. Click "Create bucket"
--
-- Then set up the storage policies by running this:

-- Note: Storage policies are set via the Supabase Dashboard UI
-- Go to Storage > assets bucket > Policies
-- Add these policies:
--
-- Policy 1: "Public Access"
--   - Operation: SELECT
--   - Policy: (bucket_id = 'assets')
--
-- Policy 2: "Authenticated Upload"
--   - Operation: INSERT
--   - Policy: (bucket_id = 'assets' AND auth.role() = 'authenticated')
--
-- Policy 3: "Authenticated Delete"
--   - Operation: DELETE  
--   - Policy: (bucket_id = 'assets' AND auth.role() = 'authenticated')

-- =====================================================
-- Verification Query
-- =====================================================
-- Run this to verify the table was created successfully:
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'assets'
ORDER BY ordinal_position;
