export type ConsumerNameMentionPattern =
  | 'random'
  | 'upfront'
  | 'middle'
  | 'late'
  | 'none';

export type ResolvedConsumerNameMentionPattern =
  | 'upfront'
  | 'middle'
  | 'late'
  | 'none';

export interface AppSettings {
  scenarios: Scenario[];
  consumerTypes: ConsumerType[];
  enableImageGeneration: boolean;
  globalConsumerTypeId: string;
  selectedModel?: string;
  consumerNameMentionPattern?: ConsumerNameMentionPattern;
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
  selectedModel: string;
  resolvedConsumerNameMentionPattern: ResolvedConsumerNameMentionPattern;
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
  content?: string;
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

export type EvaluationStatus = 'processing' | 'completed' | 'failed';

export interface SessionHistory {
  id: string;
  timestamp: Date;
  config: SessionConfig;
  emails: EmailMessage[];
  evaluation: EvaluationResult | null;
  evaluationStatus: EvaluationStatus;
  evaluationError?: string | null;
  evaluationStartedAt?: string | null;
  evaluationCompletedAt?: string | null;
  timeTaken: number | null;
}
