export interface CallRecord {
  id: string;
  date: string;
  url: string;
  consumerName: string;
  scenarioTitle: string;
  duration: number;
  score?: number;
  feedback?: string;
}

export type TelefunSessionState =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'user_speaking'
  | 'ai_thinking'
  | 'ai_speaking'
  | 'interruption_candidate'
  | 'recovering'
  | 'ended';

export type TelefunTimelineEventName =
  | 'connect_start'
  | 'mic_ready'
  | 'ws_open'
  | 'ws_close'
  | 'setup_sent'
  | 'setup_complete_received'
  | 'audio_chunk_send'
  | 'first_model_audio_chunk'
  | 'turn_complete_received'
  | 'local_user_turn_end_detected'
  | 'local_turn_nudge_sent'
  | 'interrupted_received'
  | 'playback_start'
  | 'playback_end'
  | 'dead_air_prompt_sent'
  | 'interruption_prompt_sent'
  | 'stalled_response_detected'
  | 'recovering'
  | 'disconnect';

export interface TelefunTimelineEvent {
  event: TelefunTimelineEventName;
  ts: number;
  sessionId: string;
  turnId?: string;
  state?: TelefunSessionState;
  meta?: Record<string, unknown>;
}
