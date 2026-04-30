import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const servicePath = resolve(process.cwd(), 'app/(main)/qa-analyzer/services/qaService.server.ts');
const serviceContent = readFileSync(servicePath, 'utf8');

describe('QA Data Report Contract', () => {
  it('locks the filtering logic for Individual vs Service mode in getDataReportRows', () => {
    // We expect a specific guard that relaxes filters ONLY if pesertaId is present.
    // We use a more robust search since nested braces can confuse simple regex.
    const startPattern = 'if (!filter.pesertaId) {';
    const startIndex = serviceContent.indexOf(startPattern);
    expect(startIndex, 'Should find the beginning of Service Mode guard').toBeGreaterThan(-1);

    // Get a chunk of code after the start pattern to verify contents
    const logicBlock = serviceContent.substring(startIndex, startIndex + 500);

    // Service Mode MUST exclude phantom rows
    expect(logicBlock).toContain("query = query.eq('is_phantom_padding', false);");

    // Service Mode MUST be findings-only (score < 3 OR has notes)
    expect(logicBlock).toContain("query = query.or('nilai.lt.3,ketidaksesuaian.not.is.null,sebaiknya.not.is.null');");
  });
});
