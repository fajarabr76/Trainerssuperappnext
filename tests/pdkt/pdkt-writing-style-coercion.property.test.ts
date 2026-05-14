import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  coerceWritingStyleMode,
  generateSessionConfig,
} from '@/app/(main)/pdkt/services/settingService';
import type { WritingStyleMode } from '@/app/(main)/pdkt/types';

describe('Property 2: coerceWritingStyleMode coercion fallback to training', () => {
  it('always returns realistic or training for any string input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = coerceWritingStyleMode(input);
        return result === 'realistic' || result === 'training';
      }),
      { numRuns: 100 }
    );
  });

  it('always returns realistic or training for undefined/null/empty', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(undefined), fc.constant(null), fc.constant('')),
        (input) => {
          const result = coerceWritingStyleMode(input);
          return result === 'realistic' || result === 'training';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('passes "realistic" and "training" through unchanged', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<WritingStyleMode>('realistic', 'training'),
        (input) => {
          return coerceWritingStyleMode(input) === input;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('coerces any non-valid value to training', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant('invalid'),
          fc.constant('realistc'),
          fc.constant('TRAINING'),
          fc.constant('realistic-mode'),
          fc.constant('abc'),
          fc.constant('123'),
          fc.constant(undefined),
          fc.constant(null)
        ),
        (input) => {
          return coerceWritingStyleMode(input) === 'training';
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 4: generateSessionConfig WritingStyleMode passthrough', () => {
  it('preserves writingStyleMode in generated SessionConfig', () => {
    fc.assert(
      fc.property(
        fc.record({
          scenarios: fc.constant([]),
          consumerTypes: fc.constant([]),
          enableImageGeneration: fc.boolean(),
          globalConsumerTypeId: fc.constant('random'),
          consumerNameMentionPattern: fc.constant('random' as const),
          writingStyleMode: fc.constantFrom<WritingStyleMode>('realistic', 'training'),
        }),
        (settings) => {
          const config = generateSessionConfig(settings as any);
          return config.writingStyleMode === settings.writingStyleMode;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('defaults to training when writingStyleMode is missing from AppSettings', () => {
    fc.assert(
      fc.property(
        fc.record({
          scenarios: fc.constant([]),
          consumerTypes: fc.constant([]),
          enableImageGeneration: fc.boolean(),
          globalConsumerTypeId: fc.constant('random'),
          consumerNameMentionPattern: fc.constant('random' as const),
        }),
        (settings) => {
          const config = generateSessionConfig(settings as any);
          return config.writingStyleMode === 'training';
        }
      ),
      { numRuns: 100 }
    );
  });
});
