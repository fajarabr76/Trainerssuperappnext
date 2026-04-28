import { AppSettings } from '@/app/types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES } from './constants';

export const defaultTelefunSettings: AppSettings = {
  scenarios: DEFAULT_SCENARIOS,
  consumerTypes: DEFAULT_CONSUMER_TYPES,
  activeConsumerTypeId: 'random',
  preferredConsumerTypeId: 'random',
  identitySettings: {
    displayName: '',
    gender: 'male',
    phoneNumber: '',
    city: '',
    signatureName: '',
  },
  selectedModel: 'gemini-3.1-flash-lite-preview',
  maxCallDuration: 5,
};
