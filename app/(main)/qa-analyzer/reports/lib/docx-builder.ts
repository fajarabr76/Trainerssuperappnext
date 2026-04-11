import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import type { DashboardSummary } from '../../lib/qa-types';
import type { ServiceType } from '../../lib/qa-types';
import { SERVICE_LABELS } from '../../lib/qa-types';

const MAX_TABLE_ROWS = 400;

function stripBase64Prefix(s: string): string {
  const m = s.match(/^data:image\/\w+;base64,(.+)$/);
  return m ? m[1]! : s;
}

function pngFromBase64(base64: string): Buffer {
  return Buffer.from(stripBase64Prefix(base64), 'base64');
}

function cellPara(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, size: 18 })],
  });
}

export async function buildServiceReportDocx(input: {
  title: string;
  serviceType: ServiceType;
  periodLabel: string;
  summary: DashboardSummary;
  aiNarrative: string;
  paretoPngBase64: string | null;
  donutPngBase64: string | null;
  detailRows: Array<{
    no_tiket: string | null;
    agen: string;
    parameter: string;
    nilai: number;
    ketidaksesuaian: string | null;
    sebaiknya: string | null;
  }>;
}): Promise<Buffer> {
  const svcLabel = SERVICE_LABELS[input.serviceType] || input.serviceType;
  const rows = input.detailRows.slice(0, MAX_TABLE_ROWS);
  const truncated = input.detailRows.length > MAX_TABLE_ROWS;

  const headerRow = new TableRow({
    children: [
      new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [cellPara('No. Tiket', true)] }),
      new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, children: [cellPara('Agen', true)] }),
      new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, children: [cellPara('Parameter', true)] }),
      new TableCell({ width: { size: 6, type: WidthType.PERCENTAGE }, children: [cellPara('Nilai', true)] }),
      new TableCell({ width: { size: 26, type: WidthType.PERCENTAGE }, children: [cellPara('Ketidaksesuaian', true)] }),
      new TableCell({ width: { size: 26, type: WidthType.PERCENTAGE }, children: [cellPara('Rekomendasi', true)] }),
    ],
  });

  const dataRows = rows.map(
    (r) =>
      new TableRow({
        children: [
          new TableCell({ children: [cellPara(r.no_tiket || '—')] }),
          new TableCell({ children: [cellPara(r.agen)] }),
          new TableCell({ children: [cellPara(r.parameter)] }),
          new TableCell({ children: [cellPara(String(r.nilai))] }),
          new TableCell({ children: [cellPara(r.ketidaksesuaian || '—')] }),
          new TableCell({ children: [cellPara(r.sebaiknya || '—')] }),
        ],
      })
  );

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      text: input.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Layanan: ${svcLabel}  •  Periode: ${input.periodLabel}`, size: 22, italics: true }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    new Paragraph({
      text: 'Ringkasan eksekutif',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Total temuan: ${input.summary.totalDefects}  |  Rata-rata temuan per audit: ${input.summary.avgDefectsPerAudit.toFixed(2)}  |  Zero-error rate: ${input.summary.zeroErrorRate.toFixed(1)}%  |  Compliance rate: ${input.summary.complianceRate.toFixed(1)}%  |  Skor rata-rata agen: ${input.summary.avgAgentScore.toFixed(1)}`,
          size: 20,
        }),
      ],
      spacing: { after: 200 },
    }),
  ];

  if (input.paretoPngBase64) {
    children.push(
      new Paragraph({
        text: 'Pareto — parameter bermasalah',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 120 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: 'png',
            data: pngFromBase64(input.paretoPngBase64),
            transformation: { width: 520, height: 300 },
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  if (input.donutPngBase64) {
    children.push(
      new Paragraph({
        text: 'Distribusi Fatal vs Non-Fatal',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 120 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: 'png',
            data: pngFromBase64(input.donutPngBase64),
            transformation: { width: 400, height: 280 },
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  children.push(
    new Paragraph({
      text: 'Analisis AI',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: input.aiNarrative, size: 20 })],
      spacing: { after: 240 },
    }),
    new Paragraph({
      text: 'Detail temuan',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 120, after: 120 },
    })
  );

  if (truncated) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `(Menampilkan ${MAX_TABLE_ROWS} baris pertama dari ${input.detailRows.length} temuan.)`,
            italics: true,
            size: 18,
          }),
        ],
        spacing: { after: 120 },
      })
    );
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    })
  );

  const doc = new Document({
    sections: [{ children }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function buildIndividualReportDocx(input: {
  title: string;
  agentName: string;
  team: string;
  batch: string;
  role: string;
  periodLabel: string;
  avgScore: number;
  totalFindings: number;
  sessionEstimate: number;
  aiNarrative: string;
  trendPngBase64: string | null;
  detailRows: Array<{
    no_tiket: string | null;
    parameter: string;
    nilai: number;
    periode: string;
    ketidaksesuaian: string | null;
    sebaiknya: string | null;
  }>;
}): Promise<Buffer> {
  const rows = input.detailRows.slice(0, MAX_TABLE_ROWS);
  const truncated = input.detailRows.length > MAX_TABLE_ROWS;

  const headerRow = new TableRow({
    children: [
      new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, children: [cellPara('No. Tiket', true)] }),
      new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, children: [cellPara('Periode', true)] }),
      new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [cellPara('Parameter', true)] }),
      new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, children: [cellPara('Nilai', true)] }),
      new TableCell({ width: { size: 23, type: WidthType.PERCENTAGE }, children: [cellPara('Ketidaksesuaian', true)] }),
      new TableCell({ width: { size: 23, type: WidthType.PERCENTAGE }, children: [cellPara('Rekomendasi', true)] }),
    ],
  });

  const dataRows = rows.map(
    (r) =>
      new TableRow({
        children: [
          new TableCell({ children: [cellPara(r.no_tiket || '—')] }),
          new TableCell({ children: [cellPara(r.periode)] }),
          new TableCell({ children: [cellPara(r.parameter)] }),
          new TableCell({ children: [cellPara(String(r.nilai))] }),
          new TableCell({ children: [cellPara(r.ketidaksesuaian || '—')] }),
          new TableCell({ children: [cellPara(r.sebaiknya || '—')] }),
        ],
      })
  );

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      text: input.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Agen: ${input.agentName}  •  Tim: ${input.team}  •  Batch: ${input.batch}  •  Jabatan: ${input.role}`,
          size: 22,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Periode laporan: ${input.periodLabel}`, size: 22, italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    new Paragraph({
      text: 'Ringkasan performa',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Skor QA rata-rata (per bulan, bobot temuan): ${input.avgScore.toFixed(1)}  |  Total temuan: ${input.totalFindings}  |  Perkiraan sesi (unik no. tiket): ${input.sessionEstimate}`,
          size: 20,
        }),
      ],
      spacing: { after: 200 },
    }),
  ];

  if (input.trendPngBase64) {
    children.push(
      new Paragraph({
        text: 'Tren skor bulanan',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 120 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: 'png',
            data: pngFromBase64(input.trendPngBase64),
            transformation: { width: 520, height: 300 },
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  children.push(
    new Paragraph({
      text: 'Insight & coaching (AI)',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: input.aiNarrative, size: 20 })],
      spacing: { after: 240 },
    }),
    new Paragraph({
      text: 'Detail temuan',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 120, after: 120 },
    })
  );

  if (truncated) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `(Menampilkan ${MAX_TABLE_ROWS} baris pertama dari ${input.detailRows.length} temuan.)`,
            italics: true,
            size: 18,
          }),
        ],
        spacing: { after: 120 },
      })
    );
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    })
  );

  const doc = new Document({
    sections: [{ children }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
