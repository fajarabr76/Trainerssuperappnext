'use server';

import { createClient } from '@/app/lib/supabase/server';
import { PdktMailboxItem, Scenario, SessionConfig, EmailMessage } from './types';
import { initializeEmailSession, InitializeEmailSessionResult, generateScenarioEmailTemplate } from './services/geminiService';
import { processPdktEvaluation } from './services/evaluationService';
import { revalidatePath } from 'next/cache';
import { AppSettings } from './types';

/**
 * AI action to generate a scenario email template.
 */
export async function generateTemplate(scenarioDraft: Scenario, settings: AppSettings) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  try {
    const result = await generateScenarioEmailTemplate(scenarioDraft, settings, user.id);
    return result;
  } catch (error: any) {
    console.error('[PDKT Action] Failed to generate template:', error);
    throw new Error(error.message || 'Gagal generate template.');
  }
}

/**
 * Fetch all mailbox items for the current user.
 * Excludes 'deleted' items by default.
 */
export async function fetchMailboxItems(includeDeleted = false) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  let query = supabase
    .from('pdkt_mailbox_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (!includeDeleted) {
    query = query.neq('status', 'deleted');
  }

  const { data, error } = await query;

  if (error) {
    console.error('[PDKT Action] Failed to fetch mailbox items:', error);
    throw new Error('Gagal mengambil data mailbox.');
  }

  return (data || []) as PdktMailboxItem[];
}

/**
 * Create a new mailbox item from a specific scenario.
 * Supports Admin/Trainer fanout via RPC.
 */
export async function createMailboxItem(config: SessionConfig, scenario: Scenario, clientRequestId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  // Ensure config only contains the selected scenario
  const singleScenarioConfig: SessionConfig = {
    ...config,
    scenarios: [scenario]
  };

  // Generate inbound email using AI (or from template if forced)
  const initResult: InitializeEmailSessionResult = await initializeEmailSession(singleScenarioConfig, user.id);

  if (initResult.success === false) {
    throw new Error(initResult.error || 'Gagal membuat email masuk.');
  }

  const inboundEmail = initResult.message;
  const snippet = inboundEmail.body.substring(0, 150) + (inboundEmail.body.length > 150 ? '...' : '');

  // Use RPC for atomic batch insertion with fanout
  const { data: createdId, error } = await supabase.rpc('submit_pdkt_mailbox_batch', {
    p_client_request_id: clientRequestId || `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    p_sender_name: inboundEmail.from === singleScenarioConfig.identity.email ? singleScenarioConfig.identity.name : inboundEmail.from,
    p_sender_email: inboundEmail.from,
    p_subject: inboundEmail.subject || '',
    p_snippet: snippet,
    p_scenario_snapshot: scenario,
    p_config_snapshot: singleScenarioConfig,
    p_inbound_email: inboundEmail
  });

  if (error) {
    console.error('[PDKT Action] Failed to create mailbox batch:', error);
    throw new Error('Gagal menyimpan email baru.');
  }

  revalidatePath('/pdkt');
  
  // Fetch by returned id so concurrent creates cannot select the wrong mailbox row
  const { data: newItem, error: fetchError } = await supabase
    .from('pdkt_mailbox_items')
    .select('*')
    .eq('id', createdId)
    .single();

  if (fetchError || !newItem) {
    console.error('[PDKT Action] Created mailbox item is not visible:', fetchError);
    throw new Error('Gagal mengambil email baru.');
  }

  return newItem as PdktMailboxItem;
}

/**
 * Soft delete a mailbox item.
 */
export async function softDeleteMailboxItem(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('pdkt_mailbox_items')
    .update({ 
      status: 'deleted',
      deleted_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[PDKT Action] Failed to delete mailbox item:', error);
    throw new Error('Gagal menghapus email.');
  }

  revalidatePath('/pdkt');
}

/**
 * Submit a reply to a mailbox item.
 * This calls the SQL RPC to atomically insert into pdkt_history and update mailbox status.
 */
export async function submitMailboxReply(mailboxId: string, agentReply: EmailMessage, timeTaken: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const { data: historyId, error } = await supabase.rpc('submit_pdkt_mailbox_reply', {
    p_mailbox_id: mailboxId,
    p_agent_reply: agentReply,
    p_time_taken: timeTaken
  });

  if (error) {
    console.error('[PDKT Action] Failed to submit mailbox reply:', error);
    throw new Error('Gagal mengirim balasan.');
  }

  // Trigger evaluation internally via helper
  try {
    void processPdktEvaluation(historyId, user.id).catch(err => {
      console.error('[PDKT Action] Async evaluation failed:', err);
    });
  } catch (err) {
    console.warn('[PDKT Action] Immediate evaluation call failed (continuing):', err);
  }

  revalidatePath('/pdkt');
  return historyId as string;
}

/**
 * Manually trigger or retry evaluation for a history session.
 */
export async function retryEvaluation(historyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  try {
    await processPdktEvaluation(historyId, user.id);
    return { success: true };
  } catch (error: any) {
    console.error('[PDKT Action] Failed to retry evaluation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch linked evaluation state for a mailbox item or history session.
 */
export async function fetchEvaluationState(historyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('pdkt_history')
    .select('evaluation, evaluation_status, evaluation_error, time_taken')
    .eq('id', historyId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('[PDKT Action] Failed to fetch evaluation state:', error);
    return null;
  }

  return data;
}
