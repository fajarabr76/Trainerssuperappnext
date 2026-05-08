import { AppSettings } from '@/app/types';
import { DEFAULT_SCENARIOS, DEFAULT_CONSUMER_TYPES, DEFAULT_QUICK_TEMPLATES } from './constants';

export const defaultSettings: AppSettings = {
  scenarios: DEFAULT_SCENARIOS,
  consumerTypes: DEFAULT_CONSUMER_TYPES,
  quickTemplates: DEFAULT_QUICK_TEMPLATES,
  activeConsumerTypeId: 'random',
  identitySettings: {
    displayName: '',
    signatureName: '',
    phoneNumber: '',
    city: ''
  },
  selectedModel: 'gemini-3.1-flash-lite',
  simulationDuration: 5,
  responsePacingMode: 'realistic'
};
