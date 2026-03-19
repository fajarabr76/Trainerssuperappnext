import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        sameSite: 'none',
        secure: true,
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
            supabaseResponse.cookies.set(name, value, { ...options, sameSite: 'none', secure: true })
          );
        },
      },
    }
  );

  // refreshing the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Role-based routing
  const path = request.nextUrl.pathname;

  // Protect dashboard and simulation routes
  const protectedRoutes = ['/dashboard', '/trainer', '/leader', '/agent', '/ketik', '/pdkt', '/telefun'];
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));

  if (isProtectedRoute) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Fetch user profile to get role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'Agent';

    // Redirect based on role
    if (path.startsWith('/trainer') && role !== 'Trainer') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (path.startsWith('/leader') && role !== 'Leader' && role !== 'Trainer') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Redirect logged in users away from auth pages
  if ((path === '/login' || path === '/register') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}
