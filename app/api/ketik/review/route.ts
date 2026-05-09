import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { claimAndProcessKetikReviewJob } from '@/app/actions/ketik-ai-review';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const sessionId = body?.sessionId;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // 1. Verify session ownership
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('ketik_history')
      .select('user_id, review_status')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 403 });
    }

    // 2. Check if job already exists
    const { data: existingJob } = await supabaseAdmin
      .from('ketik_review_jobs')
      .select('status')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existingJob?.status === 'completed') {
      if (session.review_status !== 'completed') {
        await supabaseAdmin.from('ketik_history').update({ review_status: 'completed' }).eq('id', sessionId);
      }

      return NextResponse.json({ ok: true, status: 'completed' });
    }

    if (existingJob?.status === 'processing') {
      if (session.review_status !== 'processing') {
        await supabaseAdmin.from('ketik_history').update({ review_status: 'processing' }).eq('id', sessionId);
      }

      return NextResponse.json({ ok: true, status: 'processing' });
    }

    if (existingJob?.status === 'failed') {
      const { error: retryError } = await supabaseAdmin
        .from('ketik_review_jobs')
        .update({
          status: 'queued',
          lease_owner: null,
          lease_expires_at: null,
          error_message: null,
        })
        .eq('session_id', sessionId);

      if (retryError) {
        throw retryError;
      }
    }

    if (!existingJob) {
      // 3. Enqueue job
      const { error: insertError } = await supabaseAdmin
        .from('ketik_review_jobs')
        .insert({ session_id: sessionId, status: 'queued' });

      if (insertError) {
        // Duplicate insert race: treat as idempotent success.
        if ((insertError as { code?: string }).code !== '23505') {
          throw insertError;
        }
      }
    }

    // 4. Update history status
    await supabaseAdmin
      .from('ketik_history')
      .update({ review_status: 'processing' })
      .eq('id', sessionId);

    // Manual-only trigger: processing begins only after the user clicks
    // "Mulai Analisis". We claim the queued job here so deployments without a
    // separate cron worker do not leave the modal stuck in a loading state.
    const workerId = `ketik-review-route-${Date.now()}`;
    const result = await claimAndProcessKetikReviewJob(sessionId, workerId);

    if (result.status === 'failed') {
      return NextResponse.json({ ok: false, status: 'failed', error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    console.error('[Ketik Review Route] Failed to enqueue review session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enqueue review session' },
      { status: 500 }
    );
  }
}
