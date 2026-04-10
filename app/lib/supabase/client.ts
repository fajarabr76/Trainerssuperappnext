import { createBrowserClient } from '@supabase/ssr';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
    );
  }

  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    browserClient = createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder',
      {
        cookieOptions: {
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        }
      }
    );
    return browserClient;
  }

browserClient = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    cookieOptions: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    }
  }
);

  return browserClient;
}
