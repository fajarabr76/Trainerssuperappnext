import { describe, expect, it } from 'vitest';

import { annotateImportRowDuplicates } from '../../app/(main)/qa-analyzer/input/importDuplicateRows';

describe('annotateImportRowDuplicates', () => {
  it('marks both duplicate rows even when the first row already has another validation error', () => {
    const rows = [
      {
        rowNum: 2,
        no_tiket: 'TK-001',
        indicator_id: 'ind-1',
        errors: ['Nilai "9" tidak valid (harus 0-3)'],
      },
      {
        rowNum: 3,
        no_tiket: ' tk-001 ',
        indicator_id: 'ind-1',
        errors: [],
      },
    ];

    annotateImportRowDuplicates(rows);

    expect(rows[0].errors).toContain('Duplicate parameter dengan baris 3');
    expect(rows[1].errors).toContain('Duplicate parameter dengan baris 2');
  });
});
