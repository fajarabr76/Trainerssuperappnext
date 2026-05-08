import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
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
    const { data: session, error: sessionError } = await supabase
      .from('ketik_history')
      .select('user_id, review_status')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 403 });
    }

    // 2. Check if job already exists
    const { data: existingJob } = await supabase
      .from('ketik_review_jobs')
      .select('status')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existingJob) {
      // Normalisasi status: queued tampil sebagai processing di UI
      const clientStatus = existingJob.status === 'queued' ? 'processing' : existingJob.status;
      
      if (session.review_status !== existingJob.status && session.review_status !== 'completed') {
         await supabase.from('ketik_history').update({ review_status: existingJob.status }).eq('id', sessionId);
      }
      return NextResponse.json({ ok: true, status: clientStatus });
    }

    // 3. Enqueue job
    const { error: insertError } = await supabase
      .from('ketik_review_jobs')
      .insert({ session_id: sessionId, status: 'queued' });

    if (insertError) {
      // Duplicate insert race: treat as idempotent success.
      if ((insertError as { code?: string }).code !== '23505') {
        throw insertError;
      }
    }

    // 4. Update history status
    await supabase
      .from('ketik_history')
      .update({ review_status: 'processing' })
      .eq('id', sessionId);

    // Manual-only trigger: We only enqueue the job here.
    // The worker or another manual trigger will process it.
    // Return 'processing' (normalized from 'queued') for instant feedback.
    return NextResponse.json({ ok: true, status: 'processing' });
  } catch (error) {
    console.error('[Ketik Review Route] Failed to enqueue review session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enqueue review session' },
      { status: 500 }
    );
  }
}
