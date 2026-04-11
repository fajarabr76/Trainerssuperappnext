import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { normalizeRole } from '@/app/lib/authz';

export async function updateSession(request: NextRequest) {
  // Guard: if env vars aren't available, pass through instead of crashing
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
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
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
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

  // Role-based routing logic
  const path = request.nextUrl.pathname;
  const protectedRoutes = ['/dashboard', '/ketik', '/pdkt', '/telefun', '/profiler', '/qa-analyzer'];
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  const isAuthPage = path === '/login' || path === '/register';

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

      // Cek status approval user
      const { data: profile } = await supabase
        .from('profiles')
        .select('status, role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.status === 'pending') {
        const url = new URL('/waiting-approval', request.url);
        return NextResponse.redirect(url);
      }

      if (profile.status === 'rejected') {
        await supabase.auth.signOut();
        const url = new URL('/', request.url);
        url.searchParams.set('auth', 'login');
        url.searchParams.set('message', 'rejected');
        return NextResponse.redirect(url);
      }

      const role = normalizeRole(profile.role);
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
        '/qa-analyzer/agents',
      ];

      if (trainerOnlyRoutes.some((route) => path.startsWith(route))) {
        const allowed = ['trainer', 'admin', 'superadmin'];
        if (!allowed.includes(role)) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }

      if (trainerOrLeaderRoutes.some((route) => path.startsWith(route))) {
        const allowed = ['trainer', 'leader', 'admin', 'superadmin'];
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
