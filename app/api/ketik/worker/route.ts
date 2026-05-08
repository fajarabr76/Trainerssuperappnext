import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { claimAndProcessKetikReviewJob } from '@/app/actions/ketik-ai-review';

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

  try {
    // Process the review using the shared helper
    const result = await claimAndProcessKetikReviewJob(candidate.session_id, workerId);
    
    if (result.status === 'failed') {
       return NextResponse.json({ message: 'Job failed', error: (result as any).error }, { status: 200 });
    }
    
    return NextResponse.json({ message: 'Job processed successfully' }, { status: 200 });
  } catch (error) {
    const error_message = error instanceof Error ? error.message : 'Unknown processing error';
    return NextResponse.json({ message: 'Internal worker error', error: error_message }, { status: 500 });
  }
}
