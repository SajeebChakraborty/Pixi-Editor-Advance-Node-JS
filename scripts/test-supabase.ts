import 'dotenv/config';
import { supabase } from '../lib/supabase';

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  // Test 1: Check if client is initialized
  console.log('1. Supabase Client:', supabase ? '✅ Initialized' : '❌ Not initialized');

  // Test 2: Check storage bucket
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.log('2. Storage Buckets:', '❌ Error:', error.message);
    } else {
      console.log('2. Storage Buckets:', '✅ Found', buckets?.length || 0, 'bucket(s)');
      buckets?.forEach(bucket => {
        console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
      });
    }
  } catch (e: any) {
    console.log('2. Storage Buckets:', '❌ Exception:', e.message);
  }

  // Test 3: Check if 'assets' bucket exists
  try {
    const { data, error } = await supabase.storage.getBucket('assets');
    if (error) {
      console.log('3. Assets Bucket:', '❌ Not found or error:', error.message);
      console.log('   💡 You need to create an "assets" bucket in Supabase Dashboard');
    } else {
      console.log('3. Assets Bucket:', '✅ Exists', data.public ? '(public)' : '(private)');
    }
  } catch (e: any) {
    console.log('3. Assets Bucket:', '❌ Exception:', e.message);
  }

  // Test 4: Check database connection
  const tables = ['assets', 'projects', 'templates'];
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        console.log(`4. Database (${table} table):`, '❌ Error:', error.message);
      } else {
        console.log(`4. Database (${table} table):`, '✅ Connected');
      }
    } catch (e: any) {
      console.log(`4. Database (${table} table):`, '❌ Exception:', e.message);
    }
  }

  console.log('\n✨ Test complete!');
}

testSupabaseConnection();
