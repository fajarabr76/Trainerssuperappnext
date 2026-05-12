import { AppSettings } from '@/app/types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES } from './constants';

export const defaultTelefunSettings: AppSettings = {
  scenarios: DEFAULT_SCENARIOS,
  consumerTypes: DEFAULT_CONSUMER_TYPES,
  preferredConsumerTypeId: 'random',
  identitySettings: {
    displayName: '',
    gender: 'random',
    phoneNumber: '',
    city: '',
    signatureName: '',
    voiceName: '',
  },
  selectedModel: 'gemini-3.1-flash-lite',
  telefunModelId: 'gemini-3.1-flash-live-preview',
  maxCallDuration: 5,
  responsePacingMode: 'realistic',
};
