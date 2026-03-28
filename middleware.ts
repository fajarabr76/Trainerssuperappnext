import { type NextRequest } from 'next/server';
import { updateSession } from './app/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets (various formats)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:html|js|css|svg|png|jpg|jpeg|gif|webp|woff2?|ttf|mp4|mp3|pdf|txt|xml)$).*)',
  ],
};
