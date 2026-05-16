-- =====================================================
-- Pixigen 3NF Normalized Schema Migration
-- =====================================================

-- 1. Organizations table for multi-tenancy
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Update assets to support organizations
ALTER TABLE assets ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

-- 3. Projects table updates (ensuring compliance)
-- Note: Table 'projects' likely exists, we add org_id and ensure updated_at trigger exists
ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

-- 4. Project Assets (Many-to-Many junction table)
CREATE TABLE IF NOT EXISTS project_assets (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, asset_id)
);

-- 5. API Keys table for third-party access
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    org_id UUID REFERENCES organizations(id),
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    scopes TEXT[] DEFAULT '{all}',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Storage Jobs (Background Queue tracking)
CREATE TABLE IF NOT EXISTS storage_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    type TEXT NOT NULL, -- 'render_video', 'process_image', etc.
    status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
    payload JSONB NOT NULL DEFAULT '{}',
    result_url TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE
);

-- 7. Add indexing for job performance
CREATE INDEX IF NOT EXISTS idx_storage_jobs_status ON storage_jobs(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- 8. Enable RLS (Row Level Security)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_jobs ENABLE ROW LEVEL SECURITY;

-- 9. Basic Policies (Owner-access)
CREATE POLICY "Users can see their own jobs" ON storage_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can see their own API keys" ON api_keys FOR SELECT USING (auth.uid() = user_id);
