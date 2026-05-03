import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync('app/(main)/dashboard/access-groups/page.tsx', 'utf8');
const clientSource = readFileSync('app/(main)/dashboard/access-groups/AccessGroupsClient.tsx', 'utf8');
const actionSource = readFileSync('app/actions/leader-access.ts', 'utf8');

describe('Access group guided scope builder contracts', () => {
  it('loads available teams, services, and agents before rendering the access groups client', () => {
    expect(actionSource).toContain('getAccessScopeOptions');
    expect(actionSource).toContain(".from('profiler_peserta')");
    expect(actionSource).toContain('agentsByTeam');
    expect(pageSource).toContain('getAccessScopeOptions');
    expect(pageSource).toContain('scopeOptions={scopeOptions}');
  });

  it('uses a guided scope type picker instead of raw field/value entry', () => {
    expect(clientSource).toContain("type ScopeBuilderMode = 'team' | 'service' | 'name'");
    expect(clientSource).toContain('scopeOptions');
    expect(clientSource).toContain('selectedTeam');
    expect(clientSource).toContain('selectedAgentId');
    expect(clientSource).not.toContain('const FIELD_OPTIONS');
  });

  it('requires team selection before the name dropdown can choose an agent', () => {
    expect(clientSource).toContain('availableAgentsForTeam');
    expect(clientSource).toContain('!selectedTeam');
    expect(clientSource).toContain('Pilih Team terlebih dahulu');
  });

  it('maps guided selections back to existing access_group_items field_name values', () => {
    expect(clientSource).toContain("fieldName = 'tim'");
    expect(clientSource).toContain("fieldName = 'service_type'");
    expect(clientSource).toContain("fieldName = 'peserta_id'");
    expect(clientSource).toContain('fieldValue = selectedAgentId');
  });
});
