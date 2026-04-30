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
