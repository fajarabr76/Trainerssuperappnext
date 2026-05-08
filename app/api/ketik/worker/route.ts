import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { processKetikReviewJob } from '@/app/actions/ketik-ai-review';

export const maxDuration = 300;

export async function GET(req: Request) {
  const supabaseAdmin = createAdminClient();
  const workerId = req.headers.get('x-worker-id') || `ketik-worker-${Date.now()}`;

  // Fetch oldest claimable job candidate
  const nowIso = new Date().toISOString();
  const { data: candidate, error: jobError } = await supabaseAdmin
    .from('ketik_review_jobs')
    .select('id, session_id, status, attempt_count, lease_expires_at')
    .or(`status.eq.queued,and(status.eq.processing,lease_expires_at.lt.${nowIso})`)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (jobError) {
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
  }

  if (!candidate) {
    return NextResponse.json({ message: 'No jobs to process' }, { status: 200 });
  }

  const nextAttempt = (candidate.attempt_count || 0) + 1;

  if (nextAttempt >= 3) {
    // Fail job
    await supabaseAdmin
      .from('ketik_review_jobs')
      .update({
        status: 'failed',
        error_message: 'Max attempts reached',
      })
      .eq('id', candidate.id);
      
    await supabaseAdmin
      .from('ketik_history')
      .update({ review_status: 'failed' })
      .eq('id', candidate.session_id);

    return NextResponse.json({ message: 'Job failed: max attempts reached' }, { status: 200 });
  }

  // Atomic-ish claim: only one worker can transition to processing on this row version.
  const leaseExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { error: claimError } = await supabaseAdmin
    .from('ketik_review_jobs')
    .update({
      status: 'processing',
      lease_owner: workerId,
      lease_expires_at: leaseExpiresAt,
      attempt_count: nextAttempt,
      error_message: null,
    })
    .eq('id', candidate.id);

  if (claimError) {
    return NextResponse.json({ error: 'Failed to claim job', detail: claimError.message }, { status: 500 });
  }

  try {
    // Process the review
    await processKetikReviewJob(candidate.session_id);
    
    // The processKetikReviewJob handles marking job as completed
    return NextResponse.json({ message: 'Job processed successfully' }, { status: 200 });
  } catch (error) {
    const error_message = error instanceof Error ? error.message : 'Unknown processing error';
    
    // Catch processing error and mark failed
    await supabaseAdmin
      .from('ketik_review_jobs')
      .update({
        status: 'failed',
        error_message,
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq('id', candidate.id);
      
    await supabaseAdmin
      .from('ketik_history')
      .update({ review_status: 'failed' })
      .eq('id', candidate.session_id);
      
    return NextResponse.json({ message: 'Job processed with error', error: error_message }, { status: 200 });
  }
}
