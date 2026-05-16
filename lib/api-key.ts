import { createHash, randomBytes } from 'crypto';
import { supabase } from './supabase';

/**
 * API Key Utility
 * 
 * Handles generation and validation of secure API keys.
 */

export async function generateApiKey(userId: string, name: string, orgId?: string) {
  // Create a random 32-byte key
  const secretPart = randomBytes(24).toString('hex');
  const prefix = 'px_live_';
  const fullKey = `${prefix}${secretPart}`;
  
  // Hash the key for storage
  const hash = createHash('sha256').update(fullKey).digest('hex');
  
  const { data, error } = await supabase
    .from('api_keys')
    .insert([
      {
        user_id: userId,
        org_id: orgId,
        name,
        key_hash: hash,
        prefix,
      }
    ])
    .select()
    .single();

  if (error) throw error;

  // Return the plain key to show to the user ONCE
  return {
    id: data.id,
    key: fullKey
  };
}

export async function validateApiKey(key: string) {
  if (!key.startsWith('px_live_')) return null;

  const hash = createHash('sha256').update(key).digest('hex');
  
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', hash)
    .single();

  if (error || !data) return null;

  // Background update last_used_at
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then();

  return data;
}
