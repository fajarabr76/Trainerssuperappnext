import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const servicePath = resolve(process.cwd(), 'app/(main)/qa-analyzer/services/qaService.server.ts');
const serviceContent = readFileSync(servicePath, 'utf8');

describe('resolveFindingIndicatorMeta null guard contract', () => {
  it('uses optional chaining for joinedMeta.category in the early return guard', () => {
    expect(serviceContent).toContain(
      "if (joinedMeta?.name !== 'Unknown' && joinedMeta?.category) {"
    );
  });

  it('does not access joinedMeta.category without optional chaining', () => {
    expect(serviceContent).not.toContain("if (joinedMeta?.name !== 'Unknown' && joinedMeta.category) {");
  });
});
