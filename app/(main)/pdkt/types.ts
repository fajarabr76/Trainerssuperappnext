export interface AppSettings {
  scenarios: Scenario[];
  consumerTypes: ConsumerType[];
  enableImageGeneration: boolean;
  globalConsumerTypeId: string;
  selectedModel?: string;
  customIdentity?: {
    senderName?: string;
    bodyName?: string;
    email?: string;
    city?: string;
  };
}

export interface Scenario {
  id: string;
  category: string;
  title: string;
  description: string;
  script?: string;
  isActive: boolean;
  attachmentImages?: string[];
}

export enum ConsumerDifficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard',
  Random = 'Random'
}

export interface ConsumerType {
  id: string;
  name: string;
  description: string;
  difficulty?: ConsumerDifficulty;
  tone?: string;
  isCustom?: boolean;
}

export interface SessionConfig {
  scenarios: Scenario[];
  consumerType: ConsumerType;
  identity: Identity;
  enableImageGeneration: boolean;
  model: string;
}

export interface Identity {
  name: string;
  email: string;
  city: string;
  bodyName: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: Date;
  isAgent: boolean;
  attachments?: string[];
}

export interface EvaluationResult {
  score: number;
  feedback: string;
  typos: string[];
  clarityIssues: string[];
  contentGaps: string[];
}

export interface SessionHistory {
  id: string;
  timestamp: Date;
  config: SessionConfig;
  emails: EmailMessage[];
  evaluation: EvaluationResult | null;
  timeTaken: number | null;
}
