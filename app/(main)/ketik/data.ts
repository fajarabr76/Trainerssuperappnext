import { AppSettings, ConsumerDifficulty } from '@/app/types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES } from './constants';

export const defaultSettings: AppSettings = {
  scenarios: DEFAULT_SCENARIOS,
  consumerTypes: DEFAULT_CONSUMER_TYPES,
  activeConsumerTypeId: 'random',
  identitySettings: {
    displayName: '',
    signatureName: '',
    phoneNumber: '',
    city: ''
  },
  selectedModel: 'qwen/qwen3-next-80b-a3b-instruct:free',
  simulationDuration: 5
};
