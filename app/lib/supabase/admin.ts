import { createClient as createJSClient } from '@supabase/supabase-js';

// Lazy Service Role client helper (Server-side only)
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars for createAdminClient. ' +
      'Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY ' +
      'sudah di-set di Vercel environment variables.'
    );
  }
  
  return createJSClient(url, key);
}
