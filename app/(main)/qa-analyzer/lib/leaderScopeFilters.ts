import type { LeaderScopeFilter } from '@/app/lib/access-control/leaderScope';
import type { AgentDirectoryEntry, TopAgentData } from './qa-types';

export function filterAgentDirectoryByLeaderScope(
  data: AgentDirectoryEntry[],
  allowedScopes: LeaderScopeFilter,
): AgentDirectoryEntry[] {
  return data.filter((agent) => {
    if (allowedScopes.peserta_ids?.includes(agent.id)) return true;
    if (allowedScopes.batch_names?.includes(agent.batch_name || agent.batch || '')) return true;
    if (allowedScopes.tims?.includes(agent.tim || '')) return true;
    return false;
  });
}

export function filterAgentDirectoryByParticipantIds(
  data: AgentDirectoryEntry[],
  participantIds: string[],
): AgentDirectoryEntry[] {
  const idSet = new Set(participantIds);
  return data.filter((agent) => idSet.has(agent.id));
}

export function filterRankingByLeaderScope(
  data: TopAgentData[],
  allowedScopes: LeaderScopeFilter,
): TopAgentData[] {
  return data.filter((agent) => {
    if (allowedScopes.peserta_ids?.includes(agent.agentId)) return true;
    if (allowedScopes.batch_names?.includes(agent.batch)) return true;
    if (allowedScopes.tims?.includes(agent.tim || '')) return true;
    return false;
  });
}

export function filterRankingByParticipantIds(
  data: TopAgentData[],
  participantIds: string[],
): TopAgentData[] {
  const idSet = new Set(participantIds);
  return data.filter((agent) => idSet.has(agent.agentId));
}
