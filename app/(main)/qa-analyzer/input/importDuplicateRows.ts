type ImportDuplicateRow = {
  rowNum: number;
  no_tiket: string;
  indicator_id: string | null;
  errors: string[];
};

export function annotateImportRowDuplicates<T extends ImportDuplicateRow>(rows: T[]): T[] {
  const seenRows = new Map<string, T>();

  for (const row of rows) {
    if (!row.indicator_id) continue;

    const normalizedTicket = row.no_tiket.trim();
    if (!normalizedTicket) continue;

    const key = `${normalizedTicket.toLowerCase()}::${row.indicator_id}`;
    const firstRow = seenRows.get(key);
    if (!firstRow) {
      seenRows.set(key, row);
      continue;
    }

    const firstRowError = `Duplicate parameter dengan baris ${row.rowNum}`;
    if (!firstRow.errors.includes(firstRowError)) {
      firstRow.errors.push(firstRowError);
    }

    const currentRowError = `Duplicate parameter dengan baris ${firstRow.rowNum}`;
    if (!row.errors.includes(currentRowError)) {
      row.errors.push(currentRowError);
    }
  }

  return rows;
}
