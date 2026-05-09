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
  sampleEmailTemplate?: {
    subject?: string;
    body: string;
  };
  alwaysUseSampleEmail?: boolean;
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

export type MailboxStatus = 'open' | 'replied' | 'deleted';

export interface PdktMailboxItem {
  id: string;
  user_id: string;
  status: MailboxStatus;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  replied_at?: string | null;
  sender_name: string;
  sender_email: string;
  subject: string;
  snippet: string;
  scenario_snapshot: Scenario;
  config_snapshot: SessionConfig;
  inbound_email: EmailMessage;
  emails_thread: EmailMessage[];
  history_id?: string | null;
  last_activity_at: string;

  // Fanout and shared fields
  created_by_user_id?: string | null;
  source_mailbox_item_id?: string | null;
  share_batch_id?: string | null;
  client_request_id?: string | null;
  is_shared_copy?: boolean;
  shared_at?: string | null;
}
