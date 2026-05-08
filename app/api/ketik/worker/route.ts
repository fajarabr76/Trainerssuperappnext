import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { processKetikReviewJob } from '@/app/actions/ketik-ai-review';

export const maxDuration = 300;

export async function GET(req: Request) {
  const supabaseAdmin = createAdminClient();

  // Fetch 1 job
  // We want status = 'pending' OR (status = 'processing' AND leased_until < now())
  const { data: job, error: jobError } = await supabaseAdmin
    .from('ketik_review_jobs')
    .select('*')
    .or('status.eq.pending,and(status.eq.processing,leased_until.lt.now())')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (jobError) {
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
  }

  if (!job) {
    return NextResponse.json({ message: 'No jobs to process' }, { status: 200 });
  }

  // Increment attempt_count
  const attempt_count = (job.attempt_count || 0) + 1;

  if (attempt_count >= 3) {
    // Fail job
    await supabaseAdmin
      .from('ketik_review_jobs')
      .update({ status: 'failed', error_message: 'Max attempts reached' })
      .eq('id', job.id);
      
    await supabaseAdmin
      .from('ketik_history')
      .update({ review_status: 'failed' })
      .eq('id', job.session_id);

    return NextResponse.json({ message: 'Job failed: max attempts reached' }, { status: 200 });
  }

  // Claim lease: set status = 'processing', leased_until = now() + 5 minutes
  const leased_until = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from('ketik_review_jobs')
    .update({ status: 'processing', leased_until, attempt_count })
    .eq('id', job.id);

  try {
    // Process the review
    await processKetikReviewJob(job.session_id);
    
    // The processKetikReviewJob handles marking job as completed
    return NextResponse.json({ message: 'Job processed successfully' }, { status: 200 });
  } catch (error) {
    const error_message = error instanceof Error ? error.message : 'Unknown processing error';
    
    // Catch processing error and mark failed
    await supabaseAdmin
      .from('ketik_review_jobs')
      .update({ status: 'failed', error_message })
      .eq('id', job.id);
      
    await supabaseAdmin
      .from('ketik_history')
      .update({ review_status: 'failed' })
      .eq('id', job.session_id);
      
    return NextResponse.json({ message: 'Job processed with error', error: error_message }, { status: 200 });
  }
}
