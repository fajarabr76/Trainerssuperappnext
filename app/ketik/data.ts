import { AppSettings, ConsumerDifficulty } from '../types';
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
  selectedModel: 'gemini-3-flash-preview',
  simulationDuration: 5
};
