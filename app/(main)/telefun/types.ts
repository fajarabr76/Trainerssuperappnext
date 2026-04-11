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
  gender: 'male' | 'female';
}

export interface ConsumerIdentitySettings {
  displayName: string;
  gender: 'male' | 'female';
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
  fixedIdentity?: {
      name: string;
      gender: 'male' | 'female';
      city: string;
      phone: string;
  };
  script?: string;
  images?: string[];
}

export interface SessionConfig {
  scenarios: Scenario[];
  consumerType: ConsumerType;
  identity: Identity;
  model: string;
  maxCallDuration: number;
}

export interface AppSettings {
  scenarios: Scenario[];
  consumerTypes: ConsumerType[];
  preferredConsumerTypeId: string;
  identitySettings: ConsumerIdentitySettings;
  selectedModel: string;
  maxCallDuration: number;
}

