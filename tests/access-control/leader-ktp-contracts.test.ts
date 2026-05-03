import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const profilerIndexSource = readFileSync('app/(main)/profiler/page.tsx', 'utf8');
const profilerTableSource = readFileSync('app/(main)/profiler/table/page.tsx', 'utf8');
const profilerAnalyticsSource = readFileSync('app/(main)/profiler/analytics/page.tsx', 'utf8');
const profilerExportSource = readFileSync('app/(main)/profiler/export/page.tsx', 'utf8');
const profilerSlidesSource = readFileSync('app/(main)/profiler/slides/page.tsx', 'utf8');
const profilerActionsSource = readFileSync('app/(main)/profiler/actions.ts', 'utf8');
const profilerServiceSource = readFileSync('app/(main)/profiler/services/profilerService.server.ts', 'utf8');

describe('Leader KTP access enforcement contracts', () => {
  it('guards the main KTP surfaces with ktp approval before loading scoped data', () => {
    for (const source of [
      profilerIndexSource,
      profilerTableSource,
      profilerAnalyticsSource,
      profilerExportSource,
      profilerSlidesSource,
    ]) {
      expect(source).toContain("getAllowedParticipantIdsForLeader(user.id, 'ktp'");
      expect(source).toContain('LeaderAccessStatus');
      expect(source).toContain('participantAccess');
    }
  });

  it('passes leader participant IDs into KTP list/count/data fetches', () => {
    expect(profilerIndexSource).toContain('profilerServiceServer.getFolders(null, participantIds)');
    expect(profilerIndexSource).toContain('profilerServiceServer.getFolderCounts(null, participantIds)');
    expect(profilerTableSource).toContain('profilerServiceServer.getByBatch(batchName, undefined, participantIds)');
    expect(profilerExportSource).toContain('profilerServiceServer.getByBatch(batchName, undefined, participantIds)');
    expect(profilerSlidesSource).toContain('profilerServiceServer.getByBatch(batchName, undefined, participantIds)');
  });

  it('filters server actions that can return KTP participant rows for leaders using participant IDs', () => {
    for (const functionName of ['getOriginalPeserta', 'getGlobalPesertaPool', 'getPesertaByBatch']) {
      const block = extractFunction(profilerActionsSource, functionName);
      expect(block).toContain("getAllowedParticipantIdsForLeader(user.id, 'ktp'");
      expect(block).toContain('participantAccess');
      expect(block).toContain('participantIds');
    }
  });

  it('keeps profiler service scope filtering fail-closed with participant IDs support', () => {
    expect(profilerServiceSource).toContain('filterPesertaRows');
    expect(profilerServiceSource).toContain('participantIds');
    expect(profilerServiceSource).toContain('if (participantIds !== undefined && participantIds !== null)');
    expect(profilerServiceSource).toContain(".in('id', participantIds)");
  });
});

function extractFunction(source: string, functionName: string) {
  const start = source.indexOf(`export async function ${functionName}`);
  expect(start, `missing function ${functionName}`).toBeGreaterThanOrEqual(0);

  const nextExport = source.indexOf('\nexport async function ', start + 1);
  return source.slice(start, nextExport === -1 ? undefined : nextExport);
}