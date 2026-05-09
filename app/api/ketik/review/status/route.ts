import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('ketik_history')
    .select('id, user_id, review_status, final_score, empathy_score, probing_score, typo_score, compliance_score')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session || session.user_id !== user.id) {
    return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
  }

  let status = session.review_status || 'pending';
  let resultReady = false;
  let scores = null;

  if (status === 'completed') {
    // Auto-heal check
    const { data: review, error: reviewError } = await supabaseAdmin
      .from('ketik_session_reviews')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!review || reviewError) {
      // Auto-heal: reset status to failed
      status = 'failed';
      await supabaseAdmin
        .from('ketik_history')
        .update({ review_status: 'failed' })
        .eq('id', sessionId);
        
      await supabaseAdmin
        .from('ketik_review_jobs')
        .update({ status: 'failed' })
        .eq('session_id', sessionId);
    } else {
      resultReady = true;
      scores = {
        final: session.final_score,
        empathy: session.empathy_score,
        probing: session.probing_score,
        typo: session.typo_score,
        compliance: session.compliance_score
      };
    }
  }

  // Queue lifecycle is internal; UI should treat queued as processing.
  if (status === 'queued') {
    status = 'processing';
  }

  return NextResponse.json({ status, resultReady, scores });
}
