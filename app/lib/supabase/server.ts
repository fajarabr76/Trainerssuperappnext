import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a dummy client to avoid crashing build when keys are missing
    // in the environment during the build phase.
    return createServerClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder',
      {
        cookieOptions: {
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        },
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      }
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookieOptions: {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { 
                ...options, 
                sameSite: 'lax', 
                secure: process.env.NODE_ENV === 'production' 
              })
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
