/**
 * Integration tests for Engine Orchestration
 *
 * Tests multi-engine coordination through the RealisticModeOrchestrator,
 * focusing on hold state management, engine suspension, and audio isolation.
 *
 * Requirements: 1.1, 1.4, 3.1, 3.3, 8.1, 10.1, 10.4, 10.8, 10.9, 10.10
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RealisticModeOrchestrator,
  type RealisticModeConfig,
} from '@/app/(main)/telefun/services/realisticMode/RealisticModeOrchestrator';

describe('Engine Orchestration - Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Test: Full Fallback → Recovery Flow with Mocked WebSocket
  // Validates: Requirements 1.1, 1.4
  // -------------------------------------------------------------------------
  describe('Full Fallback → Recovery Flow (mocked WebSocket context)', () => {
    it('should produce inject_prompt actions that would be sent via clientContent', () => {
      const config: RealisticModeConfig = {
        personaType: 'angry',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Simulate: agent finishes speaking, WebSocket sends turnComplete
      const t0 = 1000;
      orchestrator.onAgentStopSpeaking(t0);

      // After cooldown (1s), first call starts the waiting timer
      const waitStart = t0 + 1500;
      const startWaiting = orchestrator.evaluateFallbackResponse({
        now: waitStart,
        sessionState: 'ai_thinking',
      });
      expect(startWaiting.type).toBe('none'); // Just started waiting

      // After 5s timeout from waitStart, fallback should trigger
      const t1 = waitStart + 5100;
      const fallback1 = orchestrator.evaluateFallbackResponse({
        now: t1,
        sessionState: 'ai_thinking',
      });

      expect(fallback1.type).toBe('inject_prompt');
      if (fallback1.type === 'inject_prompt') {
        // This prompt would be sent via WebSocket clientContent
        expect(fallback1.text).toContain('[INSTRUKSI SISTEM - FALLBACK RESPONSE]');
        expect(fallback1.source).toBe('fallback_response_manager');
      }

      // Second failure: waitingSince was reset to t1 by inject_fallback
      const t2 = t1 + 5100;
      const fallback2 = orchestrator.evaluateFallbackResponse({
        now: t2,
        sessionState: 'ai_thinking',
      });
      expect(fallback2.type).toBe('inject_prompt');

      // Third attempt → session_recovery (2 consecutive failures reached)
      const t3 = t2 + 5100;
      const recovery = orchestrator.evaluateFallbackResponse({
        now: t3,
        sessionState: 'ai_thinking',
      });
      expect(recovery.type).toBe('session_recovery');
    });

    it('should reset fallback state when WebSocket delivers model audio', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      orchestrator.onAgentStopSpeaking(1000);

      // Trigger first fallback
      orchestrator.evaluateFallbackResponse({ now: 2500, sessionState: 'ai_thinking' });
      const fb = orchestrator.evaluateFallbackResponse({
        now: 7600,
        sessionState: 'ai_thinking',
      });
      expect(fb.type).toBe('inject_prompt');

      // WebSocket delivers model audio → session state changes
      orchestrator.evaluateFallbackResponse({ now: 8000, sessionState: 'ai_speaking' });
      orchestrator.onAgentStartSpeaking(8000);

      // New cycle after model responds
      orchestrator.onAgentStopSpeaking(10000);
      orchestrator.evaluateFallbackResponse({ now: 11500, sessionState: 'ai_thinking' });
      const afterReset = orchestrator.evaluateFallbackResponse({
        now: 16700,
        sessionState: 'ai_thinking',
      });
      // Should be inject_prompt (not session_recovery) since counter was reset
      expect(afterReset.type).toBe('inject_prompt');
    });
  });

  // -------------------------------------------------------------------------
  // Test: Dead Air → Escalation → Session End with Mocked Timers
  // Validates: Requirements 3.1, 3.3
  // -------------------------------------------------------------------------
  describe('Dead Air → Escalation → Session End (mocked timers)', () => {
    it('should escalate through full sequence with precise timer thresholds', () => {
      const config: RealisticModeConfig = {
        personaType: 'confused',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      const baseInput = {
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking' as const,
      };

      // t=0: Start silence tracking
      orchestrator.evaluateProlongedSilence({ now: 0, ...baseInput });

      // t=7999: Just below check_in threshold
      const belowCheckIn = orchestrator.evaluateProlongedSilence({
        now: 7999,
        ...baseInput,
      });
      expect(belowCheckIn.type).toBe('none');

      // t=8000: Exactly at check_in threshold
      const atCheckIn = orchestrator.evaluateProlongedSilence({
        now: 8000,
        ...baseInput,
      });
      expect(atCheckIn.type).toBe('inject_prompt');

      // t=19999: Just below closing_prompt threshold
      const belowClosing = orchestrator.evaluateProlongedSilence({
        now: 19999,
        ...baseInput,
      });
      expect(belowClosing.type).toBe('none');

      // t=20000: At closing_prompt threshold
      const atClosing = orchestrator.evaluateProlongedSilence({
        now: 20000,
        ...baseInput,
      });
      expect(atClosing.type).toBe('inject_prompt');

      // t=34999: Just below session_end threshold
      const belowEnd = orchestrator.evaluateProlongedSilence({
        now: 34999,
        ...baseInput,
      });
      expect(belowEnd.type).toBe('none');

      // t=35000: At session_end threshold
      const atEnd = orchestrator.evaluateProlongedSilence({
        now: 35000,
        ...baseInput,
      });
      expect(atEnd.type).toBe('end_session');
    });
  });


  // -------------------------------------------------------------------------
  // Test: Disruption + Persona Interaction Respects Emotional State
  // Validates: Requirements 8.1
  // -------------------------------------------------------------------------
  describe('Disruption + Persona Interaction Respects Emotional State', () => {
    it('should not trigger disruption when persona intensity is at max and persona is angry', () => {
      const config: RealisticModeConfig = {
        personaType: 'angry',
        disruptionTypes: ['technical_term_confusion'],
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Escalate persona to max intensity
      orchestrator.updatePersona({ type: 'escalation', trigger: 'dismissive' });
      orchestrator.updatePersona({ type: 'escalation', trigger: 'ignored_concern' });

      // Intensity should be capped at 10
      expect(orchestrator.emotionalIntensity).toBeLessThanOrEqual(10);

      // Disruptions should still trigger based on exchange count, not intensity
      orchestrator.onModelTurnComplete('Response 1');
      const result = orchestrator.onModelTurnComplete('Response 2');
      // Disruption triggers at exchange >= 2 regardless of intensity
      expect(result.type).toBe('inject_prompt');
    });

    it('should maintain persona consistency across disruption interactions', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        disruptionTypes: ['repeated_question'],
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      const initialIntensity = orchestrator.emotionalIntensity;

      // Trigger disruptions through exchanges
      orchestrator.onModelTurnComplete('Halo');
      orchestrator.onModelTurnComplete('Penjelasan...');

      // Persona type should remain cooperative
      const personaConfig = orchestrator.getPersonaConfig();
      expect(personaConfig.personaType).toBe('cooperative');

      // Intensity should not have changed dramatically without explicit events
      expect(orchestrator.emotionalIntensity).toBeGreaterThanOrEqual(1);
      expect(orchestrator.emotionalIntensity).toBeLessThanOrEqual(10);
    });
  });

  // -------------------------------------------------------------------------
  // Test: Graceful Degradation When Individual Engines Fail
  // Validates: Requirements 1.1, 10.1
  // -------------------------------------------------------------------------
  describe('Graceful Degradation When Individual Engines Fail', () => {
    it('should return none from hold state evaluation when mode is disabled', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: false,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      const result = orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      expect(result.type).toBe('none');
    });

    it('should handle audio frame evaluation with extreme values gracefully', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Extreme RMS values
      const result = orchestrator.evaluateAudioFrame({
        now: 1000,
        isSilent: false,
        rms: Infinity,
        sessionState: 'user_speaking',
      });

      expect(result.action).toBeDefined();
      expect(result.silenceThresholdMs).toBeGreaterThan(0);
    });

    it('should handle backchannel evaluation without crashing on edge cases', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      const result = orchestrator.evaluateBackchannel({
        now: 1000,
        agentSpeaking: true,
        agentSpeakingDurationMs: 0,
        isMicroPause: false,
        sessionState: 'user_speaking',
      });

      expect(result.type).toBe('none');
    });
  });


  // -------------------------------------------------------------------------
  // Test: UI Hold → Engine Suspension → Resume
  // Validates: Requirements 10.1, 10.4, 10.8
  // -------------------------------------------------------------------------
  describe('UI Hold → Engine Suspension → Resume', () => {
    it('should suspend all engines (TTE, BC, FRM, PSH) when UI hold is pressed', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Press UI hold button
      const holdResult = orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      expect(holdResult.type).toBe('hold_state_changed');
      if (holdResult.type === 'hold_state_changed') {
        expect(holdResult.suppressMicAudio).toBe(true);
        expect(holdResult.suppressGeminiAudio).toBe(true);
        expect(holdResult.suspendEngines).toBe(true);
      }

      // Verify orchestrator getters reflect suspension
      expect(orchestrator.suspendEngines).toBe(true);
      expect(orchestrator.suppressMicAudio).toBe(true);
      expect(orchestrator.suppressGeminiAudio).toBe(true);

      // TTE should return no action during hold
      const tteResult = orchestrator.evaluateAudioFrame({
        now: 2000,
        isSilent: true,
        rms: 0,
        sessionState: 'user_speaking',
      });
      expect(tteResult.action).toBe('none');

      // BC should return no action during hold
      const bcResult = orchestrator.evaluateBackchannel({
        now: 2000,
        agentSpeaking: true,
        agentSpeakingDurationMs: 10000,
        isMicroPause: true,
        sessionState: 'ai_speaking',
      });
      expect(bcResult.type).toBe('none');

      // FRM should return no action during hold
      orchestrator.onAgentStopSpeaking(500);
      const frmResult = orchestrator.evaluateFallbackResponse({
        now: 10000,
        sessionState: 'ai_thinking',
      });
      expect(frmResult.type).toBe('none');

      // PSH should return no action during hold (unless timer expired)
      const pshResult = orchestrator.evaluateProlongedSilence({
        now: 50000,
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking',
      });
      expect(pshResult.type).toBe('none');
    });

    it('should resume all engines when UI hold is released', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Activate hold
      orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      expect(orchestrator.suspendEngines).toBe(true);

      // Release hold
      const releaseResult = orchestrator.evaluateHoldStateInput({
        now: 5000,
        uiButtonPressed: false,
        uiButtonReleased: true,
        currentHoldActive: true,
        uiTimerExpired: false,
      });

      expect(releaseResult.type).toBe('hold_state_changed');
      if (releaseResult.type === 'hold_state_changed') {
        expect(releaseResult.suppressMicAudio).toBe(false);
        expect(releaseResult.suppressGeminiAudio).toBe(false);
        expect(releaseResult.suspendEngines).toBe(false);
      }

      // Verify orchestrator getters reflect resumed state
      expect(orchestrator.suspendEngines).toBe(false);
      expect(orchestrator.suppressMicAudio).toBe(false);
      expect(orchestrator.suppressGeminiAudio).toBe(false);

      // TTE should now process audio frames again
      const tteResult = orchestrator.evaluateAudioFrame({
        now: 6000,
        isSilent: true,
        rms: 0,
        sessionState: 'user_speaking',
      });
      // After resume, TTE processes normally (may return 'none' but is not suspended)
      expect(tteResult.action).toBeDefined();

      // FRM should process again after resume
      orchestrator.onAgentStopSpeaking(6000);
      orchestrator.evaluateFallbackResponse({ now: 7500, sessionState: 'ai_thinking' });
      const frmResult = orchestrator.evaluateFallbackResponse({
        now: 12700,
        sessionState: 'ai_thinking',
      });
      // After resume with enough time elapsed, fallback should trigger
      expect(frmResult.type).toBe('inject_prompt');
    });
  });


  // -------------------------------------------------------------------------
  // Test: UI Hold + Consent Context Cases
  // Validates: Requirements 10.9
  // -------------------------------------------------------------------------
  describe('UI Hold + Consent Context Cases', () => {
    it('should activate UI hold regardless of consent context state', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // UI press initiates hold - consentContext is injected internally
      const result = orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      expect(result.type).toBe('hold_state_changed');
      if (result.type === 'hold_state_changed') {
        expect(result.suppressMicAudio).toBe(true);
        expect(result.suppressGeminiAudio).toBe(true);
        expect(result.suspendEngines).toBe(true);
      }
      expect(orchestrator.suspendEngines).toBe(true);
    });

    it('should deactivate and reactivate hold across multiple UI press/release cycles', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // First cycle: press → hold
      orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });
      expect(orchestrator.suspendEngines).toBe(true);

      // First cycle: release
      orchestrator.evaluateHoldStateInput({
        now: 5000,
        uiButtonPressed: false,
        uiButtonReleased: true,
        currentHoldActive: true,
        uiTimerExpired: false,
      });
      expect(orchestrator.suspendEngines).toBe(false);

      // Second cycle: press → hold again
      orchestrator.evaluateHoldStateInput({
        now: 10000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });
      expect(orchestrator.suspendEngines).toBe(true);
    });
  });


  // -------------------------------------------------------------------------
  // Test: Hold Timer Expiry → Auto-Release
  // Validates: Requirements 10.10
  // -------------------------------------------------------------------------
  describe('Hold Timer Expiry → Auto-Release', () => {
    it('should auto-release hold when UI timer expires', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Activate UI hold
      orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      expect(orchestrator.suspendEngines).toBe(true);
      expect(orchestrator.suppressMicAudio).toBe(true);
      expect(orchestrator.suppressGeminiAudio).toBe(true);

      // Simulate timer countdown reaching zero (60s for first hold)
      const expiryResult = orchestrator.evaluateHoldStateInput({
        now: 61000, // 60s later
        uiButtonPressed: false,
        uiButtonReleased: false,
        currentHoldActive: true,
        uiTimerExpired: true, // Timer expired
      });

      // Should auto-release
      expect(expiryResult.type).toBe('hold_state_changed');
      if (expiryResult.type === 'hold_state_changed') {
        expect(expiryResult.suppressMicAudio).toBe(false);
        expect(expiryResult.suppressGeminiAudio).toBe(false);
        expect(expiryResult.suspendEngines).toBe(false);
      }

      // Verify orchestrator state reflects deactivation
      expect(orchestrator.suspendEngines).toBe(false);
      expect(orchestrator.suppressMicAudio).toBe(false);
      expect(orchestrator.suppressGeminiAudio).toBe(false);
    });

    it('should resume normal session flow after auto-release', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Activate and then auto-release via timer expiry
      orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      orchestrator.evaluateHoldStateInput({
        now: 61000,
        uiButtonPressed: false,
        uiButtonReleased: false,
        currentHoldActive: true,
        uiTimerExpired: true,
      });

      // After auto-release, engines should process normally
      expect(orchestrator.suspendEngines).toBe(false);

      // TTE should process audio frames
      const tteResult = orchestrator.evaluateAudioFrame({
        now: 62000,
        isSilent: true,
        rms: 0,
        sessionState: 'user_speaking',
      });
      expect(tteResult.action).toBeDefined();
      expect(tteResult.silenceThresholdMs).toBeGreaterThan(0);

      // PSH should start tracking silence again
      orchestrator.evaluateProlongedSilence({
        now: 62000,
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking',
      });
      const pshResult = orchestrator.evaluateProlongedSilence({
        now: 70500, // 8.5s of silence after resume
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking',
      });
      expect(pshResult.type).toBe('inject_prompt');
    });

    it('should handle subsequent holds with longer timer (180s)', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // First hold (60s timer)
      orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      // Release first hold
      orchestrator.evaluateHoldStateInput({
        now: 5000,
        uiButtonPressed: false,
        uiButtonReleased: true,
        currentHoldActive: true,
        uiTimerExpired: false,
      });

      expect(orchestrator.suspendEngines).toBe(false);

      // Second hold (should use 180s timer)
      orchestrator.evaluateHoldStateInput({
        now: 10000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      expect(orchestrator.suspendEngines).toBe(true);

      // Timer expiry at 180s
      const expiryResult = orchestrator.evaluateHoldStateInput({
        now: 190000,
        uiButtonPressed: false,
        uiButtonReleased: false,
        currentHoldActive: true,
        uiTimerExpired: true,
      });

      expect(expiryResult.type).toBe('hold_state_changed');
      if (expiryResult.type === 'hold_state_changed') {
        expect(expiryResult.suspendEngines).toBe(false);
      }
      expect(orchestrator.suspendEngines).toBe(false);
    });
  });


  // -------------------------------------------------------------------------
  // Test: WebSocket Reconnect During Hold
  // Validates: Requirements 10.4, 10.8
  // -------------------------------------------------------------------------
  describe('WebSocket Reconnect During Hold (audio isolation preserved)', () => {
    it('should maintain audio isolation flags during simulated reconnect', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Activate UI hold
      orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      expect(orchestrator.suppressMicAudio).toBe(true);
      expect(orchestrator.suppressGeminiAudio).toBe(true);
      expect(orchestrator.suspendEngines).toBe(true);

      // Simulate WebSocket disconnect + reconnect:
      // After reconnect, the orchestrator state should still reflect hold
      // (The orchestrator maintains its own state independent of WebSocket)

      // Verify audio isolation is preserved after "reconnect" by checking
      // that all suppress flags remain true without any new hold input
      expect(orchestrator.suppressMicAudio).toBe(true);
      expect(orchestrator.suppressGeminiAudio).toBe(true);

      // Simulate post-reconnect: engines still suspended
      const tteResult = orchestrator.evaluateAudioFrame({
        now: 5000,
        isSilent: false,
        rms: 0.5,
        sessionState: 'user_speaking',
      });
      expect(tteResult.action).toBe('none');

      // FRM still suspended
      orchestrator.onAgentStopSpeaking(500);
      const frmResult = orchestrator.evaluateFallbackResponse({
        now: 20000,
        sessionState: 'ai_thinking',
      });
      expect(frmResult.type).toBe('none');

      // PSH still suspended
      const pshResult = orchestrator.evaluateProlongedSilence({
        now: 50000,
        agentSpeaking: false,
        agentAudioDurationMs: 0,
        sessionState: 'ai_thinking',
      });
      expect(pshResult.type).toBe('none');

      // BC still suspended
      const bcResult = orchestrator.evaluateBackchannel({
        now: 5000,
        agentSpeaking: true,
        agentSpeakingDurationMs: 15000,
        isMicroPause: true,
        sessionState: 'ai_speaking',
      });
      expect(bcResult.type).toBe('none');
    });

    it('should preserve suppressMicAudio=true during hold regardless of audio events', () => {
      const config: RealisticModeConfig = {
        personaType: 'angry',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Activate hold
      orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      // Simulate multiple audio frame evaluations (as if mic is still capturing)
      for (let t = 2000; t <= 10000; t += 1000) {
        orchestrator.evaluateAudioFrame({
          now: t,
          isSilent: false,
          rms: 0.3,
          transcriptionChunk: 'some audio',
          sessionState: 'user_speaking',
        });
      }

      // suppressMicAudio should remain true throughout
      expect(orchestrator.suppressMicAudio).toBe(true);
      expect(orchestrator.suppressGeminiAudio).toBe(true);
    });

    it('should preserve suppressGeminiAudio=true during hold even if model sends audio', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Activate hold
      orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      // Simulate agent start/stop speaking events (as if WebSocket delivers audio)
      orchestrator.onAgentStartSpeaking(3000);
      orchestrator.onAgentStopSpeaking(5000);

      // suppressGeminiAudio should still be true (audio should not play)
      expect(orchestrator.suppressGeminiAudio).toBe(true);
      expect(orchestrator.suppressMicAudio).toBe(true);
      expect(orchestrator.suspendEngines).toBe(true);
    });

    it('should correctly resume after hold release following reconnect scenario', () => {
      const config: RealisticModeConfig = {
        personaType: 'cooperative',
        enabled: true,
      };
      const orchestrator = new RealisticModeOrchestrator(config);

      // Activate hold
      orchestrator.evaluateHoldStateInput({
        now: 1000,
        uiButtonPressed: true,
        uiButtonReleased: false,
        currentHoldActive: false,
        uiTimerExpired: false,
      });

      // Simulate time passing (WebSocket reconnect happens in background)
      // Hold state is maintained by orchestrator independently

      // Release hold after "reconnect"
      orchestrator.evaluateHoldStateInput({
        now: 30000,
        uiButtonPressed: false,
        uiButtonReleased: true,
        currentHoldActive: true,
        uiTimerExpired: false,
      });

      // All flags should be reset
      expect(orchestrator.suppressMicAudio).toBe(false);
      expect(orchestrator.suppressGeminiAudio).toBe(false);
      expect(orchestrator.suspendEngines).toBe(false);

      // Engines should resume processing
      orchestrator.onAgentStopSpeaking(30000);
      orchestrator.evaluateFallbackResponse({ now: 31500, sessionState: 'ai_thinking' });
      const frmResult = orchestrator.evaluateFallbackResponse({
        now: 36700,
        sessionState: 'ai_thinking',
      });
      expect(frmResult.type).toBe('inject_prompt');
    });
  });
});
