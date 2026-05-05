import { AppSettings } from '@/app/types';
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
  selectedModel: 'openai/gpt-oss-120b:free',
  simulationDuration: 5,
  responsePacingMode: 'realistic'
};
