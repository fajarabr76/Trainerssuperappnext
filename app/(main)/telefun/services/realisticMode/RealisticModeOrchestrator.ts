/**
 * Realistic Mode Orchestrator
 *
 * Coordinates all real-time engines (Turn-Taking, Fallback Response Manager,
 * Prolonged Silence Handler, Hold State Manager, Short Response Classifier,
 * Backchannel Controller, Persona State Machine, Disruption Scenario Engine)
 * within the LiveSession.
 *
 * Design principles:
 * - Graceful degradation: if any engine fails, fall back to existing behavior
 * - Opt-in: only active when realistic_mode_enabled is true
 * - Pure function guards: all engines are stateless pure functions
 * - Shared dependency: Persona State Machine provides context to other engines
 * - Hold State Manager as coordination layer: all engines check suspendEngines
 *   flag before processing
 *
 * @module RealisticModeOrchestrator
 */

import type {
  ConsumerPersonaType,
  ConversationPhase,
  DisruptionType,
  TelefunSessionState,
  TurnTakingEvent,
  DisruptionInstance,
  PersonaIntensitySnapshot,
} from './types';

import {
  evaluateTurnTaking,
  createInitialTurnTakingState,
  type TurnTakingState,
  type TurnTakingInput,
  type TurnTakingAction,
} from './turnTakingEngine';

import {
  evaluateFallback,
  createInitialFallbackState,
  type FallbackState,
} from './fallbackResponseManager';

import {
  evaluateProlongedSilence,
  createInitialSilenceState,
  type ProlongedSilenceState,
  type ProlongedSilenceAction,
} from './prolongedSilenceHandler';

import {
  classifyShortResponse,
  type ClassificationResult,
} from './shortResponseClassifier';

import {
  evaluateBackchannel,
  type BackchannelState,
} from './backchannelController';

import {
  initializePersona,
  reducePersonaState,
  type PersonaState,
  type PersonaEvent,
} from './personaStateMachine';

import {
  initializeDisruptions,
  evaluateDisruption,
  type DisruptionState,
} from './disruptionScenarioEngine';

import {
  initializeHoldState,
  evaluateHoldState,
  createInitialConsentContext,
  type HoldState,
  type HoldInput,
  type HoldResult,
  type ConsentContext,
} from './holdStateManager';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RealisticModeConfig {
  personaType: ConsumerPersonaType;
  disruptionTypes?: DisruptionType[];
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Orchestrator Actions (emitted to LiveSession)
// ---------------------------------------------------------------------------

export type OrchestratorAction =
  | { type: 'none' }
  | { type: 'inject_prompt'; text: string; source: string }
  | { type: 'session_recovery' }
  | { type: 'end_session'; source: string }
  | { type: 'suppress_turn_end' }
  | { type: 'end_of_turn_detected'; confidence: number; delayMs: number }
  | { type: 'hold_state_changed'; suppressMicAudio: boolean; suppressGeminiAudio: boolean; suspendEngines: boolean };

// ---------------------------------------------------------------------------
// Orchestrator Metrics (for session metrics extension)
// ---------------------------------------------------------------------------

export interface RealisticModeMetrics {
  turnTakingEvents: TurnTakingEvent[];
  fallbackCount: number;
  fallbackRecoveryCount: number;
  backchannelCount: number;
  personaIntensityHistory: PersonaIntensitySnapshot[];
  disruptionOutcomes: DisruptionInstance[];
}

// ---------------------------------------------------------------------------
// Orchestrator Class
// ---------------------------------------------------------------------------

export class RealisticModeOrchestrator {
  private enabled: boolean;
  private personaType: ConsumerPersonaType;

  // Engine states
  private turnTakingState: TurnTakingState;
  private fallbackState: FallbackState;
  private silenceState: ProlongedSilenceState;
  private backchannelState: BackchannelState;
  private personaState: PersonaState;
  private disruptionState: DisruptionState | null;
  private holdState: HoldState;

  // Hold State Manager coordination flags
  private _suspendEngines: boolean = false;
  private _suppressMicAudio: boolean = false;
  private _suppressGeminiAudio: boolean = false;

  // Consent context for rude hold detection
  private consentContext: ConsentContext;

  // Tracking
  private conversationPhase: ConversationPhase = 'greeting';
  private exchangeCount: number = 0;
  private agentSpeakingStartMs: number | null = null;
  private agentStoppedSpeakingAt: number | null = null;
  private lastClassification: ClassificationResult | null = null;

  // Metrics
  private turnTakingEvents: TurnTakingEvent[] = [];
  private fallbackCount: number = 0;
  private fallbackRecoveryCount: number = 0;
  private backchannelCount: number = 0;
  private personaIntensityHistory: PersonaIntensitySnapshot[] = [];
  private disruptionOutcomes: DisruptionInstance[] = [];

  constructor(config: RealisticModeConfig) {
    this.enabled = config.enabled;
    this.personaType = config.personaType;

    // Initialize all engine states
    this.turnTakingState = createInitialTurnTakingState();
    this.fallbackState = createInitialFallbackState();
    this.silenceState = createInitialSilenceState();
    this.holdState = initializeHoldState();
    this.consentContext = createInitialConsentContext();
    this.backchannelState = {
      agentSpeakingStartMs: null,
      lastBackchannelAt: null,
      nextBackchannelAt: null,
      suppressedUntil: null,
      isInstructionalContent: false,
    };
    this.personaState = initializePersona(config.personaType);

    // Initialize disruption engine if types are configured
    if (config.disruptionTypes && config.disruptionTypes.length > 0) {
      try {
        this.disruptionState = initializeDisruptions(config.disruptionTypes);
      } catch (e) {
        console.warn('[RealisticMode] Failed to initialize disruptions:', e);
        this.disruptionState = null;
      }
    } else {
      this.disruptionState = null;
    }

    // Record initial persona intensity
    this.personaIntensityHistory.push({
      exchangeIndex: 0,
      intensity: this.personaState.emotionalIntensity,
    });
  }

  /**
   * Whether realistic mode is active.
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Current persona emotional intensity.
   */
  get emotionalIntensity(): number {
    return this.personaState.emotionalIntensity;
  }

  /**
   * Current conversation phase.
   */
  get currentPhase(): ConversationPhase {
    return this.conversationPhase;
  }

  /**
   * Whether engines are currently suspended due to hold state.
   * LiveSession should check this before routing events to engines.
   */
  get suspendEngines(): boolean {
    return this._suspendEngines;
  }

  /**
   * Whether microphone audio should be suppressed (not sent to Gemini).
   * LiveSession should check this in the audio processing pipeline.
   */
  get suppressMicAudio(): boolean {
    return this._suppressMicAudio;
  }

  /**
   * Whether Gemini audio playback should be suppressed.
   * LiveSession should check this before playing audio chunks.
   */
  get suppressGeminiAudio(): boolean {
    return this._suppressGeminiAudio;
  }

  // ---------------------------------------------------------------------------
  // Hold State Management (called from LiveSession)
  // ---------------------------------------------------------------------------

  /**
   * Evaluates hold state based on UI button events and NLP detections.
   * Called from LiveSession when hold-related events occur (button press/release,
   * NLP instruction detection, timer expiry).
   *
   * Returns an OrchestratorAction with the new hold state flags so LiveSession
   * can propagate suppressMicAudio/suppressGeminiAudio/suspendEngines.
   *
   * Graceful degradation: if Hold State Manager throws, returns 'none' and
   * LiveSession falls back to existing isHeld boolean.
   */
  evaluateHoldStateInput(input: Omit<HoldInput, 'consentContext'>): OrchestratorAction {
    if (!this.enabled) {
      return { type: 'none' };
    }

    try {
      const fullInput: HoldInput = {
        ...input,
        consentContext: this.consentContext,
      };

      const result: HoldResult = evaluateHoldState(this.holdState, fullInput);
      this.holdState = result.state;

      // Update coordination flags
      this._suppressMicAudio = result.suppressMicAudio;
      this._suppressGeminiAudio = result.suppressGeminiAudio;
      this._suspendEngines = result.suspendEngines;

      // Propagate hold state to Prolonged Silence Handler
      if (result.action === 'activate_ui_hold') {
        this.silenceState = createInitialSilenceState();
      }

      // When hold deactivates, reset all engine timers
      if (result.action === 'deactivate_hold') {
        this.silenceState = createInitialSilenceState();
      }

      // Handle rude hold → persona escalation
      if (result.isRudeHold) {
        this.updatePersona({ type: 'escalation', trigger: 'rude_hold' });
      }

      return {
        type: 'hold_state_changed',
        suppressMicAudio: result.suppressMicAudio,
        suppressGeminiAudio: result.suppressGeminiAudio,
        suspendEngines: result.suspendEngines,
      };
    } catch (e) {
      console.warn('[RealisticMode] Hold State Manager error:', e);
      // Graceful degradation: return none, LiveSession falls back to isHeld boolean
      return { type: 'none' };
    }
  }

  // ---------------------------------------------------------------------------
  // Audio Event Processing (called from LiveSession's analyzeVolume loop)
  // ---------------------------------------------------------------------------

  /**
   * Processes an audio frame through the Turn-Taking Engine.
   * Called on each audio analysis frame when realistic mode is enabled.
   *
   * Returns an action indicating whether to suppress turn-end detection,
   * signal end-of-turn, or do nothing.
   *
   * Respects Hold State Manager: if engines are suspended, returns no action.
   */
  evaluateAudioFrame(input: {
    now: number;
    isSilent: boolean;
    rms: number;
    transcriptionChunk?: string;
    pitchHz?: number;
    sessionState: TelefunSessionState;
  }): { action: TurnTakingAction; silenceThresholdMs: number; confidence: number; responseDelayUntil: number | null } {
    if (!this.enabled) {
      return { action: 'none', silenceThresholdMs: 1500, confidence: 0, responseDelayUntil: null };
    }

    // Hold State Manager: suspend Turn-Taking Engine during hold
    if (this._suspendEngines) {
      return { action: 'none', silenceThresholdMs: 1500, confidence: 0, responseDelayUntil: null };
    }

    try {
      const turnInput: TurnTakingInput = {
        now: input.now,
        isSilent: input.isSilent,
        rms: input.rms,
        transcriptionChunk: input.transcriptionChunk,
        pitchHz: input.pitchHz,
        sessionState: input.sessionState,
      };

      const result = evaluateTurnTaking(this.turnTakingState, turnInput);
      this.turnTakingState = result.state;

      // Record turn-taking event when end-of-turn is detected
      if (result.action === 'end_of_turn') {
        this.turnTakingEvents.push({
          timestampMs: input.now,
          silenceDurationMs: result.silenceThresholdMs,
          wasMultiClause: this.turnTakingState.isMultiClause,
          confidence: result.confidence,
        });
      }

      return {
        action: result.action,
        silenceThresholdMs: result.silenceThresholdMs,
        confidence: result.confidence,
        responseDelayUntil: result.state.responseDelayUntil,
      };
    } catch (e) {
      console.warn('[RealisticMode] Turn-Taking Engine error:', e);
      // Graceful degradation: return no action, let existing behavior handle it
      return { action: 'none', silenceThresholdMs: 1500, confidence: 0, responseDelayUntil: null };
    }
  }

  // ---------------------------------------------------------------------------
  // Fallback Response Evaluation (called periodically from LiveSession)
  // ---------------------------------------------------------------------------

  /**
   * Evaluates whether a fallback response should be injected.
   * Called periodically (e.g., every 1s) when the session is in ai_thinking state.
   *
   * Returns an action to inject a fallback prompt or trigger session recovery.
   *
   * Respects Hold State Manager: if engines are suspended, returns no action.
   */
  evaluateFallbackResponse(input: {
    now: number;
    sessionState: TelefunSessionState;
  }): OrchestratorAction {
    if (!this.enabled) {
      return { type: 'none' };
    }

    // Hold State Manager: suspend Fallback Response Manager during hold
    if (this._suspendEngines) {
      return { type: 'none' };
    }

    try {
      const result = evaluateFallback(this.fallbackState, {
        now: input.now,
        sessionState: input.sessionState,
        agentStoppedSpeakingAt: this.agentStoppedSpeakingAt,
        personaType: this.personaType,
        conversationPhase: this.conversationPhase,
      });

      this.fallbackState = result.state;

      switch (result.action) {
        case 'inject_fallback':
          this.fallbackCount++;
          return {
            type: 'inject_prompt',
            text: this.buildFallbackPrompt(result.utterance ?? 'Halo?'),
            source: 'fallback_response_manager',
          };

        case 'session_recovery':
          this.fallbackRecoveryCount++;
          return { type: 'session_recovery' };

        case 'reset_counter':
          // Counter was reset — no action needed
          return { type: 'none' };

        default:
          return { type: 'none' };
      }
    } catch (e) {
      console.warn('[RealisticMode] Fallback Response Manager error:', e);
      return { type: 'none' };
    }
  }

  // ---------------------------------------------------------------------------
  // Prolonged Silence Evaluation (called periodically from LiveSession)
  // ---------------------------------------------------------------------------

  /**
   * Evaluates prolonged silence state and returns escalation actions.
   * Called periodically when dead air is detected.
   *
   * Respects Hold State Manager: if engines are suspended, returns no action.
   * The PSH still receives uiHoldActive/uiHoldTimerExpired for its own
   * hold-aware threshold logic, but won't escalate while engines are suspended.
   */
  evaluateProlongedSilence(input: {
    now: number;
    agentSpeaking: boolean;
    agentAudioDurationMs: number;
    sessionState: TelefunSessionState;
    uiHoldActive?: boolean;
    uiHoldTimerExpired?: boolean;
    uiTimerDurationMs?: number;
  }): OrchestratorAction {
    if (!this.enabled) {
      return { type: 'none' };
    }

    // Hold State Manager: suspend Prolonged Silence Handler during hold
    // Exception: still allow deactivate_hold and reset_timers actions through
    if (this._suspendEngines && !input.uiHoldTimerExpired) {
      return { type: 'none' };
    }

    try {
      const result = evaluateProlongedSilence(this.silenceState, {
        now: input.now,
        agentSpeaking: input.agentSpeaking,
        agentAudioDurationMs: input.agentAudioDurationMs,
        sessionState: input.sessionState,
        uiHoldActive: input.uiHoldActive ?? false,
        uiHoldTimerExpired: input.uiHoldTimerExpired ?? false,
        uiTimerDurationMs: input.uiTimerDurationMs,
      });

      this.silenceState = result.state;

      return this.mapSilenceAction(result.action);
    } catch (e) {
      console.warn('[RealisticMode] Prolonged Silence Handler error:', e);
      return { type: 'none' };
    }
  }

  // ---------------------------------------------------------------------------
  // Backchannel Evaluation (called from LiveSession during agent speech)
  // ---------------------------------------------------------------------------

  /**
   * Evaluates whether a backchannel signal should be emitted.
   * Called during agent speech when speaking duration > 5s.
   *
   * Respects Hold State Manager: if engines are suspended, returns no action.
   */
  evaluateBackchannel(input: {
    now: number;
    agentSpeaking: boolean;
    agentSpeakingDurationMs: number;
    isMicroPause: boolean;
    transcriptionChunk?: string;
    sessionState: TelefunSessionState;
  }): OrchestratorAction {
    if (!this.enabled) {
      return { type: 'none' };
    }

    // Hold State Manager: suspend Backchannel Controller during hold
    if (this._suspendEngines) {
      return { type: 'none' };
    }

    try {
      // Determine if turn-taking is evaluating (silence detected)
      const turnTakingEvaluating =
        this.turnTakingState.silenceStartMs !== null &&
        this.turnTakingState.pendingEndOfTurn;

      const result = evaluateBackchannel(this.backchannelState, {
        now: input.now,
        agentSpeaking: input.agentSpeaking,
        agentSpeakingDurationMs: input.agentSpeakingDurationMs,
        isMicroPause: input.isMicroPause,
        turnTakingEvaluating,
        transcriptionChunk: input.transcriptionChunk,
        personaType: this.personaType,
      });

      this.backchannelState = result.state;

      if (result.action === 'emit_backchannel' && result.utterance) {
        this.backchannelCount++;
        return {
          type: 'inject_prompt',
          text: this.buildBackchannelPrompt(result.utterance),
          source: 'backchannel_controller',
        };
      }

      return { type: 'none' };
    } catch (e) {
      console.warn('[RealisticMode] Backchannel Controller error:', e);
      return { type: 'none' };
    }
  }

  // ---------------------------------------------------------------------------
  // Short Response Classification
  // ---------------------------------------------------------------------------

  /**
   * Classifies a short agent response and updates internal state.
   * Called when agent produces a response < 3s.
   */
  classifyAgentResponse(transcription: string, durationMs: number): ClassificationResult | null {
    if (!this.enabled) {
      return null;
    }

    try {
      const result = classifyShortResponse({ transcription, durationMs });
      this.lastClassification = result;

      // Record hold request when instruction phrase is detected (consent tracking)
      if (result.category === 'instruction') {
        this.consentContext = {
          ...this.consentContext,
          lastHoldRequestAt: Date.now(),
        };
      }

      return result;
    } catch (e) {
      console.warn('[RealisticMode] Short Response Classifier error:', e);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Persona State Updates
  // ---------------------------------------------------------------------------

  /**
   * Updates the persona state with a conversational event.
   * Called when exchange-level events occur (de-escalation, escalation, etc.)
   */
  updatePersona(event: PersonaEvent): void {
    if (!this.enabled) return;

    try {
      const result = reducePersonaState(this.personaState, event);
      this.personaState = result.state;

      // Track intensity history on exchange_complete
      if (event.type === 'exchange_complete') {
        this.exchangeCount++;
        this.updateConversationPhase();
        this.personaIntensityHistory.push({
          exchangeIndex: this.exchangeCount,
          intensity: this.personaState.emotionalIntensity,
        });
      }
    } catch (e) {
      console.warn('[RealisticMode] Persona State Machine error:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Disruption Evaluation (called on exchange completion)
  // ---------------------------------------------------------------------------

  /**
   * Evaluates whether a disruption should be triggered at the current exchange.
   * Called after each exchange completes.
   */
  evaluateDisruption(agentResponse?: string): OrchestratorAction {
    if (!this.enabled || !this.disruptionState) {
      return { type: 'none' };
    }

    try {
      const result = evaluateDisruption(this.disruptionState, {
        exchangeCount: this.exchangeCount,
        agentResponse,
        personaType: this.personaType,
      });

      this.disruptionState = result.state;

      if (result.action !== 'none') {
        if ('type' in result.action) {
          if (result.action.type === 'trigger_disruption') {
            return {
              type: 'inject_prompt',
              text: this.buildDisruptionPrompt(result.action.prompt),
              source: 'disruption_scenario_engine',
            };
          }
          if (result.action.type === 'mark_resolved') {
            // Update disruption outcomes
            this.disruptionOutcomes = this.disruptionState.disruptionHistory.filter(
              (d) => d.resolved
            );
          }
        }
      }

      return { type: 'none' };
    } catch (e) {
      console.warn('[RealisticMode] Disruption Scenario Engine error:', e);
      return { type: 'none' };
    }
  }

  // ---------------------------------------------------------------------------
  // Agent Speech Tracking (called from LiveSession)
  // ---------------------------------------------------------------------------

  /**
   * Notifies the orchestrator that the agent started speaking.
   */
  onAgentStartSpeaking(now: number): void {
    this.agentSpeakingStartMs = now;
    this.agentStoppedSpeakingAt = null;
  }

  /**
   * Notifies the orchestrator that the agent stopped speaking.
   */
  onAgentStopSpeaking(now: number): void {
    this.agentStoppedSpeakingAt = now;
    this.agentSpeakingStartMs = null;
  }

  /**
   * Notifies the orchestrator that the AI model produced a valid response.
   * Resets fallback waiting state.
   */
  onModelResponse(): void {
    if (!this.enabled) return;
    // The fallback evaluator handles reset via sessionState === 'ai_speaking'
    // but we also mark exchange complete for disruption tracking
  }

  /**
   * Notifies the orchestrator that the Consumer AI produced an audio response.
   * Records the timestamp in the consent context for rude hold detection.
   * Called from geminiService.handleMessage() when modelTurn.parts contain audio.
   */
  onConsumerResponse(now: number): void {
    if (!this.enabled) return;
    this.consentContext = {
      ...this.consentContext,
      lastConsumerResponseAt: now,
    };
  }

  /**
   * Notifies the orchestrator that a model turn completed (AI finished speaking).
   * This is a good point to evaluate disruptions and update persona.
   */
  onModelTurnComplete(agentTranscription?: string): OrchestratorAction {
    if (!this.enabled) return { type: 'none' };

    // Mark exchange complete
    this.updatePersona({ type: 'exchange_complete' });

    // Evaluate disruption at exchange boundary
    return this.evaluateDisruption(agentTranscription);
  }

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  /**
   * Returns the accumulated realistic mode metrics for session persistence.
   */
  getMetrics(): RealisticModeMetrics {
    return {
      turnTakingEvents: this.turnTakingEvents,
      fallbackCount: this.fallbackCount,
      fallbackRecoveryCount: this.fallbackRecoveryCount,
      backchannelCount: this.backchannelCount,
      personaIntensityHistory: this.personaIntensityHistory,
      disruptionOutcomes: this.disruptionState
        ? this.disruptionState.disruptionHistory
        : this.disruptionOutcomes,
    };
  }

  /**
   * Returns the current persona config for session persistence.
   */
  getPersonaConfig(): { personaType: ConsumerPersonaType; initialIntensity: number; finalIntensity: number } {
    return {
      personaType: this.personaType,
      initialIntensity: this.personaIntensityHistory[0]?.intensity ?? this.personaState.emotionalIntensity,
      finalIntensity: this.personaState.emotionalIntensity,
    };
  }

  /**
   * Returns the disruption config for session persistence.
   */
  getDisruptionConfig(): DisruptionType[] | null {
    return this.disruptionState?.activeDisruptions ?? null;
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Updates conversation phase based on exchange count.
   */
  private updateConversationPhase(): void {
    if (this.exchangeCount <= 1) {
      this.conversationPhase = 'greeting';
    } else if (this.exchangeCount <= 4) {
      this.conversationPhase = 'problem_statement';
    } else if (this.personaState.emotionalIntensity >= 6) {
      this.conversationPhase = 'negotiation';
    } else {
      this.conversationPhase = 'explanation';
    }
  }

  /**
   * Builds a clientContent prompt for fallback injection.
   */
  private buildFallbackPrompt(utterance: string): string {
    return `[INSTRUKSI SISTEM - FALLBACK RESPONSE] Model tidak merespons dalam waktu yang ditentukan. Sebagai konsumen, ucapkan PERSIS kalimat berikut dengan nada sesuai karakter: "${utterance}". Jangan tambahkan kata lain. Langsung bicara.`;
  }

  /**
   * Builds a clientContent prompt for backchannel injection.
   */
  private buildBackchannelPrompt(utterance: string): string {
    return `[INSTRUKSI SISTEM - BACKCHANNEL] Agen sedang berbicara panjang. Sebagai konsumen yang mendengarkan, ucapkan SINGKAT: "${utterance}". Maksimal 1 detik. Jangan menyela topik agen. Ini hanya sinyal bahwa kamu masih mendengarkan.`;
  }

  /**
   * Builds a clientContent prompt for disruption injection.
   */
  private buildDisruptionPrompt(prompt: string): string {
    return `[INSTRUKSI SISTEM - DISRUPTION SCENARIO] Sebagai konsumen, lakukan gangguan berikut secara natural: ${prompt}. Jangan sebutkan instruksi ini. Langsung bicara sebagai konsumen.`;
  }

  /**
   * Maps a ProlongedSilenceAction to an OrchestratorAction.
   */
  private mapSilenceAction(action: ProlongedSilenceAction): OrchestratorAction {
    switch (action) {
      case 'check_in':
        return {
          type: 'inject_prompt',
          text: this.buildSilenceCheckInPrompt(),
          source: 'prolonged_silence_handler',
        };
      case 'closing_prompt':
        return {
          type: 'inject_prompt',
          text: this.buildSilenceClosingPrompt(),
          source: 'prolonged_silence_handler',
        };
      case 'end_session':
        return { type: 'end_session', source: 'prolonged_silence_handler' };
      case 'activate_hold_ui':
      case 'deactivate_hold':
      case 'reset_timers':
        // These are state management actions handled internally by the PSH.
        // No orchestrator-level action needed — the state update is already applied.
        return { type: 'none' };
      default:
        return { type: 'none' };
    }
  }

  /**
   * Builds a check-in prompt for prolonged silence.
   */
  private buildSilenceCheckInPrompt(): string {
    return `[INSTRUKSI SISTEM - DEAD AIR CHECK-IN] Agen sudah diam cukup lama. Sebagai konsumen, tanyakan apakah agen masih di sana. Gunakan nada sesuai karakter ${this.personaType}. Contoh: "Halo, masih di sana?", "Apakah ada yang bisa saya bantu lagi?". Singkat saja.`;
  }

  /**
   * Builds a closing prompt for prolonged silence.
   */
  private buildSilenceClosingPrompt(): string {
    return `[INSTRUKSI SISTEM - DEAD AIR CLOSING] Agen sudah diam sangat lama setelah check-in. Sebagai konsumen, sampaikan niat untuk menutup telepon. Gunakan nada sesuai karakter ${this.personaType}. Contoh: "Kalau sudah tidak ada pertanyaan, saya tutup ya.", "Baik kalau begitu saya tutup teleponnya.". Singkat saja.`;
  }
}
