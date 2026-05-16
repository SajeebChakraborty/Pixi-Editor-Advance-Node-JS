-- =====================================================
-- 🛠️ FIX DATABASE & STORAGE PERMISSIONS
-- =====================================================
-- Run this in your Supabase SQL Editor to fix the RLS errors

-- 1. Setup "assets" table correctly
CREATE TABLE IF NOT EXISTS assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT,
    url TEXT NOT NULL,
    user_id UUID DEFAULT auth.uid(),
    project_id UUID,
    file_size BIGINT,
    is_public BOOLEAN DEFAULT true,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- 3. Create permissive policies for the table
DROP POLICY IF EXISTS "Allow public select" ON assets;
DROP POLICY IF EXISTS "Allow public insert" ON assets;
DROP POLICY IF EXISTS "Allow public update" ON assets;
DROP POLICY IF EXISTS "Allow public delete" ON assets;

CREATE POLICY "Allow public select" ON assets FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert" ON assets FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update" ON assets FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete" ON assets FOR DELETE TO public USING (true);

-- 4. Setup Storage Bucket "assets" if not already there
-- We can't do this reliably via SQL if it's already created, 
-- but we CAN set the policies for storage

INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Create storage policies for the "assets" bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;

CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'assets' );

CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'assets' );

CREATE POLICY "Public Delete"
ON storage.objects FOR DELETE
TO public
USING ( bucket_id = 'assets' );
