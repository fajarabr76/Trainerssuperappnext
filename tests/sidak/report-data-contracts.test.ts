import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const servicePath = resolve(process.cwd(), 'app/(main)/qa-analyzer/services/qaService.server.ts');
const serviceContent = readFileSync(servicePath, 'utf8');

describe('QA Data Report Contract', () => {
  it('locks the filtering logic for Data Report in getDataReportRows', () => {
    // 1. Must exclude phantom padding for ALL modes in the table
    expect(serviceContent).toContain("query = query.eq('is_phantom_padding', false);");

    // 2. Must filter for rows having both ketidaksesuaian AND sebaiknya
    expect(serviceContent).toContain(".not('ketidaksesuaian', 'is', null)");
    expect(serviceContent).toContain(".not('sebaiknya', 'is', null)");
    expect(serviceContent).toContain(".neq('ketidaksesuaian', '')");
    expect(serviceContent).toContain(".neq('sebaiknya', '')");
  });
});
