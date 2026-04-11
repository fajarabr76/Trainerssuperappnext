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

/** AI narrative parsing helper to turn numbered lists into headings + bullets */
function renderParsedNarrative(narration: string): Paragraph[] {
  const result: Paragraph[] = [];
  // Split by numbered sections like "1. ", "2. ", etc.
  const sections = narration.split(/\n?(?=\d\.\s)/g);

  sections.forEach((sec) => {
    const lines = sec.trim().split('\n');
    if (lines.length === 0) return;

    const firstLine = lines[0].trim();
    // If it looks like a heading (e.g., "1. STATUS EXECUTIVE SUMMARY")
    if (/^\d\.\s/.test(firstLine)) {
      result.push(
        new Paragraph({
          text: firstLine.toUpperCase(),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      );
      
      // The rest of the segment is the body
      lines.slice(1).forEach(line => {
        const text = line.trim();
        if (!text) return;
        
        result.push(
          new Paragraph({
            children: [
              new TextRun({ 
                text: text.startsWith('-') ? `• ${text.substring(1).trim()}` : text,
                size: 20
              })
            ],
            indent: text.startsWith('-') ? { left: 720 } : undefined,
            spacing: { after: 120 },
          })
        );
      });
    } else {
      // Normal paragraph
      lines.forEach(line => {
        const text = line.trim();
        if (!text) return;
        result.push(
          new Paragraph({
            children: [new TextRun({ text, size: 20 })],
            spacing: { after: 120 },
          })
        );
      });
    }
  });

  return result;
}

function getStatusIndicator(value: number, type: 'compliance' | 'zero'): TextRun {
  let symbol = '🔴';
  let label = 'Perlu Perhatian';
  let color = 'FF0000';

  if (type === 'compliance') {
    if (value >= 95) { symbol = '🟢'; label = 'Sangat Baik'; color = '008000'; }
    else if (value >= 90) { symbol = '🟡'; label = 'Cukup'; color = '8B8000'; }
  } else {
    // Zero error rate
    if (value >= 50) { symbol = '🟢'; label = 'Bagus'; color = '008000'; }
    else if (value >= 30) { symbol = '🟡'; label = 'Waspada'; color = '8B8000'; }
  }

  return new TextRun({ text: `${symbol} ${label}`, color, bold: true, size: 20 });
}

function getDirectionIcon(dir: 'up' | 'down' | 'flat'): string {
  if (dir === 'up') return '↑';
  if (dir === 'down') return '↓';
  return '→';
}

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
  paramTrackerRows: Array<{
    parameter: string;
    current: number;
    previous: number;
    delta: number;
    direction: 'up' | 'down' | 'flat';
  }>;
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
      text: '1. Ringkasan Eksekutif',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [cellPara('Metrik Utama', true)] }),
            new TableCell({ children: [cellPara('Nilai', true)] }),
            new TableCell({ children: [cellPara('Status', true)] }),
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [cellPara('Compliance Rate')] }),
            new TableCell({ children: [cellPara(`${input.summary.complianceRate.toFixed(1)}%`)] }),
            new TableCell({ children: [new Paragraph({ children: [getStatusIndicator(input.summary.complianceRate, 'compliance')] })] }),
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [cellPara('Zero-Error Rate')] }),
            new TableCell({ children: [cellPara(`${input.summary.zeroErrorRate.toFixed(1)}%`)] }),
            new TableCell({ children: [new Paragraph({ children: [getStatusIndicator(input.summary.zeroErrorRate, 'zero')] })] }),
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [cellPara('Avg. Defects/Audit')] }),
            new TableCell({ children: [cellPara(input.summary.avgDefectsPerAudit.toFixed(2))] }),
            new TableCell({ children: [cellPara('Target: < 0.5')] }),
          ]
        }),
      ]
    }),
    new Paragraph({ spacing: { after: 200 } }),
    
    new Paragraph({
      text: '2. Path to Zero Tracker',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [cellPara('Parameter', true)] }),
            new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [cellPara('Start Range', true)] }),
            new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [cellPara('End Range', true)] }),
            new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [cellPara('Δ', true)] }),
            new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [cellPara('Arah', true)] }),
          ]
        }),
        ...input.paramTrackerRows.map(r => new TableRow({
          children: [
            new TableCell({ children: [cellPara(r.parameter)] }),
            new TableCell({ children: [cellPara(String(r.previous))] }),
            new TableCell({ children: [cellPara(String(r.current))] }),
            new TableCell({ children: [cellPara(`${r.delta > 0 ? '+' : ''}${r.delta}`)] }),
            new TableCell({ 
              children: [
                new Paragraph({ 
                  children: [
                    new TextRun({ 
                      text: `${getDirectionIcon(r.direction)} ${r.direction === 'up' ? 'Memburuk' : r.direction === 'down' ? 'Membaik' : 'Stagnan'}`,
                      color: r.direction === 'up' ? 'FF0000' : r.direction === 'down' ? '008000' : '000000',
                      bold: true,
                      size: 18
                    })
                  ]
                })
              ]
            }),
          ]
        }))
      ]
    }),
  ];

  if (input.paretoPngBase64) {
    children.push(
      new Paragraph({
        text: '3. Zoom-in Parameter Memburuk (Pareto)',
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
      text: '4. Interpretasi & Analisis (AI Narration)',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
    }),
    ...renderParsedNarrative(input.aiNarrative),
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
  zeroParamCount: number;
  totalParamCount: number;
  paramMapRows: Array<{ parameter: string; status: 'dipertahankan' | 'baru' | 'regresi' | 'aktif' }>;
  regressionParams: string[];
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
      text: '1. Profil & Status Path to Zero Personal',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Status Zero: ${input.zeroParamCount} dari ${input.totalParamCount} parameter mencapai ZERO.`,
          bold: true,
          size: 22,
          color: input.zeroParamCount === input.totalParamCount ? '008000' : '000000',
        }),
      ],
      spacing: { after: 120 },
    }),
    ...(input.regressionParams.length > 0 ? [
      new Paragraph({
        children: [
          new TextRun({
            text: `⚠️ ALARM REGRESI: Terdeteksi temuan baru pada parameter yang sebelumnya sudah bersih: ${input.regressionParams.join(', ')}`,
            bold: true,
            color: 'FF0000',
            size: 20
          })
        ],
        spacing: { after: 200 }
      })
    ] : []),
    new Paragraph({
      children: [
        new TextRun({
          text: `Skor QA rata-rata: ${input.avgScore.toFixed(1)}  |  Total temuan: ${input.totalFindings}  |  Perkiraan sesi: ${input.sessionEstimate}`,
          size: 20,
        }),
      ],
      spacing: { after: 200 },
    }),

    new Paragraph({
      text: '2. Peta Parameter Personal',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [cellPara('Parameter', true)] }),
            new TableCell({ children: [cellPara('Status Path to Zero', true)] }),
          ]
        }),
        ...input.paramMapRows.map(r => {
          let label = 'Aktif (Ada Temuan)';
          let color = '000000';
          if (r.status === 'dipertahankan') { label = 'ZERO (Dipertahankan) ✅'; color = '008000'; }
          else if (r.status === 'baru') { label = 'Baru Capai ZERO 🎯'; color = '008000'; }
          else if (r.status === 'regresi') { label = 'REGRESI ⚠️'; color = 'FF0000'; }

          return new TableRow({
            children: [
              new TableCell({ children: [cellPara(r.parameter)] }),
              new TableCell({ 
                children: [
                  new Paragraph({ 
                    children: [new TextRun({ text: label, color, bold: r.status !== 'aktif', size: 18 })] 
                  })
                ] 
              }),
            ]
          });
        })
      ]
    }),
    new Paragraph({ spacing: { after: 300 } }),
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
      text: '3. Interpretasi & Analisis (AI Narration)',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
    }),
    ...renderParsedNarrative(input.aiNarrative),
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
