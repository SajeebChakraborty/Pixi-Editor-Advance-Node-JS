-- Fix missing tables and columns for Pixigen

-- 1. Ensure assets table has correct columns
ALTER TABLE IF EXISTS assets 
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- 2. Create Templates Table if missing
CREATE TABLE IF NOT EXISTS templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  tags JSONB DEFAULT '[]',
  thumbnail_url TEXT,
  layers JSONB DEFAULT '[]',
  width INTEGER DEFAULT 1080,
  height INTEGER DEFAULT 1080,
  published BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Projects Table if missing
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  canvas_data JSONB DEFAULT '{}',
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Simplified for setup)
DROP POLICY IF EXISTS "Public assets viewable by everyone" ON assets;
CREATE POLICY "Public assets viewable by everyone" ON assets FOR SELECT USING (is_public = true OR project_id IS NULL);

DROP POLICY IF EXISTS "Authenticated users insert assets" ON assets;
CREATE POLICY "Authenticated users insert assets" ON assets FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Templates viewable by everyone" ON templates;
CREATE POLICY "Templates viewable by everyone" ON templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users view own projects" ON projects;
CREATE POLICY "Users view own projects" ON projects FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own projects" ON projects;
CREATE POLICY "Users insert own projects" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
