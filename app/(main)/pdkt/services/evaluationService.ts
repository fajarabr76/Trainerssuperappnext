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

  // 2. Check if already completed
  if (history.evaluation_status === 'completed' && history.evaluation) {
    return history.evaluation as EvaluationResult;
  }

  // 3. Atomic claim: stamp evaluation_started_at only if still unclaimed.
  //    Mailbox RPC creates rows with evaluation_status='processing' but
  //    evaluation_started_at=NULL — the first caller to stamp it wins.
  const nowIso = new Date().toISOString();
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: claimed, error: claimError } = await supabase
    .from('pdkt_history')
    .update({
      evaluation_status: 'processing',
      evaluation_started_at: nowIso,
      evaluation_error: null,
    })
    .eq('id', historyId)
    .eq('user_id', userId)
    .or(`evaluation_started_at.is.null,evaluation_started_at.lt.${staleThreshold}`)
    .neq('evaluation_status', 'completed')
    .select('id');

  if (claimError) {
    throw new Error('Failed to claim evaluation');
  }

  if (!claimed || claimed.length === 0) {
    const { data: current } = await supabase
      .from('pdkt_history')
      .select('evaluation_status, evaluation_started_at')
      .eq('id', historyId)
      .eq('user_id', userId)
      .maybeSingle();

    if (current?.evaluation_status === 'completed') {
      const { data: completed } = await supabase
        .from('pdkt_history')
        .select('evaluation')
        .eq('id', historyId)
        .single();
      if (completed?.evaluation) return completed.evaluation as EvaluationResult;
      throw new Error('Evaluation marked completed but no results found');
    }

    throw new Error('Evaluation is already in progress');
  }

  try {
    // 4. Run AI Evaluation
    const evaluation = await evaluateAgentResponse(history.emails, history.config);

    // 5. Save results — fenced by evaluation_started_at to prevent a stale
    //    worker from overwriting a newer claim's results.
    const { data: saved, error: updateEndError } = await supabase
      .from('pdkt_history')
      .update({
        evaluation_status: 'completed',
        evaluation: evaluation,
        evaluation_completed_at: new Date().toISOString()
      })
      .eq('id', historyId)
      .eq('evaluation_started_at', nowIso)
      .select('id');

    if (updateEndError) {
      throw new Error('Failed to save evaluation results');
    }

    if (!saved || saved.length === 0) {
      // Another worker claimed and may have already completed — do not overwrite.
      console.warn(`[processPdktEvaluation] Lease lost before save for history: ${historyId}`);
      return evaluation; // Return the computed result but don't persist stale data
    }

    return evaluation;
  } catch (error: any) {
    console.error('[processPdktEvaluation] Error:', error);
    
    // 6. Record failure — only if we still own the lease (evaluation_started_at matches).
    //    If another worker has claimed, let them handle the outcome.
    await supabase
      .from('pdkt_history')
      .update({
        evaluation_status: 'failed',
        evaluation_error: error.message || 'Unknown error during evaluation'
      })
      .eq('id', historyId)
      .eq('evaluation_started_at', nowIso);

    throw error;
  }
}
