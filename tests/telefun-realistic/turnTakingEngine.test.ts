/**
 * Unit tests for Turn-Taking Engine.
 * Validates core logic of evaluateTurnTaking pure function guard.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateTurnTaking,
  createInitialTurnTakingState,
  type TurnTakingState,
  type TurnTakingInput,
} from '@/app/(main)/telefun/services/realisticMode/turnTakingEngine';

function makeInput(overrides: Partial<TurnTakingInput> = {}): TurnTakingInput {
  return {
    now: 10000,
    isSilent: false,
    rms: 0.05,
    sessionState: 'user_speaking',
    ...overrides,
  };
}

function makeState(overrides: Partial<TurnTakingState> = {}): TurnTakingState {
  return {
    ...createInitialTurnTakingState(),
    ...overrides,
  };
}

describe('evaluateTurnTaking', () => {
  describe('Non-speech sound suppression (Req 2.3)', () => {
    it('suppresses non-speech sounds with low RMS', () => {
      const state = makeState();
      const input = makeInput({ isSilent: false, rms: 0.005 });

      const result = evaluateTurnTaking(state, input);
      expect(result.action).toBe('suppress_non_speech');
    });

    it('suppresses brief non-speech during silence tracking', () => {
      const state = makeState({ silenceStartMs: 9800 });
      const input = makeInput({ now: 10000, isSilent: false, rms: 0.01 });

      const result = evaluateTurnTaking(state, input);
      expect(result.action).toBe('suppress_non_speech');
    });
  });

  describe('Silence tracking and end-of-turn (Req 2.2, 2.6)', () => {
    it('starts tracking silence when input is silent', () => {
      const state = makeState();
      const input = makeInput({ isSilent: true, rms: 0 });

      const result = evaluateTurnTaking(state, input);
      expect(result.state.silenceStartMs).toBe(input.now);
      expect(result.action).toBe('none');
    });

    it('does NOT classify mid-utterance pause < 1500ms as end-of-turn', () => {
      // Silence started 1000ms ago, no completeness signals
      const state = makeState({ silenceStartMs: 9000 });
      const input = makeInput({ now: 10000, isSilent: true, rms: 0 });

      const result = evaluateTurnTaking(state, input);
      expect(result.action).not.toBe('end_of_turn');
    });

    it('classifies end-of-turn when silence >= 1500ms with falling intonation', () => {
      const state = makeState({
        silenceStartMs: 8500,
        contextualSignals: {
          hasFallingIntonation: true,
          hasSentenceFinalParticle: false,
          hasConjunction: false,
          hasRisingIntonation: false,
          lastTranscriptionChunk: 'terima kasih',
        },
      });
      const input = makeInput({
        now: 10000,
        isSilent: true,
        rms: 0,
        pitchHz: 120,
      });

      const result = evaluateTurnTaking(state, input);
      expect(result.action).toBe('end_of_turn');
    });

    it('classifies end-of-turn when silence >= 1500ms with sentence-final particle', () => {
      const state = makeState({
        silenceStartMs: 8000,
        contextualSignals: {
          hasFallingIntonation: false,
          hasSentenceFinalParticle: true,
          hasConjunction: false,
          hasRisingIntonation: false,
          lastTranscriptionChunk: 'itu kan',
        },
      });
      const input = makeInput({
        now: 10000,
        isSilent: true,
        rms: 0,
        transcriptionChunk: 'itu kan',
      });

      const result = evaluateTurnTaking(state, input);
      expect(result.action).toBe('end_of_turn');
    });
  });

  describe('Response delay after end-of-turn (Req 2.4)', () => {
    it('sets responseDelayUntil = now + 400 on end-of-turn', () => {
      const state = makeState({
        silenceStartMs: 8000,
        contextualSignals: {
          hasFallingIntonation: true,
          hasSentenceFinalParticle: false,
          hasConjunction: false,
          hasRisingIntonation: false,
          lastTranscriptionChunk: 'selesai',
        },
      });
      const input = makeInput({
        now: 10000,
        isSilent: true,
        rms: 0,
        pitchHz: 100,
      });

      const result = evaluateTurnTaking(state, input);
      expect(result.action).toBe('end_of_turn');
      expect(result.state.responseDelayUntil).toBe(10000 + 400);
    });
  });

  describe('Multi-clause threshold extension (Req 2.5)', () => {
    it('extends threshold to 2000ms when conjunction detected', () => {
      const state = makeState({ silenceStartMs: 8500 });
      const input = makeInput({
        now: 10000,
        isSilent: true,
        rms: 0,
        transcriptionChunk: 'saya mau tapi',
      });

      const result = evaluateTurnTaking(state, input);
      expect(result.silenceThresholdMs).toBe(2000);
    });

    it('extends threshold to 2000ms when rising intonation detected', () => {
      const state = makeState({ silenceStartMs: 8500 });
      const input = makeInput({
        now: 10000,
        isSilent: true,
        rms: 0,
        pitchHz: 260,
      });

      const result = evaluateTurnTaking(state, input);
      expect(result.silenceThresholdMs).toBe(2000);
    });
  });

  describe('Ambiguous signals (Req 2.7)', () => {
    it('extends threshold to 2000ms when signals are ambiguous', () => {
      // No transcription, no pitch — ambiguous
      const state = makeState({ silenceStartMs: 8500 });
      const input = makeInput({
        now: 10000,
        isSilent: true,
        rms: 0,
      });

      const result = evaluateTurnTaking(state, input);
      expect(result.silenceThresholdMs).toBe(2000);
    });

    it('classifies end-of-turn after 2000ms even with ambiguous signals', () => {
      const state = makeState({ silenceStartMs: 7900 });
      const input = makeInput({
        now: 10000,
        isSilent: true,
        rms: 0,
      });

      const result = evaluateTurnTaking(state, input);
      // 2100ms of silence with ambiguous signals → end_of_turn
      expect(result.action).toBe('end_of_turn');
    });
  });

  describe('Agent speaking resets state', () => {
    it('resets silence tracking when agent speaks', () => {
      const state = makeState({ silenceStartMs: 8000, pendingEndOfTurn: true });
      const input = makeInput({ isSilent: false, rms: 0.05 });

      const result = evaluateTurnTaking(state, input);
      expect(result.state.silenceStartMs).toBeNull();
      expect(result.state.pendingEndOfTurn).toBe(false);
      expect(result.action).toBe('none');
    });
  });

  describe('Contextual signal detection', () => {
    it('detects sentence-final particle "ya"', () => {
      const state = makeState({ silenceStartMs: 8000 });
      const input = makeInput({
        now: 10000,
        isSilent: true,
        rms: 0,
        transcriptionChunk: 'baik ya',
        pitchHz: 130,
      });

      const result = evaluateTurnTaking(state, input);
      expect(result.state.contextualSignals.hasSentenceFinalParticle).toBe(true);
      expect(result.action).toBe('end_of_turn');
    });

    it('detects conjunction "karena" as multi-clause', () => {
      const state = makeState({ silenceStartMs: 9500 });
      const input = makeInput({
        now: 10000,
        isSilent: true,
        rms: 0,
        transcriptionChunk: 'saya tidak bisa karena',
      });

      const result = evaluateTurnTaking(state, input);
      expect(result.state.contextualSignals.hasConjunction).toBe(true);
      expect(result.state.isMultiClause).toBe(true);
      expect(result.silenceThresholdMs).toBe(2000);
    });
  });
});
