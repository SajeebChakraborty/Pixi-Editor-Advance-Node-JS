import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkAssets() {
  console.log('--- ASSETS ---');
  const { data: assets, error: assetError } = await supabase
    .from('assets')
    .select('id, name, url, type, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (assetError) {
    console.error('Error fetching assets:', assetError);
  } else {
    console.log('Most Recent Asset:');
    assets.forEach(asset => {
      console.log(`- [${asset.type}] ${asset.name} (${asset.created_at}): ${asset.url}`);
    });
  }

  console.log('\n--- TEMPLATES ---');
  const { data: templates, error: templateError } = await supabase
    .from('templates')
    .select('id, name, thumbnail_url, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (templateError) {
    console.error('Error fetching templates:', templateError);
  } else {
    console.log('Most Recent Template:');
    templates.forEach(template => {
      console.log(`- ${template.name} (${template.created_at}): ${template.thumbnail_url}`);
    });
  }
}


checkAssets();
