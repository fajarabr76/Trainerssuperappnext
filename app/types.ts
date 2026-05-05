export enum ConsumerDifficulty {
  Easy = 'Mudah',
  Medium = 'Sedang',
  Hard = 'Sulit'
}

export interface Identity {
  name: string;
  city: string;
  phone: string;
  signatureName?: string;
  gender?: 'male' | 'female';
}

export interface ConsumerIdentitySettings {
  displayName: string;
  signatureName: string;
  phoneNumber: string;
  city: string;
  gender?: 'male' | 'female';
}

export interface ConsumerType {
  id: string;
  name: string;
  description: string;
  difficulty: ConsumerDifficulty;
  isCustom?: boolean;
}

export interface Scenario {
  id: string;
  category: string;
  title: string;
  description: string;
  isActive: boolean;
  script?: string;
  images?: string[];
}

export interface PacingMeta {
  mode: 'realistic' | 'training_fast';
  band: 'short' | 'normal' | 'long' | 'slow' | 'follow_up' | 'greeting_reply';
  plannedDelayMs: number;
  timerClamped: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'agent' | 'consumer' | 'system';
  text: string;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
  pacingMeta?: PacingMeta;
}

export interface SessionConfig {
  scenarios: Scenario[];
  consumerType: ConsumerType;
  identity: Identity;
  selectedModel: string;
  simulationDuration: number;
  responsePacingMode: 'realistic' | 'training_fast';
  maxCallDuration?: number;
  telefunTransport?: 'gemini-live' | 'openai-audio';
  telefunModelId?: string;
}

export interface AppSettings {
  scenarios: Scenario[];
  consumerTypes: ConsumerType[];
  activeConsumerTypeId?: string;
  preferredConsumerTypeId?: string;
  identitySettings: ConsumerIdentitySettings;
  selectedModel: string;
  simulationDuration?: number;
  maxCallDuration?: number;
  responsePacingMode?: 'realistic' | 'training_fast';
  telefunTransport?: 'gemini-live' | 'openai-audio';
  telefunModelId?: string;
}

export interface ChatSession {
  id: string;
  date: Date;
  scenarioTitle: string;
  consumerName: string;
  consumerPhone?: string;
  consumerCity?: string;
  messages: ChatMessage[];
}
