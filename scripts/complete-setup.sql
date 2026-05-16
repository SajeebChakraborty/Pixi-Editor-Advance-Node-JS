-- 1. Create Assets Table
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

-- 2. Create Templates Table
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

-- 3. Create Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  canvas_data JSONB DEFAULT '{}',
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Assets Policies
DROP POLICY IF EXISTS "Public assets viewable by everyone" ON assets;
CREATE POLICY "Public assets viewable by everyone" ON assets FOR SELECT USING (is_public = true OR project_id IS NULL);

DROP POLICY IF EXISTS "Authenticated users insert assets" ON assets;
CREATE POLICY "Authenticated users insert assets" ON assets FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users update own assets" ON assets;
CREATE POLICY "Users update own assets" ON assets FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Templates Policies
DROP POLICY IF EXISTS "Templates viewable by everyone" ON templates;
CREATE POLICY "Templates viewable by everyone" ON templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users manage templates" ON templates;
CREATE POLICY "Authenticated users manage templates" ON templates FOR ALL TO authenticated USING (true);

-- Projects Policies
DROP POLICY IF EXISTS "Users view own projects" ON projects;
CREATE POLICY "Users view own projects" ON projects FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own projects" ON projects;
CREATE POLICY "Users insert own projects" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own projects" ON projects;
CREATE POLICY "Users update own projects" ON projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Updated_at Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
