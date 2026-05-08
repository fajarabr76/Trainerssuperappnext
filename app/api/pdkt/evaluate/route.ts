import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { evaluateAgentResponse } from '@/app/(main)/pdkt/services/geminiService';
import { EmailMessage } from '@/app/(main)/pdkt/types';

export async function POST(request: Request) {
  let historyId: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    historyId = body?.historyId;

    if (!historyId || typeof historyId !== 'string') {
      return NextResponse.json({ error: 'historyId is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const startedAt = new Date().toISOString();

    const { data: claimedRow, error: claimError } = await admin
      .from('pdkt_history')
      .update({
        evaluation_started_at: startedAt,
        evaluation_error: null,
      })
      .eq('id', historyId)
      .eq('user_id', user.id)
      .eq('evaluation_status', 'processing')
      .is('evaluation_started_at', null)
      .select('id, user_id, config, emails, time_taken')
      .maybeSingle();

    if (claimError) {
      throw claimError;
    }

    if (!claimedRow) {
      const { data: currentRow, error: currentError } = await admin
        .from('pdkt_history')
        .select('id, evaluation_status, evaluation_started_at')
        .eq('id', historyId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (currentError) {
        throw currentError;
      }

      if (!currentRow) {
        return NextResponse.json({ error: 'History not found' }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        status: currentRow.evaluation_status,
      });
    }

    const emails = Array.isArray(claimedRow.emails) ? (claimedRow.emails as unknown as EmailMessage[]) : [];
    const lastConsumerEmail = [...emails].reverse().find((email) => !email?.isAgent);
    const lastAgentEmail = [...emails].reverse().find((email) => email?.isAgent);

    if (!lastConsumerEmail?.body || !lastAgentEmail?.body) {
      throw new Error('Riwayat email tidak lengkap untuk evaluasi.');
    }

    const modelId = claimedRow.config?.selectedModel || claimedRow.config?.model;
    const evaluation = await evaluateAgentResponse(lastAgentEmail.body, lastConsumerEmail.body, modelId, user.id);
    const completedAt = new Date().toISOString();

    const { error: updateError } = await admin
      .from('pdkt_history')
      .update({
        evaluation,
        evaluation_status: 'completed',
        evaluation_error: null,
        evaluation_completed_at: completedAt,
      })
      .eq('id', historyId)
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    const subject =
      emails.length > 0 && typeof emails[0]?.subject === 'string'
        ? emails[0].subject
        : 'No Subject';

    const consumerName =
      typeof claimedRow.config?.identity?.name === 'string'
        ? claimedRow.config.identity.name
        : 'Unknown';

    await admin.from('results').insert([{
      user_id: user.id,
      module: 'pdkt',
      score: evaluation.score,
      details: {
        subject,
        feedback: evaluation.feedback,
        consumer: consumerName,
        timeTaken: claimedRow.time_taken ?? 0,
      },
    }]);

    return NextResponse.json({ ok: true, status: 'completed' });
  } catch (error) {
    console.error('[PDKT Evaluate Route] Failed to evaluate session:', error);

    try {
      if (historyId && typeof historyId === 'string') {
        const admin = createAdminClient();
        await admin
          .from('pdkt_history')
          .update({
            evaluation_status: 'failed',
            evaluation_error: error instanceof Error ? error.message : 'Unknown evaluation error',
            evaluation_completed_at: new Date().toISOString(),
          })
          .eq('id', historyId);
      }
    } catch (secondaryError) {
      console.error('[PDKT Evaluate Route] Failed to mark history as failed:', secondaryError);
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to evaluate session' },
      { status: 500 }
    );
  }
}
