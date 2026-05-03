import { describe, expect, it } from 'vitest';
import type { LeaderScopeFilter } from '../../app/lib/access-control/leaderScope';
import type { TopAgentData } from '../../app/(main)/qa-analyzer/lib/qa-types';
import { filterRankingByLeaderScope } from '../../app/(main)/qa-analyzer/lib/leaderScopeFilters';

describe('Ranking Leader Scope Filtering (OR Logic)', () => {
  const dummyAgents: TopAgentData[] = [
    { agentId: 'agent-1', name: 'Agent One', batch: 'Batch A', tim: 'Tim X', totalScore: 90, totalEvaluations: 1, averageScore: 90, rank: 1, periodId: 'p1' },
    { agentId: 'agent-2', name: 'Agent Two', batch: 'Batch A', tim: 'Tim Y', totalScore: 80, totalEvaluations: 1, averageScore: 80, rank: 2, periodId: 'p1' },
    { agentId: 'agent-3', name: 'Agent Three', batch: 'Batch B', tim: 'Tim Z', totalScore: 85, totalEvaluations: 1, averageScore: 85, rank: 3, periodId: 'p1' },
    { agentId: 'agent-4', name: 'Agent Four', batch: 'Batch C', tim: 'Tim X', totalScore: 95, totalEvaluations: 1, averageScore: 95, rank: 4, periodId: 'p1' },
  ];

  it('allows agents that match ANY of the scope dimensions (OR logic)', () => {
    const scope: LeaderScopeFilter = {
      peserta_ids: ['agent-3'], // Matches Agent Three
      batch_names: ['Batch A'], // Matches Agent One, Agent Two
      tims: ['Tim X'] // Matches Agent One, Agent Four
    };

    const filtered = filterRankingByLeaderScope(dummyAgents, scope);

    // Should include:
    // agent-1 (matches Batch A and Tim X)
    // agent-2 (matches Batch A)
    // agent-3 (matches agent-3)
    // agent-4 (matches Tim X)
    expect(filtered).toHaveLength(4);
    const ids = filtered.map(a => a.agentId).sort();
    expect(ids).toEqual(['agent-1', 'agent-2', 'agent-3', 'agent-4']);
  });

  it('filters out agents that match NONE of the scope dimensions', () => {
    const scope: LeaderScopeFilter = {
      peserta_ids: ['agent-1'], // Matches Agent One
      batch_names: ['Batch B'], // Matches Agent Three
      // No tims scope
    };

    const filtered = filterRankingByLeaderScope(dummyAgents, scope);

    // Should include agent-1 and agent-3.
    // agent-2 (Batch A, Tim Y) and agent-4 (Batch C, Tim X) should be excluded.
    expect(filtered).toHaveLength(2);
    const ids = filtered.map(a => a.agentId).sort();
    expect(ids).toEqual(['agent-1', 'agent-3']);
  });

  it('returns empty array if scope is empty', () => {
    const scope: LeaderScopeFilter = {};
    const filtered = filterRankingByLeaderScope(dummyAgents, scope);
    expect(filtered).toHaveLength(0);
  });
});
