import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const actionsSource = readFileSync('app/(main)/qa-analyzer/actions.ts', 'utf8');
const dashboardSource = readFileSync('app/(main)/qa-analyzer/dashboard/page.tsx', 'utf8');
const agentsPageSource = readFileSync('app/(main)/qa-analyzer/agents/page.tsx', 'utf8');
const rankingPageSource = readFileSync('app/(main)/qa-analyzer/ranking/page.tsx', 'utf8');

describe('Leader SIDAK access enforcement contracts', () => {
  it('filters the show-all agent directory server action for leader scope', () => {
    const block = extractFunction(actionsSource, 'getAllAgentDirectoryAction');
    expect(block).toContain("getLeaderAccessStatus(user.id, 'sidak')");
    expect(block).toContain('filterAgentDirectoryByLeaderScope');
    expect(block).not.toContain('return { data };');
  });

  it('filters ranking server action for leader scope on every client refresh', () => {
    const block = extractFunction(actionsSource, 'getRankingAgenAction');
    expect(block).toContain("getLeaderAccessStatus(user.id, 'sidak')");
    expect(block).toContain('filterRankingByLeaderScope');
    expect(block).not.toContain('return { data };');
  });

  it('keeps dashboard fail-closed for leader scopes that cannot be represented by folder filters', () => {
    expect(dashboardSource).toContain('hasUnsupportedDashboardScope');
    expect(dashboardSource).toContain('return emptyDashboardData');
  });

  it('passes leader scope into initial directory and ranking fetches', () => {
    expect(agentsPageSource).toContain('getAgentDirectorySummary(undefined, false, leaderAccess.scope');
    expect(rankingPageSource).toContain('getRankingAgenAction(');
    expect(rankingPageSource).toContain('scope.batch_names ?? []');
  });
});

function extractFunction(source: string, functionName: string) {
  const start = source.indexOf(`export async function ${functionName}`);
  expect(start, `missing function ${functionName}`).toBeGreaterThanOrEqual(0);

  const nextExport = source.indexOf('\nexport async function ', start + 1);
  return source.slice(start, nextExport === -1 ? undefined : nextExport);
}
