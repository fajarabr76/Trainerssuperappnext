import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { normalizeRole } from '@/app/lib/authz';
import { consumeRateLimit } from '@/app/lib/rate-limit';

export async function POST(request: Request) {
  try {
    // Verifikasi bahwa yang request adalah Trainer
    const supabaseServer = await createServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: callerProfile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const callerRole = normalizeRole(callerProfile?.role);
    if (!['trainer', 'admin', 'superadmin'].includes(callerRole)) {
      return NextResponse.json({ error: 'Forbidden: Only trainers, admin, or superadmin can reset passwords' }, { status: 403 });
    }

    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimit = await consumeRateLimit({
      key: `reset-password:${user.id}:${forwardedFor}`,
      limit: 5,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan reset password. Coba lagi beberapa saat lagi.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    // Ambil email dari request body
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validasi: pastikan email target terdaftar di sistem
    const { data: targetProfile } = await supabaseServer
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!targetProfile) {
      return NextResponse.json(
        { error: 'Email tidak ditemukan di sistem' },
        { status: 404 }
      );
    }

    // Gunakan service role untuk kirim reset email
    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
