import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { evaluateAgentResponse } from '@/app/(main)/pdkt/services/geminiService';
import { EvaluationResult } from '../types';

/**
 * Shared internal helper for processing PDKT evaluation.
 * This can be called from both Route Handlers and Server Actions.
 */
export async function processPdktEvaluation(historyId: string, userId: string) {
  const supabase = createAdminClient();

  // 1. Fetch the history row and verify ownership
  const { data: history, error: fetchError } = await supabase
    .from('pdkt_history')
    .select('*')
    .eq('id', historyId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !history) {
    throw new Error('PDKT History not found');
  }

  // 2. Check if already completed or stale
  // Mailbox RPC creates rows with evaluation_status='processing' but evaluation_started_at=NULL
  // until this worker stamps started_at — those must not be treated as "already running".
  // We only block when another run has already set evaluation_started_at and it is fresh.
  const isStale =
    history.evaluation_status === 'processing' &&
    history.evaluation_started_at != null &&
    new Date().getTime() - new Date(history.evaluation_started_at).getTime() > 5 * 60 * 1000;

  if (history.evaluation_status === 'completed' && history.evaluation) {
    return history.evaluation as EvaluationResult;
  }

  if (
    history.evaluation_status === 'processing' &&
    history.evaluation_started_at != null &&
    !isStale
  ) {
    throw new Error('Evaluation is already in progress');
  }

  // 3. Mark as processing
  const { error: updateStartError } = await supabase
    .from('pdkt_history')
    .update({
      evaluation_status: 'processing',
      evaluation_started_at: new Date().toISOString(),
      evaluation_error: null
    })
    .eq('id', historyId);

  if (updateStartError) {
    throw new Error('Failed to update evaluation status');
  }

  try {
    // 4. Run AI Evaluation
    const evaluation = await evaluateAgentResponse(history.emails, history.config);

    // 5. Save results
    const { error: updateEndError } = await supabase
      .from('pdkt_history')
      .update({
        evaluation_status: 'completed',
        evaluation: evaluation,
        evaluation_completed_at: new Date().toISOString()
      })
      .eq('id', historyId);

    if (updateEndError) {
      throw new Error('Failed to save evaluation results');
    }

    return evaluation;
  } catch (error: any) {
    console.error('[processPdktEvaluation] Error:', error);
    
    // 6. Record failure
    await supabase
      .from('pdkt_history')
      .update({
        evaluation_status: 'failed',
        evaluation_error: error.message || 'Unknown error during evaluation'
      })
      .eq('id', historyId);

    throw error;
  }
}
