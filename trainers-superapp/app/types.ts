export enum ConsumerDifficulty {
  Easy = 'Mudah',
  Medium = 'Sedang',
  Hard = 'Sulit',
  Random = 'Random'
}

export interface Identity {
  name: string;
  city: string;
  phone: string;
  signatureName?: string;
}

export interface ConsumerIdentitySettings {
  displayName: string;
  signatureName: string;
  phoneNumber: string;
  city: string;
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

export interface ChatMessage {
  id: string;
  sender: 'agent' | 'consumer' | 'system';
  text: string;
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
}

export interface SessionConfig {
  scenarios: Scenario[];
  consumerType: ConsumerType;
  identity: Identity;
  model: string;
  simulationDuration: number;
}

export interface AppSettings {
  scenarios: Scenario[];
  consumerTypes: ConsumerType[];
  activeConsumerTypeId: string;
  identitySettings: ConsumerIdentitySettings;
  selectedModel: string;
  simulationDuration?: number;
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
