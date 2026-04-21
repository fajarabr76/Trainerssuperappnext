import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { normalizeRole, PROFILE_FIELDS } from '@/app/lib/authz';

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const protectedRoutes = ['/dashboard', '/ketik', '/pdkt', '/telefun', '/profiler', '/qa-analyzer', '/account'];
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  const isAuthPage = path === '/login' || path === '/register';

  // Guard: if env vars aren't available, fail-closed for protected routes
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedRoute) {
      console.error('[middleware] Supabase environment variables are missing. Failing closed for protected route:', path);
      const url = new URL('/', request.url);
      url.searchParams.set('auth', 'login');
      url.searchParams.set('message', 'misconfigured-auth');
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookieOptions: {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { 
              ...options, 
              sameSite: 'lax', 
              secure: process.env.NODE_ENV === 'production' 
            })
          );
        },
      },
    }
  );

  // Only call getUser() if we are on a protected route or authenticating
  if (isProtectedRoute || isAuthPage) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Protect dashboard and simulation routes
    if (isProtectedRoute) {
      if (!user) {
        const url = new URL('/', request.url);
        url.searchParams.set('auth', 'login');
        return NextResponse.redirect(url);
      }

      // Hanya terapkan gate jika status profile memang terbaca jelas.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(PROFILE_FIELDS)
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.warn('[middleware] Failed to read profile during auth check:', profileError?.message);
        await supabase.auth.signOut();
        const url = new URL('/', request.url);
        url.searchParams.set('auth', 'login');
        url.searchParams.set('message', 'profile-unavailable');
        return NextResponse.redirect(url);
      }

      const profileStatus = profile?.status?.toLowerCase();

      if (profile?.is_deleted || profileStatus === 'rejected') {
        await supabase.auth.signOut();
        const url = new URL('/', request.url);
        url.searchParams.set('auth', 'login');
        url.searchParams.set('message', profile?.is_deleted ? 'deleted' : 'rejected');
        return NextResponse.redirect(url);
      }

      if (profileStatus === 'pending') {
        const url = new URL('/waiting-approval', request.url);
        return NextResponse.redirect(url);
      }

      const role = normalizeRole(profile?.role);
      const trainerOnlyRoutes = [
        '/dashboard/users',
        '/dashboard/activities',
        '/qa-analyzer/input',
        '/qa-analyzer/settings',
        '/qa-analyzer/periods',
        '/qa-analyzer/reports',
      ];
      const trainerOrLeaderRoutes = [
        '/dashboard/monitoring',
        '/profiler',
        '/qa-analyzer/dashboard',
        '/qa-analyzer/ranking',
      ];
      const isQaAgentsListRoute = path === '/qa-analyzer/agents' || path === '/qa-analyzer/agents/';
      const isQaAgentDetailRoute = path.startsWith('/qa-analyzer/agents/');

      if (trainerOnlyRoutes.some((route) => path.startsWith(route))) {
        const allowed = ['trainer', 'admin'];
        if (!allowed.includes(role)) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }

      if (trainerOrLeaderRoutes.some((route) => path.startsWith(route))) {
        const allowed = ['trainer', 'leader', 'admin'];
        if (!allowed.includes(role)) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }

      if (isQaAgentsListRoute) {
        const allowed = ['trainer', 'leader', 'admin'];
        if (!allowed.includes(role)) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }

      if (isQaAgentDetailRoute) {
        const allowed = ['trainer', 'leader', 'agent', 'admin'];
        if (!allowed.includes(role)) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }
    }

    // Redirect legacy auth pages to landing page modal
    if (isAuthPage) {
      const url = new URL('/', request.url);
      url.searchParams.set('auth', path === '/login' ? 'login' : 'register');
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
