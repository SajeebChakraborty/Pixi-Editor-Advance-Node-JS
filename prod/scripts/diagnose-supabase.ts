import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

console.log('🔍 Supabase Configuration Diagnostic\n');
console.log('=====================================\n');

// Read environment variables
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('1. Environment Variables:');
console.log(`   URL: ${url || '❌ NOT SET'}`);
console.log(`   Key: ${key ? (key.substring(0, 20) + '...') : '❌ NOT SET'}`);
console.log(`   Key Length: ${key?.length || 0} characters\n`);

// Validate URL
console.log('2. URL Validation:');
if (!url) {
  console.log('   ❌ URL is not set');
} else if (!url.startsWith('http')) {
  console.log('   ❌ URL does not start with http/https');
} else if (!url.includes('supabase.co')) {
  console.log('   ⚠️  URL does not contain "supabase.co" - is this correct?');
} else {
  console.log('   ✅ URL format looks correct');
}

// Validate Key
console.log('\n3. Key Validation:');
if (!key) {
  console.log('   ❌ Key is not set');
} else if (key === 'placeholder') {
  console.log('   ❌ Key is set to "placeholder" - you need a real key');
} else if (key.startsWith('sb_publishable_') || key.startsWith('sb_secret_')) {
  console.log('   ❌ This looks like a mock/placeholder key');
  console.log('   💡 Real Supabase keys start with "eyJ" and are 100+ characters');
} else if (!key.startsWith('eyJ')) {
  console.log('   ❌ Key does not start with "eyJ" (JWT format)');
  console.log('   💡 Real Supabase anon keys are JWT tokens starting with "eyJ"');
} else if (key.length < 100) {
  console.log('   ⚠️  Key seems too short (real keys are usually 100+ characters)');
} else {
  console.log('   ✅ Key format looks correct');
}

// Try to create client
console.log('\n4. Client Creation:');
try {
  const client = createClient(url || '', key || '');
  console.log('   ✅ Client created successfully');
  
  // Try a simple query
  console.log('\n5. Connection Test:');
  (async () => {
    try {
      const { data, error } = await client.from('assets').select('count').limit(1);
      if (error) {
        console.log('   ❌ Database query failed:', error.message);
        if (error.message.includes('fetch failed')) {
          console.log('   💡 This usually means invalid credentials or network issue');
        }
      } else {
        console.log('   ✅ Database connection successful!');
      }
    } catch (e: any) {
      console.log('   ❌ Connection error:', e.message);
    }
  })();

  // Try storage
  setTimeout(async () => {
    console.log('\n6. Storage Test:');
    const { data, error } = await client.storage.listBuckets();
    if (error) {
      console.log('   ❌ Storage query failed:', error.message);
    } else {
      console.log('   ✅ Storage connection successful!');
      console.log(`   Found ${data?.length || 0} bucket(s):`);
      data?.forEach(bucket => {
        console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
      });
    }
    
    console.log('\n=====================================');
    console.log('\n📋 NEXT STEPS:\n');
    
    if (!key || key.startsWith('sb_') || !key.startsWith('eyJ')) {
      console.log('❌ Your anon key is INVALID\n');
      console.log('To get the correct key:');
      console.log('1. Go to: https://supabase.com/dashboard');
      console.log('2. Select your project');
      console.log('3. Go to Settings → API');
      console.log('4. Copy the "anon public" key (starts with "eyJ", 100+ chars)');
      console.log('5. Update NEXT_PUBLIC_SUPABASE_ANON_KEY in .env');
      console.log('6. Restart your dev server (npm run dev)');
    }
  }, 1000);
  
} catch (e: any) {
  console.log('   ❌ Failed to create client:', e.message);
}
