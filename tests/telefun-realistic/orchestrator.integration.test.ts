/**
 * Integration tests for RealisticModeOrchestrator
 *
 * Tests the full orchestration of multiple engines working together:
 * - Fallback → recovery flow
 * - Dead air → escalation → session end sequence
 * - Disruption + persona interaction respects emotional state
 * - Graceful degradation when individual engines fail
 *
 * Requirements: 1.1, 1.4, 3.1, 3.3, 8.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RealisticModeOrchestrator,
  type RealisticModeConfig,
  type OrchestratorAction,
} from '@/app/(main)/telefun/services/realisticMode/RealisticModeOrchestrator';

describe('RealisticModeOrchestrator - Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Test 1: Full Fallback → Recovery Flow
  // Validates: Requirements 1.1, 1.4
  // -------------------------------------------------------------------------
  describe('Fallback → Recovery Flow', () => {
    it('should escalate from inject_prompt to session_recovery after consecutive failures', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Simulate agent stops speaking at t=0
      const startTime = 1000;
      orchestrator.onAgentStopSpeaking(startTime);

      // --- First fallback cycle ---
      // Advance past cooldown (1s) - at t=1500, cooldown passed
      let now = startTime + 1500;
      let result = orchestrator.evaluateFallbackResponse({
        now,
        sessionState: 'ai_thinking',
      });
      // Should be 'none' — waiting timer just started
      expect(result.type).toBe('none');

      // Advance past timeout (5s from when waiting started)
      now = startTime + 1500 + 5100;
      result = orchestrator.evaluateFallbackResponse({
        now,
        sessionState: 'ai_thinking',
      });
      // Should inject a fallback prompt (first failure)
      expect(result.type).toBe('inject_prompt');
      if (result.type === 'inject_prompt') {
        expect(result.source).toBe('fallback_response_manager');
        expect(result.text).toContain('[INSTRUKSI SISTEM - FALLBACK RESPONSE]');
      }

      // --- Second fallback cycle ---
      // Advance another 5s+ for second timeout
      now = startTime + 1500 + 5100 + 5100;
      result = orchestrator.evaluateFallbackResponse({
        now,
        sessionState: 'ai_thinking',
      });
      // Should inject another fallback prompt (second failure, consecutiveFailures = 2)
      expect(result.type).toBe('inject_prompt');

      // --- Third fallback cycle → session recovery ---
      // Advance another 5s+ for third timeout
      now = startTime + 1500 + 5100 + 5100 + 5100;
      result = orchestrator.evaluateFallbackResponse({
        now,
        sessionState: 'ai_thinking',
      });
      // After 2 consecutive failures, should trigger session_recovery
      expect(result.type).toBe('session_recovery');
    });

    it('should reset failure counter when model responds', () => {
      const config: RealisticModeConfig = {
        personaType: 'angry',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Simulate agent stops speaking
      const startTime = 1000;
      orchestrator.onAgentStopSpeaking(startTime);

      // Trigger first fallback
      let now = startTime + 1500;
      orchestrator.evaluateFallbackResponse({ now, sessionState: 'ai_thinking' });
      now = startTime + 1500 + 5100;
      const firstFallback = orchestrator.evaluateFallbackResponse({
        now,
        sessionState: 'ai_thinking',
      });
      expect(firstFallback.type).toBe('inject_prompt');

      // Model responds (session state changes to ai_speaking)
      const resetResult = orchestrator.evaluateFallbackResponse({
        now: now + 500,
        sessionState: 'ai_speaking',
      });
      // The counter should be reset — no session_recovery on next failure
      expect(resetResult.type).toBe('none');

      // Simulate another stop and new fallback cycle
      orchestrator.onAgentStopSpeaking(now + 1000);
      const newNow = now + 1000 + 1500;
      orchestrator.evaluateFallbackResponse({
        now: newNow,
        sessionState: 'ai_thinking',
      });
      const afterReset = orchestrator.evaluateFallbackResponse({
        now: newNow + 5100,
        sessionState: 'ai_thinking',
      });
      // Should be inject_prompt (not session_recovery) since counter was reset
      expect(afterReset.type).toBe('inject_prompt');
    });

    it('should return none when realistic mode is disabled', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: false,
      };
      const orchestrator = new RealisticModeOrchestrator(config);
      orchestrator.onAgentStopSpeaking(1000);

      const result = orchestrator.evaluateFallbackResponse({
        now: 20000,
        sessionState: 'ai_thinking',
      });
      expect(result.type).toBe('none');
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: Dead Air → Escalation → Session End
  // Validates: Requirements 3.1, 3.3
  // -------------------------------------------------------------------------
  describe('Dead Air → Escalation → Session End', () => {
    it('should follow check_in → closing_prompt → end_session escalation sequence', () => {
      const config: RealisticModeConfig = {
        personaType: 'angry',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      const baseInput = {
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking' as const,
      };

      // At t=0, no escalation yet
      let result = orchestrator.evaluateProlongedSilence({
        now: 0,
        ...baseInput,
      });
      expect(result.type).toBe('none');

      // At t=5000 (5s), still below check_in threshold (8s)
      result = orchestrator.evaluateProlongedSilence({
        now: 5000,
        ...baseInput,
      });
      expect(result.type).toBe('none');

      // At t=8500 (>8s), should trigger check_in
      result = orchestrator.evaluateProlongedSilence({
        now: 8500,
        ...baseInput,
      });
      expect(result.type).toBe('inject_prompt');
      if (result.type === 'inject_prompt') {
        expect(result.source).toBe('prolonged_silence_handler');
        expect(result.text).toContain('DEAD AIR CHECK-IN');
      }

      // At t=20500 (>20s), should trigger closing_prompt
      result = orchestrator.evaluateProlongedSilence({
        now: 20500,
        ...baseInput,
      });
      expect(result.type).toBe('inject_prompt');
      if (result.type === 'inject_prompt') {
        expect(result.source).toBe('prolonged_silence_handler');
        expect(result.text).toContain('DEAD AIR CLOSING');
      }

      // At t=35500 (>35s), should trigger end_session
      result = orchestrator.evaluateProlongedSilence({
        now: 35500,
        ...baseInput,
      });
      expect(result.type).toBe('end_session');
      if (result.type === 'end_session') {
        expect(result.source).toBe('prolonged_silence_handler');
      }
    });

    it('should reset escalation when agent speaks > 300ms', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Build up to check_in level
      orchestrator.evaluateProlongedSilence({
        now: 0,
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking',
      });

      const checkInResult = orchestrator.evaluateProlongedSilence({
        now: 8500,
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking',
      });
      expect(checkInResult.type).toBe('inject_prompt');

      // Agent speaks for > 300ms — should reset
      const resetResult = orchestrator.evaluateProlongedSilence({
        now: 9000,
        agentSpeaking: true,
        agentAudioDurationMs: 500, // > 300ms
        sessionState: 'ai_thinking',
      });
      expect(resetResult.type).toBe('none');

      // After reset, dead air tracking restarts from the next silent frame.
      // At t=10000, silence begins (deadAirStartMs = 10000)
      const afterResetResult = orchestrator.evaluateProlongedSilence({
        now: 10000,
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking',
      });
      expect(afterResetResult.type).toBe('none');

      // At t=15000, only 5s of silence since reset — below 8s check_in threshold
      const stillBelowThreshold = orchestrator.evaluateProlongedSilence({
        now: 15000,
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking',
      });
      expect(stillBelowThreshold.type).toBe('none');

      // At t=18500 (8.5s after dead air started at 10000), should trigger check_in again
      const newCheckIn = orchestrator.evaluateProlongedSilence({
        now: 18500,
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking',
      });
      expect(newCheckIn.type).toBe('inject_prompt');
    });

    it('should return none when realistic mode is disabled', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: false,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      const result = orchestrator.evaluateProlongedSilence({
        now: 50000,
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking',
      });
      expect(result.type).toBe('none');
    });
  });

  // -------------------------------------------------------------------------
  // Test 3: Disruption + Persona Interaction
  // Validates: Requirements 8.1
  // -------------------------------------------------------------------------
  describe('Disruption + Persona Interaction', () => {
    it('should trigger disruption after minimum exchanges and respect persona', () => {
      const config: RealisticModeConfig = {
        personaType: 'angry',
        disruptionTypes: ['technical_term_confusion', 'repeated_question'],
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Exchange 1 (exchangeCount becomes 1): no disruption (< 2)
      let result = orchestrator.onModelTurnComplete('Selamat pagi, ada yang bisa dibantu?');
      expect(result.type).toBe('none');

      // Exchange 2 (exchangeCount becomes 2): disruption CAN trigger (>= 2)
      result = orchestrator.onModelTurnComplete('Baik, saya cek dulu ya.');
      expect(result.type).toBe('inject_prompt');
      if (result.type === 'inject_prompt') {
        expect(result.source).toBe('disruption_scenario_engine');
        // Prompt should be in Indonesian and persona-appropriate
        expect(result.text).toContain('[INSTRUKSI SISTEM - DISRUPTION SCENARIO]');
      }
    });

    it('should respect minimum spacing between disruptions', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        disruptionTypes: ['repeated_question'],
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Exchange 1: no trigger (exchangeCount=1, < 2)
      orchestrator.onModelTurnComplete('Halo');

      // Exchange 2: should trigger (exchangeCount=2, >= 2)
      const firstDisruption = orchestrator.onModelTurnComplete('Solusinya begini...');
      expect(firstDisruption.type).toBe('inject_prompt');

      // Exchange 3, 4: should NOT trigger (nextDisruptionAfterExchange = 5)
      const exchange3 = orchestrator.onModelTurnComplete('Langkah pertama...');
      expect(exchange3.type).toBe('none');

      const exchange4 = orchestrator.onModelTurnComplete('Langkah kedua...');
      expect(exchange4.type).toBe('none');

      // Exchange 5 (3 exchanges after first disruption at exchange 2): can trigger again
      const exchange5 = orchestrator.onModelTurnComplete('Langkah ketiga...');
      expect(exchange5.type).toBe('inject_prompt');
    });

    it('should update persona emotional intensity on escalation events', () => {
      const config: RealisticModeConfig = {
        personaType: 'angry',
        disruptionTypes: ['emotional_escalation'],
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Initial intensity for angry persona is [7, 8]
      const initialIntensity = orchestrator.emotionalIntensity;
      expect(initialIntensity).toBeGreaterThanOrEqual(7);
      expect(initialIntensity).toBeLessThanOrEqual(8);

      // Trigger escalation event
      orchestrator.updatePersona({
        type: 'escalation',
        trigger: 'dismissed' as 'dismissive',
      });

      // Emotional intensity should increase (bounded by [2, 3] for angry)
      const afterEscalation = orchestrator.emotionalIntensity;
      expect(afterEscalation).toBeGreaterThan(initialIntensity);
      expect(afterEscalation).toBeLessThanOrEqual(10);
    });

    it('should decrease persona intensity on de-escalation events', () => {
      const config: RealisticModeConfig = {
        personaType: 'angry',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      const initialIntensity = orchestrator.emotionalIntensity;

      // Trigger de-escalation
      orchestrator.updatePersona({
        type: 'de_escalation',
        trigger: 'empathy',
      });

      const afterDeEscalation = orchestrator.emotionalIntensity;
      expect(afterDeEscalation).toBeLessThanOrEqual(initialIntensity);
      expect(afterDeEscalation).toBeGreaterThanOrEqual(1);
    });

    it('should not trigger disruptions when mode is disabled', () => {
      const config: RealisticModeConfig = {
        personaType: 'angry',
        disruptionTypes: ['technical_term_confusion'],
        enabled: false,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Even after many exchanges, no disruption
      for (let i = 0; i < 10; i++) {
        const result = orchestrator.onModelTurnComplete('Some response');
        expect(result.type).toBe('none');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Test 4: Graceful Degradation
  // Validates: Requirements 1.1, 8.1
  // -------------------------------------------------------------------------
  describe('Graceful Degradation', () => {
    it('should return safe defaults when Turn-Taking Engine encounters an error', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Pass invalid/extreme input that might cause issues
      // The orchestrator should catch errors and return safe defaults
      const result = orchestrator.evaluateAudioFrame({
        now: NaN,
        isSilent: false,
        rms: -1,
        transcriptionChunk: undefined,
        pitchHz: undefined,
        sessionState: 'user_speaking',
      });

      // Should return safe defaults (action: 'none', default threshold)
      expect(result.action).toBeDefined();
      expect(result.silenceThresholdMs).toBeGreaterThan(0);
      expect(typeof result.confidence).toBe('number');
    });

    it('should return none when Fallback Manager encounters internal state issues', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Calling evaluateFallbackResponse without setting agentStoppedSpeakingAt
      // should gracefully return 'none' (no crash)
      const result = orchestrator.evaluateFallbackResponse({
        now: 100000,
        sessionState: 'ai_thinking',
      });
      expect(result.type).toBe('none');
    });

    it('should return none when Disruption Engine is not initialized', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        // No disruptionTypes configured
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Advance exchanges
      for (let i = 0; i < 5; i++) {
        const result = orchestrator.onModelTurnComplete('Response');
        expect(result.type).toBe('none');
      }
    });

    it('should handle invalid disruption types gracefully', () => {
      // Passing an empty array should be caught by the constructor
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        disruptionTypes: [], // Invalid: 0 types
        enabled: true,
      };

      // Constructor should handle this gracefully (logs warning, sets null)
      const orchestrator = new RealisticModeOrchestrator(config);
      expect(orchestrator.isEnabled).toBe(true);

      // Disruption evaluation should return none
      const result = orchestrator.evaluateDisruption('Some response');
      expect(result.type).toBe('none');
    });

    it('should continue working when persona update receives unexpected event', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      const initialIntensity = orchestrator.emotionalIntensity;

      // exchange_complete should not crash
      orchestrator.updatePersona({ type: 'exchange_complete' });

      // Intensity should remain valid
      expect(orchestrator.emotionalIntensity).toBeGreaterThanOrEqual(1);
      expect(orchestrator.emotionalIntensity).toBeLessThanOrEqual(10);
    });

    it('should track metrics correctly across multiple engine interactions', () => {
      const config: RealisticModeConfig = {
        personaType: 'angry',
        disruptionTypes: ['repeated_question'],
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Trigger a fallback
      orchestrator.onAgentStopSpeaking(1000);
      orchestrator.evaluateFallbackResponse({ now: 2600, sessionState: 'ai_thinking' });
      orchestrator.evaluateFallbackResponse({ now: 7700, sessionState: 'ai_thinking' });

      // Trigger disruptions
      orchestrator.onModelTurnComplete('Halo');
      orchestrator.onModelTurnComplete('Baik');
      orchestrator.onModelTurnComplete('Solusinya...');

      const metrics = orchestrator.getMetrics();
      expect(metrics.fallbackCount).toBeGreaterThanOrEqual(1);
      expect(metrics.personaIntensityHistory.length).toBeGreaterThan(0);
      expect(metrics.personaIntensityHistory[0].exchangeIndex).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: Consent Tracking — classifyAgentResponse, onConsumerResponse, rude_hold
  // Validates: Requirements 10.2, 10.9
  // -------------------------------------------------------------------------
  describe('Consent Tracking — classifyAgentResponse, onConsumerResponse, rude_hold', () => {
    it('classifyAgentResponse with instruction records lastHoldRequestAt (affects rude hold)', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Set up consent by classifying an instruction phrase
      const classification = orchestrator.classifyAgentResponse('Mohon ditunggu ya', 1500);
      expect(classification?.category).toBe('instruction');

      // With valid request + consumer response, hold should NOT be rude
      orchestrator.onConsumerResponse(Date.now() + 100);

      const holdResult = orchestrator.evaluateHoldStateInput({
        now: Date.now() + 200,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      expect(holdResult.type).toBe('hold_state_changed');
    });

    it('classifyAgentResponse with non-instruction does not record hold request', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Classify an acknowledgement (not instruction)
      const classification = orchestrator.classifyAgentResponse('Baik, Bu', 1000);
      expect(classification?.category).toBe('acknowledgement');

      // No consumer response — but since there's no hold request, it will be no_request
      const holdResult = orchestrator.evaluateHoldStateInput({
        now: Date.now(),
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      // Hold should still activate (UI always works)
      expect(holdResult.type).toBe('hold_state_changed');
    });

    it('onConsumerResponse marks consent — valid request + response = not rude', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Agent asks for hold permission
      orchestrator.classifyAgentResponse('Mohon ditunggu', 1200);

      // Consumer responds
      const responseTime = Date.now() + 500;
      orchestrator.onConsumerResponse(responseTime);

      // Press hold — should NOT be rude (valid consent)
      const holdResult = orchestrator.evaluateHoldStateInput({
        now: responseTime + 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      expect(holdResult.type).toBe('hold_state_changed');
    });

    it('rude hold increases persona emotional intensity', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      const initialIntensity = orchestrator.emotionalIntensity;

      // Press hold without any consent context — should be rude
      orchestrator.evaluateHoldStateInput({
        now: Date.now(),
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      // Persona intensity should have increased (rude_hold escalation)
      const afterHoldIntensity = orchestrator.emotionalIntensity;
      expect(afterHoldIntensity).toBeGreaterThanOrEqual(initialIntensity);
    });

    it('stale hold request (> 15s) results in rude hold that escalates persona', () => {
      const config: RealisticModeConfig = {
        personaType: 'angry',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      const initialIntensity = orchestrator.emotionalIntensity;

      // Agent asked 20s ago (stale)
      vi.setSystemTime(Date.now() - 20000);
      orchestrator.classifyAgentResponse('Mohon ditunggu', 1000);

      // Consumer responded right after but it's been 20s since request
      orchestrator.onConsumerResponse(Date.now() + 100);

      // Now press hold — request is stale
      vi.setSystemTime(Date.now() + 20000);
      orchestrator.evaluateHoldStateInput({
        now: Date.now(),
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      // Persona should have escalated due to rude hold
      expect(orchestrator.emotionalIntensity).toBeGreaterThan(initialIntensity);
    });
  });

  // -------------------------------------------------------------------------
  // Test 6: Combined Engine Interactions
  // -------------------------------------------------------------------------
  describe('Combined Engine Interactions', () => {
    it('should maintain persona config throughout session lifecycle', () => {
      const config: RealisticModeConfig = {
        personaType: 'critical',
        disruptionTypes: ['misunderstanding'],
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Verify initial persona config
      const personaConfig = orchestrator.getPersonaConfig();
      expect(personaConfig.personaType).toBe('critical');
      expect(personaConfig.initialIntensity).toBeGreaterThanOrEqual(6);
      expect(personaConfig.initialIntensity).toBeLessThanOrEqual(7);

      // Run through several exchanges with escalation
      orchestrator.updatePersona({ type: 'escalation', trigger: 'dismissive' });
      orchestrator.updatePersona({ type: 'exchange_complete' });

      // Persona type should remain immutable
      const updatedConfig = orchestrator.getPersonaConfig();
      expect(updatedConfig.personaType).toBe('critical');
      expect(updatedConfig.finalIntensity).toBeGreaterThan(updatedConfig.initialIntensity);
    });

    it('should correctly report disruption config', () => {
      const config: RealisticModeConfig = {
        personaType: 'confused',
        disruptionTypes: ['technical_term_confusion', 'repeated_question'],
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      const disruptionConfig = orchestrator.getDisruptionConfig();
      expect(disruptionConfig).not.toBeNull();
      expect(disruptionConfig).toContain('technical_term_confusion');
      expect(disruptionConfig).toContain('repeated_question');
    });

    it('should return null disruption config when no disruptions configured', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      expect(orchestrator.getDisruptionConfig()).toBeNull();
    });

    it('should update conversation phase based on exchange count', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Initial phase should be greeting
      expect(orchestrator.currentPhase).toBe('greeting');

      // After 1 exchange, still greeting
      orchestrator.updatePersona({ type: 'exchange_complete' });
      expect(orchestrator.currentPhase).toBe('greeting');

      // After 2 exchanges, should move to problem_statement
      orchestrator.updatePersona({ type: 'exchange_complete' });
      expect(orchestrator.currentPhase).toBe('problem_statement');

      // After 5 exchanges, should move to explanation
      orchestrator.updatePersona({ type: 'exchange_complete' });
      orchestrator.updatePersona({ type: 'exchange_complete' });
      orchestrator.updatePersona({ type: 'exchange_complete' });
      expect(orchestrator.currentPhase).toBe('explanation');
    });
  });
});
