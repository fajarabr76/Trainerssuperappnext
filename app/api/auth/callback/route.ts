import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth=login&message=auth-error`);
  }

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError || !authData.user) {
      console.error('[auth/callback] Error exchanging code for session:', authError?.message);
      return NextResponse.redirect(`${origin}/?auth=login&message=auth-error`);
    }

    const user = authData.user;
    const adminClient = createAdminClient();

    // Periksa apakah user sudah memiliki baris profil di tabel profiles
    const { data: existingProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('status, role, is_deleted')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[auth/callback] Error reading profile with admin client:', profileError.message);
      return NextResponse.redirect(`${origin}/?auth=login&message=auth-error`);
    }

    let status = existingProfile?.status?.toLowerCase();
    const isDeleted = existingProfile?.is_deleted;

    if (isDeleted) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/?auth=login&message=deleted`);
    }

    if (status === 'rejected') {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/?auth=login&message=rejected`);
    }

    // Jika belum ada profil, lakukan auto-provisioning dengan role default 'agent' dan status 'pending'
    if (!existingProfile) {
      const email = user.email ?? '';
      const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? email.split('@')[0] ?? 'User';

      const { error: insertError } = await adminClient
        .from('profiles')
        .insert({
          id: user.id,
          email,
          role: 'agent',
          status: 'pending',
          full_name: fullName,
        });

      if (insertError) {
        console.error('[auth/callback] Error provisioning new profile:', insertError.message);
        // Fallback tetap arahkan ke waiting-approval jika insert gagal sementara
      }
      status = 'pending';
    }

    // Redirect berdasar status
    // Menggunakan x-forwarded-host untuk mendukung load balancer / proxy di production
    const forwardedHost = request.headers.get('x-forwarded-host');
    const isProtoHttps = request.headers.get('x-forwarded-proto') === 'https' || origin.startsWith('https');
    
    // Pastikan host yang dipakai sesuai jika ada forwarding header
    const redirectHost = forwardedHost 
      ? `${isProtoHttps ? 'https' : 'http'}://${forwardedHost}` 
      : origin;

    if (status === 'pending') {
      return NextResponse.redirect(`${redirectHost}/waiting-approval`);
    }

    return NextResponse.redirect(`${redirectHost}${next}`);
  } catch (error) {
    console.error('[auth/callback] Unexpected error during OAuth callback:', error);
    return NextResponse.redirect(`${origin}/?auth=login&message=auth-error`);
  }
}
