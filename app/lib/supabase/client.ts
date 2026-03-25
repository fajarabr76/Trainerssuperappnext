import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a dummy client or throw a more descriptive error that doesn't 
    // necessarily crash the build if handled, but here we just want to avoid 
    // the @supabase/ssr internal crash.
    // For build compatibility, we can return a mock or just let it fail at runtime.
    return createBrowserClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder',
      {
        cookieOptions: {
          sameSite: 'none',
          secure: true,
        }
      }
    );
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      }
    }
  );
}
