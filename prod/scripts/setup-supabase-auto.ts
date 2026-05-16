import 'dotenv/config';
import { supabase } from '../lib/supabase';

async function setupSupabase() {
  console.log('🚀 Setting up Supabase for Pixigen\n');
  console.log('=====================================\n');

  // Step 1: Create storage bucket
  console.log('1. Creating "assets" storage bucket...');
  const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('assets', {
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: ['image/*', 'video/*', 'audio/*']
  });

  if (bucketError) {
    if (bucketError.message.includes('already exists')) {
      console.log('   ✅ Bucket already exists');
    } else {
      console.log('   ❌ Error creating bucket:', bucketError.message);
      return;
    }
  } else {
    console.log('   ✅ Bucket created successfully');
  }

  // Step 2: Create database table
  console.log('\n2. Creating "assets" database table...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS assets (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT,
      url TEXT NOT NULL,
      user_id UUID,
      project_id UUID,
      file_size BIGINT,
      is_public BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
    CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
    CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_assets_is_public ON assets(is_public);
  `;

  const { error: tableError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
  
  // Alternative: Try using direct query
  const { error: directError } = await supabase.from('assets').select('count').limit(1);
  
  if (directError && !directError.message.includes('relation "assets" does not exist')) {
    console.log('   ⚠️  Table might already exist or there was an error');
    console.log('   💡 Please run the SQL script manually in Supabase Dashboard');
    console.log('   📄 File: scripts/setup-supabase.sql');
  } else if (directError) {
    console.log('   ⚠️  Table does not exist yet');
    console.log('   💡 Please run the SQL script manually in Supabase Dashboard:');
    console.log('   1. Go to https://supabase.com/dashboard');
    console.log('   2. Select your project');
    console.log('   3. Go to SQL Editor');
    console.log('   4. Copy/paste contents of: scripts/setup-supabase.sql');
    console.log('   5. Click "Run"');
  } else {
    console.log('   ✅ Table exists and is accessible');
  }

  // Step 3: Verify setup
  console.log('\n3. Verifying setup...');
  
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (!listError) {
    const assetsBucket = buckets?.find(b => b.name === 'assets');
    if (assetsBucket) {
      console.log('   ✅ Storage bucket "assets" confirmed');
      console.log(`      - Public: ${assetsBucket.public ? 'Yes' : 'No'}`);
    }
  }

  const { data: tableData, error: tableCheckError } = await supabase.from('assets').select('count').limit(1);
  if (!tableCheckError) {
    console.log('   ✅ Database table "assets" confirmed');
  }

  console.log('\n=====================================');
  console.log('✨ Setup complete!\n');
  console.log('Next steps:');
  console.log('1. If table creation failed, run the SQL script manually');
  console.log('2. Go to /admin/assets in your app');
  console.log('3. Try uploading an asset');
  console.log('4. Check if it appears in the editor tools');
}

setupSupabase();
