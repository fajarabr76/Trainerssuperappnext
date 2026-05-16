/**
 * Fallback Response Manager - Pure Function Guard
 *
 * Detects AI non-response after the agent finishes speaking and injects
 * persona-appropriate fallback utterances in Indonesian to maintain
 * conversation flow. Follows the pure function guard pattern from
 * stalledResponseGuards.ts.
 *
 * Key behaviors:
 * - 1s cooldown after agent stops speaking before fallback can trigger
 * - 5s timeout (configurable) for AI response before fallback injection
 * - Tracks consecutive failures: 2 failures → session recovery
 * - Resets counter on valid model response
 *
 * @module fallbackResponseManager
 */

import type {
  ConsumerPersonaType,
  ConversationPhase,
  TelefunSessionState,
} from './types';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface FallbackState {
  waitingSince: number | null;
  consecutiveFailures: number;
  lastFallbackAt: number | null;
  sessionPaused: boolean;
}

export interface FallbackInput {
  now: number;
  sessionState: TelefunSessionState;
  agentStoppedSpeakingAt: number | null;
  personaType: ConsumerPersonaType;
  conversationPhase: ConversationPhase;
  timeoutMs?: number; // default 5000
  cooldownMs?: number; // default 1000 after agent stops
}

export type FallbackAction =
  | 'none'
  | 'inject_fallback'
  | 'session_recovery'
  | 'reset_counter';

export interface FallbackResult {
  state: FallbackState;
  action: FallbackAction;
  utterance?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_COOLDOWN_MS = 1000;
const MAX_CONSECUTIVE_FAILURES = 2;

// ---------------------------------------------------------------------------
// Utterance Pools (Indonesian)
// ---------------------------------------------------------------------------

/**
 * Persona-phase utterance pools for fallback responses.
 * Each pool contains contextually appropriate Indonesian utterances
 * organized by persona type and conversation phase.
 */
const FALLBACK_UTTERANCE_POOLS: Record<
  ConsumerPersonaType,
  Record<ConversationPhase, string[]>
> = {
  angry: {
    greeting: [
      'Halo? Ada orang nggak sih?',
      'Woi, masih di sana?',
      'Halo? Kok diam?',
    ],
    problem_statement: [
      'Halo? Saya lagi ngomong ini!',
      'Kok nggak dijawab sih?',
      'Masih dengerin nggak?',
    ],
    explanation: [
      'Terus gimana? Kok diam?',
      'Jadi solusinya apa? Jawab dong!',
      'Halo? Saya nunggu jawaban nih!',
    ],
    negotiation: [
      'Jadi gimana keputusannya?',
      'Kok lama banget sih jawabnya?',
      'Saya nggak punya waktu banyak ya!',
    ],
    closing: [
      'Masih ada yang mau disampaikan?',
      'Halo? Sudah selesai belum?',
      'Oke kalau nggak ada lagi ya.',
    ],
  },
  confused: {
    greeting: [
      'Halo? Maaf, saya masih di sini.',
      'Eh, masih tersambung ya?',
      'Halo? Bisa dengar saya?',
    ],
    problem_statement: [
      'Maaf, saya bingung. Bisa diulang?',
      'Eh, tadi apa ya? Saya kurang paham.',
      'Halo? Saya masih nunggu penjelasan.',
    ],
    explanation: [
      'Maaf, saya masih kurang ngerti. Bisa dijelaskan lagi?',
      'Halo? Tadi sampai mana ya?',
      'Eh, jadi gimana maksudnya?',
    ],
    negotiation: [
      'Jadi yang mana yang harus saya pilih?',
      'Maaf, saya bingung harus gimana.',
      'Bisa diulang pilihannya?',
    ],
    closing: [
      'Eh, sudah selesai ya?',
      'Maaf, tadi ada yang perlu saya lakukan lagi?',
      'Halo? Masih ada yang perlu dibahas?',
    ],
  },
  rushed: {
    greeting: [
      'Halo? Saya buru-buru nih.',
      'Masih di sana? Saya nggak banyak waktu.',
      'Halo? Cepat ya.',
    ],
    problem_statement: [
      'Kok lama? Saya sibuk nih.',
      'Halo? Bisa cepat nggak?',
      'Saya nunggu ya, tapi cepat.',
    ],
    explanation: [
      'Jadi intinya apa? Cepat dong.',
      'Halo? Langsung ke poinnya aja.',
      'Saya nggak punya waktu lama-lama.',
    ],
    negotiation: [
      'Cepat putuskan dong.',
      'Jadi gimana? Saya harus pergi sebentar lagi.',
      'Langsung aja, mau yang mana?',
    ],
    closing: [
      'Oke sudah ya? Saya harus pergi.',
      'Ada lagi nggak? Saya buru-buru.',
      'Kalau sudah, saya tutup ya.',
    ],
  },
  passive: {
    greeting: [
      'Halo... masih di sana ya?',
      'Oh, saya masih nunggu.',
      'Halo?',
    ],
    problem_statement: [
      'Hmm, saya masih di sini.',
      'Oh, iya. Saya nunggu.',
      'Halo? Tidak apa-apa, saya tunggu.',
    ],
    explanation: [
      'Oh, iya. Saya dengarkan.',
      'Hmm, lanjut ya kalau sudah siap.',
      'Saya masih di sini kok.',
    ],
    negotiation: [
      'Iya, saya tunggu keputusannya.',
      'Tidak apa-apa, ambil waktu saja.',
      'Hmm, jadi gimana ya?',
    ],
    closing: [
      'Oh, sudah selesai ya?',
      'Iya, terima kasih.',
      'Hmm, oke kalau begitu.',
    ],
  },
  critical: {
    greeting: [
      'Halo? Saya sudah menunggu lama.',
      'Masih di sana? Tolong profesional sedikit.',
      'Halo? Ini sudah lama sekali.',
    ],
    problem_statement: [
      'Kok tidak ada respons? Ini tidak profesional.',
      'Saya menunggu jawaban yang jelas.',
      'Halo? Tolong ditanggapi dengan serius.',
    ],
    explanation: [
      'Jadi bagaimana kelanjutannya?',
      'Saya butuh jawaban yang konkret.',
      'Tolong jangan buat saya menunggu lama.',
    ],
    negotiation: [
      'Saya perlu keputusan yang jelas.',
      'Ini sudah terlalu lama. Bagaimana?',
      'Tolong segera berikan solusinya.',
    ],
    closing: [
      'Baik, ada lagi yang perlu disampaikan?',
      'Kalau sudah selesai, saya harap ini tidak terulang.',
      'Oke, saya catat semua ini.',
    ],
  },
  cooperative: {
    greeting: [
      'Halo, saya masih di sini. Bisa diulang sedikit?',
      'Maaf, tadi agak kurang jelas.',
      'Halo? Tidak apa-apa, saya tunggu.',
    ],
    problem_statement: [
      'Iya, saya masih mendengarkan.',
      'Maaf, bisa diulang tadi?',
      'Halo? Saya masih di sini kok.',
    ],
    explanation: [
      'Iya, saya paham. Lanjut ya.',
      'Oh begitu. Bisa dijelaskan lagi bagian tadi?',
      'Maaf, tadi saya kurang dengar. Bisa diulang?',
    ],
    negotiation: [
      'Iya, saya setuju. Lanjut ya.',
      'Baik, jadi langkah selanjutnya apa?',
      'Oke, saya ikut saran Anda.',
    ],
    closing: [
      'Baik, terima kasih banyak ya.',
      'Oke, ada lagi yang perlu saya tahu?',
      'Terima kasih, sudah sangat membantu.',
    ],
  },
};

// ---------------------------------------------------------------------------
// High-intensity utterance variants
// When emotionalIntensity >= 7, use more intense versions for certain personas
// ---------------------------------------------------------------------------

const HIGH_INTENSITY_OVERRIDES: Partial<
  Record<ConsumerPersonaType, Record<ConversationPhase, string[]>>
> = {
  angry: {
    greeting: [
      'HEH! Ada orang nggak sih di sana?!',
      'Woi! Jawab dong!',
      'Ini gimana sih pelayanannya?!',
    ],
    problem_statement: [
      'Ini nggak bisa diterima! Jawab!',
      'Saya sudah capek nunggu! Gimana sih?!',
      'Kok bisa diam aja?! Ini masalah serius!',
    ],
    explanation: [
      'Jawab yang bener dong! Jangan diam aja!',
      'Saya mau solusi sekarang! Bukan diam!',
      'Ini sudah keterlaluan! Mana jawabannya?!',
    ],
    negotiation: [
      'Saya mau bicara sama atasan Anda!',
      'Ini nggak bisa ditoleransi lagi!',
      'Putuskan sekarang atau saya komplain!',
    ],
    closing: [
      'Saya akan laporkan ini!',
      'Pelayanan macam apa ini?!',
      'Sudah! Saya kecewa berat!',
    ],
  },
  critical: {
    greeting: [
      'Ini sudah sangat tidak profesional.',
      'Saya kecewa dengan pelayanan ini.',
      'Berapa lama lagi saya harus menunggu?',
    ],
    problem_statement: [
      'Ini benar-benar mengecewakan.',
      'Saya akan pertimbangkan untuk komplain resmi.',
      'Tolong tanggapi dengan serius.',
    ],
    explanation: [
      'Saya butuh penjelasan yang memuaskan.',
      'Ini tidak bisa diterima begitu saja.',
      'Tolong berikan solusi yang nyata.',
    ],
    negotiation: [
      'Saya perlu berbicara dengan supervisor.',
      'Ini sudah melewati batas kesabaran saya.',
      'Berikan solusi terbaik Anda sekarang.',
    ],
    closing: [
      'Saya akan follow up masalah ini.',
      'Ini akan saya eskalasi.',
      'Saya harap ada perbaikan signifikan.',
    ],
  },
};

// ---------------------------------------------------------------------------
// Pure Functions
// ---------------------------------------------------------------------------

/**
 * Creates the initial fallback state.
 */
export function createInitialFallbackState(): FallbackState {
  return {
    waitingSince: null,
    consecutiveFailures: 0,
    lastFallbackAt: null,
    sessionPaused: false,
  };
}

/**
 * Evaluates the current fallback state and determines the appropriate action.
 *
 * Logic:
 * 1. If session is paused → 'none'
 * 2. If model produced a valid response (sessionState changed from ai_thinking) → 'reset_counter'
 * 3. If agent is still speaking or within cooldown → 'none'
 * 4. If waiting and timeout exceeded:
 *    - If consecutiveFailures >= MAX → 'session_recovery'
 *    - Otherwise → 'inject_fallback'
 * 5. If not yet waiting but conditions met → start waiting (return 'none')
 */
export function evaluateFallback(
  state: FallbackState,
  input: FallbackInput
): FallbackResult {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const nextState = { ...state };

  // If the model is now speaking (valid response received), reset counter
  if (
    input.sessionState === 'ai_speaking' &&
    state.consecutiveFailures > 0
  ) {
    nextState.consecutiveFailures = 0;
    nextState.waitingSince = null;
    nextState.sessionPaused = false;
    return { state: nextState, action: 'reset_counter' };
  }

  // Session is paused — do nothing
  if (state.sessionPaused) {
    return { state: nextState, action: 'none' };
  }

  // Agent is currently speaking — no fallback
  if (input.sessionState === 'user_speaking') {
    nextState.waitingSince = null;
    return { state: nextState, action: 'none' };
  }

  // Not in a state where we expect AI response — no fallback
  if (input.sessionState !== 'ai_thinking') {
    return { state: nextState, action: 'none' };
  }

  // Agent stopped speaking timestamp is required for cooldown check
  if (input.agentStoppedSpeakingAt === null) {
    return { state: nextState, action: 'none' };
  }

  // Cooldown: must wait at least cooldownMs after agent stops speaking
  const timeSinceAgentStopped = input.now - input.agentStoppedSpeakingAt;
  if (timeSinceAgentStopped < cooldownMs) {
    return { state: nextState, action: 'none' };
  }

  // Start waiting if not already
  if (state.waitingSince === null) {
    nextState.waitingSince = input.now;
    return { state: nextState, action: 'none' };
  }

  // Check if timeout has been reached
  const waitingDuration = input.now - state.waitingSince;
  if (waitingDuration < timeoutMs) {
    return { state: nextState, action: 'none' };
  }

  // Timeout reached — check if we should recover or inject fallback
  if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    nextState.sessionPaused = true;
    nextState.waitingSince = null;
    return { state: nextState, action: 'session_recovery' };
  }

  // Inject fallback utterance
  const utterance = getFallbackUtterance(
    input.personaType,
    input.conversationPhase,
    getEmotionalIntensityForFallback(state.consecutiveFailures)
  );

  nextState.consecutiveFailures = state.consecutiveFailures + 1;
  nextState.lastFallbackAt = input.now;
  nextState.waitingSince = input.now; // Reset waiting timer for next timeout check

  return { state: nextState, action: 'inject_fallback', utterance };
}

/**
 * Selects a persona-appropriate fallback utterance based on persona type,
 * conversation phase, and emotional intensity.
 *
 * Higher emotional intensity (>= 7) selects from high-intensity pools
 * for personas that have them (angry, critical).
 *
 * Selection is deterministic based on a hash of the parameters to ensure
 * testability while providing variety across different invocations.
 */
export function getFallbackUtterance(
  personaType: ConsumerPersonaType,
  phase: ConversationPhase,
  emotionalIntensity: number
): string {
  // Use high-intensity overrides for intense personas
  if (emotionalIntensity >= 7) {
    const overrides = HIGH_INTENSITY_OVERRIDES[personaType];
    if (overrides && overrides[phase] && overrides[phase].length > 0) {
      const pool = overrides[phase];
      return selectFromPool(pool, personaType, phase, emotionalIntensity);
    }
  }

  // Use standard pool
  const pool = FALLBACK_UTTERANCE_POOLS[personaType][phase];
  return selectFromPool(pool, personaType, phase, emotionalIntensity);
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Selects an utterance from a pool using a simple deterministic selection
 * based on emotional intensity to provide variety.
 */
function selectFromPool(
  pool: string[],
  _personaType: ConsumerPersonaType,
  _phase: ConversationPhase,
  emotionalIntensity: number
): string {
  if (pool.length === 0) {
    return 'Halo?';
  }
  const index = Math.abs(Math.round(emotionalIntensity)) % pool.length;
  return pool[index];
}

/**
 * Maps consecutive failure count to an emotional intensity value
 * for utterance selection. More failures → higher intensity.
 */
function getEmotionalIntensityForFallback(consecutiveFailures: number): number {
  // Base intensity 5, increases with failures
  return Math.min(10, 5 + consecutiveFailures * 2);
}

/**
 * Returns all utterances in the pool for a given persona-phase combination.
 * Useful for property-based testing to verify utterance membership.
 */
export function getUtterancePool(
  personaType: ConsumerPersonaType,
  phase: ConversationPhase,
  emotionalIntensity: number
): string[] {
  if (emotionalIntensity >= 7) {
    const overrides = HIGH_INTENSITY_OVERRIDES[personaType];
    if (overrides && overrides[phase] && overrides[phase].length > 0) {
      return overrides[phase];
    }
  }
  return FALLBACK_UTTERANCE_POOLS[personaType][phase];
}
