'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileSpreadsheet, FileText, Presentation, FileDown,
  Download, ChevronDown, Folder, Check, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Peserta, ProfilerYear, ProfilerFolder, Jabatan, labelTim, labelJabatan,
  hitungMasaDinas, hitungUsia, formatTanggal
} from '../../lib/profiler-types';

const timTheme = (tim: string) => {
  const t = tim?.toLowerCase();
  if (t === 'telepon') return { accent: '007AFF', accentRgb: '#007AFF', light: '#EBF4FF' };
  if (t === 'chat')    return { accent: '34C759', accentRgb: '#34C759', light: '#EDFAF1' };
  if (t === 'email')   return { accent: 'FF9500', accentRgb: '#FF9500', light: '#FFF6E8' };
  return { accent: 'AF52DE', accentRgb: '#AF52DE', light: '#F5EEFF' };
};

interface ProfilerExportClientProps {
  initialPeserta: Peserta[];
  initialYears: ProfilerYear[];
  initialFolders: ProfilerFolder[];
  batchName: string;
}

export default function ProfilerExportClient({
  initialPeserta,
  initialYears,
  initialFolders,
  batchName
}: ProfilerExportClientProps) {
  const router = useRouter();

  const [selectedBatch, setSelectedBatch] = useState(batchName);
  const [showPicker,    setShowPicker]    = useState(false);
  const [peserta,       setPeserta]       = useState<Peserta[]>(initialPeserta);
  const [loading,       setLoading]       = useState(false);
  const [generating,    setGenerating]    = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // If user selects a new batch, reload the page with new search params or fetch data.
  // We'll follow the router.push pattern for now to keep it consistent with other SSR pages.
  const handleBatchChange = (newBatch: string) => {
    setSelectedBatch(newBatch);
    setShowPicker(false);
    router.push(`/profiler/export?batch=${encodeURIComponent(newBatch)}`);
  };

  const buildRows = (list: Peserta[]) =>
    list.map((p, i) => ({
      'No': i + 1, 'Nama': p.nama || '', 'Tim': p.tim || '',
      'Jabatan': labelJabatan[p.jabatan] || p.jabatan || '',
      'NIP OJK': p.nip_ojk || '', 'Email OJK': p.email_ojk || '',
      'No. Telepon': p.no_telepon || '',
      'No. Telepon Darurat': p.no_telepon_darurat || '',
      'Nama Kontak Darurat': p.nama_kontak_darurat || '',
      'Hubungan Kontak Darurat': p.hubungan_kontak_darurat || '',
      'Bergabung': p.bergabung_date || '',
      'Masa Dinas': p.bergabung_date ? hitungMasaDinas(p.bergabung_date) : '',
      'Jenis Kelamin': p.jenis_kelamin || '', 'Agama': p.agama || '',
      'Tanggal Lahir': p.tgl_lahir || '',
      'Usia': p.tgl_lahir ? hitungUsia(p.tgl_lahir) : '',
      'Status Perkawinan': p.status_perkawinan || '', 'Pendidikan': p.pendidikan || '',
      'Lembaga': p.nama_lembaga || '', 'Jurusan': p.jurusan || '',
      'No. KTP': p.no_ktp || '', 'No. NPWP': p.no_npwp || '',
      'No. Rekening': p.nomor_rekening || '', 'Bank': p.nama_bank || '',
      'Status Hunian': p.status_tempat_tinggal || '',
      'Alamat Tinggal': p.alamat_tinggal || '',
      'Previous Company': p.previous_company || '', 'Pengalaman CC': p.pengalaman_cc || '',
      'Catatan Tambahan': p.catatan_tambahan || '', 'Keterangan': p.keterangan || '',
    }));

  const downloadExcel = () => {
    setGenerating('excel');
    try {
      const ws = XLSX.utils.json_to_sheet(buildRows(peserta));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Peserta');
      XLSX.writeFile(wb, `${selectedBatch}_peserta.xlsx`);
    } finally { setGenerating(null); }
  };

  const downloadCSV = () => {
    setGenerating('csv');
    try {
      const ws  = XLSX.utils.json_to_sheet(buildRows(peserta));
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `${selectedBatch}_peserta.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally { setGenerating(null); }
  };

  const downloadPPTX = async () => {
    setGenerating('pptx');
    try {
      // @ts-ignore
      const pptxgen = (await import('pptxgenjs')).default || (await import('pptxgenjs'));
      // @ts-ignore
      const prs = new pptxgen();
      
      const isLandscape = orientation === 'landscape';
      if (isLandscape) {
        prs.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches
      } else {
        prs.defineLayout({ name: 'A4_PORTRAIT', width: 8.27, height: 11.69 });
        prs.layout = 'A4_PORTRAIT';
      }

      for (const p of peserta) {
        const slide = prs.addSlide();
        const theme = timTheme(p.tim);
        const accentColor = theme.accent;

        if (isLandscape) {
          // Top Accent Bar
          slide.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.04, fill: { color: accentColor } });

          // Left Sidebar (30% = 3.0 inches)
          const sidebarW = 3.0;
          slide.addShape(prs.ShapeType.rect, { x: 0, y: 0.04, w: sidebarW, h: 5.585, fill: { color: 'F9FAFB' } });
          slide.addShape(prs.ShapeType.rect, { x: sidebarW, y: 0.04, w: 0.01, h: 5.585, fill: { color: 'F3F4F6' } });

          // Profile Photo
          if (p.foto_url) {
            try {
              slide.addImage({ path: p.foto_url, x: 0.75, y: 0.35, w: 1.5, h: 1.5, rounding: true });
            } catch (e) {
              slide.addShape(prs.ShapeType.rect, { x: 0.75, y: 0.35, w: 1.5, h: 1.5, fill: { color: theme.light.replace('#', '') } });
              slide.addText(p.nama?.charAt(0) || '?', { x: 0.75, y: 0.35, w: 1.5, h: 1.5, align: 'center', valign: 'middle', fontSize: 40, bold: true, color: accentColor });
            }
          } else {
            slide.addShape(prs.ShapeType.rect, { x: 0.75, y: 0.35, w: 1.5, h: 1.5, fill: { color: theme.light.replace('#', '') } });
            slide.addText(p.nama?.charAt(0) || '?', { x: 0.75, y: 0.35, w: 1.5, h: 1.5, align: 'center', valign: 'middle', fontSize: 40, bold: true, color: accentColor });
          }

          // Name & Jabatan
          slide.addText(p.nama || '-', { x: 0.2, y: 1.95, w: 2.6, h: 0.4, align: 'center', fontSize: 16, bold: true, color: '111827' });
          slide.addText(labelJabatan[p.jabatan] || p.jabatan || '-', { x: 0.2, y: 2.3, w: 2.6, h: 0.2, align: 'center', fontSize: 10, bold: true, color: accentColor });
          
          // Team Badge
          slide.addText(labelTim[p.tim] || p.tim || '-', { x: 0.8, y: 2.6, w: 1.4, h: 0.25, fontSize: 8, bold: true, color: accentColor, align: 'center', fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB', pt: 1 } });

          // Masa Dinas Card
          if (p.bergabung_date) {
            slide.addShape(prs.ShapeType.rect, { x: 0.4, y: 3.05, w: 2.2, h: 0.8, fill: { color: 'FFFFFF' }, line: { color: 'F3F4F6', pt: 1 } });
            slide.addText('MASA DINAS', { x: 0.4, y: 3.1, w: 2.2, h: 0.15, align: 'center', fontSize: 8, bold: true, color: '9CA3AF' });
            slide.addText(hitungMasaDinas(p.bergabung_date), { x: 0.4, y: 3.25, w: 2.2, h: 0.3, align: 'center', fontSize: 14, bold: true, color: '111827' });
            slide.addText(`sejak ${formatTanggal(p.bergabung_date)}`, { x: 0.4, y: 3.6, w: 2.2, h: 0.15, align: 'center', fontSize: 9, color: '9CA3AF' });
          }

          // Sidebar Stats
          const statsY = 4.05;
          const stats = [
            ['NIP OJK', p.nip_ojk],
            ['Kelamin', p.jenis_kelamin],
            ['Agama', p.agama],
            ['Usia', p.tgl_lahir ? `${hitungUsia(p.tgl_lahir)} Tahun` : null],
            ['Tgl Lahir', p.tgl_lahir ? formatTanggal(p.tgl_lahir) : null],
            ['Status', p.status_perkawinan],
          ].filter(([, v]) => v);

          stats.forEach(([label, value], i) => {
            const y = statsY + (i * 0.22);
            slide.addText(label as string, { x: 0.4, y: y, w: 1.0, h: 0.2, fontSize: 8, bold: true, color: '9CA3AF' });
            slide.addText(value as string, { x: 1.4, y: y, w: 1.2, h: 0.2, fontSize: 10, bold: true, color: '374151', align: 'right' });
          });

          // Right Content (70% = 7.0 inches)
          const rightX = 3.3;
          const rightW = 6.4;
          const colW = (rightW - 0.4) / 3;
          const gap = 0.2;

          const sectionHdr = (title: string, y: number, isSensitive = false) => {
            slide.addText(title, { x: rightX, y: y, w: 2.0, h: 0.2, fontSize: 9, bold: true, color: isSensitive ? 'FCA5A5' : 'D1D5DB' });
            slide.addShape(prs.ShapeType.line, { x: rightX + 1.2, y: y + 0.1, w: rightW - 1.2, h: 0, line: { color: isSensitive ? 'FEE2E2' : 'F3F4F6', pt: 1 } });
          };

          const fieldCell = (label: string, value: string | null | undefined, x: number, y: number, w: number) => {
            slide.addText(label, { x, y, w, h: 0.15, fontSize: 8, bold: true, color: '9CA3AF' });
            slide.addText(value || '-', { x, y: y + 0.18, w, h: 0.2, fontSize: 11, bold: true, color: '111827' });
          };

          sectionHdr('DATA PEKERJAAN', 0.35);
          fieldCell('Email OJK', p.email_ojk, rightX, 0.65, colW);
          fieldCell('No. Telepon', p.no_telepon, rightX + colW + gap, 0.65, colW);
          fieldCell('Bergabung', p.bergabung_date ? formatTanggal(p.bergabung_date) : null, rightX + (colW + gap) * 2, 0.65, colW);
          fieldCell('Telp. Darurat', p.no_telepon_darurat, rightX, 1.05, colW);
          fieldCell('Kontak Darurat', p.nama_kontak_darurat, rightX + colW + gap, 1.05, colW);
          fieldCell('Hubungan', p.hubungan_kontak_darurat, rightX + (colW + gap) * 2, 1.05, colW);

          sectionHdr('LATAR BELAKANG', 1.75);
          fieldCell('Pendidikan', p.pendidikan, rightX, 2.05, colW);
          fieldCell('Lembaga', p.nama_lembaga, rightX + colW + gap, 2.05, colW);
          fieldCell('Jurusan', p.jurusan, rightX + (colW + gap) * 2, 2.05, colW);
          fieldCell('Prev. Company', p.previous_company, rightX, 2.45, colW);
          fieldCell('Pengalaman CC', p.pengalaman_cc, rightX + colW + gap, 2.45, colW);

          sectionHdr('🔒 DATA SENSITIF', 3.15, true);
          fieldCell('No. KTP', p.no_ktp, rightX, 3.45, colW);
          fieldCell('No. NPWP', p.no_npwp, rightX + colW + gap, 3.45, colW);
          fieldCell('No. Rekening', p.nomor_rekening ? `${p.nomor_rekening}${p.nama_bank ? ` · ${p.nama_bank}` : ''}` : null, rightX + (colW + gap) * 2, 3.45, colW);
          fieldCell('Status Hunian', p.status_tempat_tinggal, rightX, 3.85, colW);
          fieldCell('Alamat Tinggal', p.alamat_tinggal, rightX + colW + gap, 3.85, colW * 2 + gap);

          const noteY = 4.5;
          const noteW = (rightW - 0.2) / 2;
          if (p.catatan_tambahan) {
            slide.addShape(prs.ShapeType.rect, { x: rightX, y: noteY, w: noteW, h: 0.8, fill: { color: 'FFFBEB' }, line: { color: 'FEF3C7', pt: 1 } });
            slide.addText('⭐ CATATAN', { x: rightX + 0.1, y: noteY + 0.1, w: noteW - 0.2, h: 0.15, fontSize: 8, color: 'D97706', bold: true });
            slide.addText(p.catatan_tambahan, { x: rightX + 0.1, y: noteY + 0.25, w: noteW - 0.2, h: 0.5, fontSize: 10, color: '78350F', wrap: true });
          }
          if (p.keterangan) {
            const noteX = p.catatan_tambahan ? rightX + noteW + 0.2 : rightX;
            slide.addShape(prs.ShapeType.rect, { x: noteX, y: noteY, w: noteW, h: 0.8, fill: { color: 'F9FAFB' }, line: { color: 'F3F4F6', pt: 1 } });
            slide.addText('KETERANGAN', { x: noteX + 0.1, y: noteY + 0.1, w: noteW - 0.2, h: 0.15, fontSize: 8, color: '9CA3AF', bold: true });
            slide.addText(p.keterangan, { x: noteX + 0.1, y: noteY + 0.25, w: noteW - 0.2, h: 0.5, fontSize: 10, color: '4B5563', wrap: true });
          }

        } else {
          // PORTRAIT LAYOUT
          // Top Accent Bar
          slide.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.04, fill: { color: accentColor } });

          // Header Section
          if (p.foto_url) {
            try {
              slide.addImage({ path: p.foto_url, x: 0.5, y: 0.5, w: 1.5, h: 1.5, rounding: true });
            } catch (e) {
              slide.addShape(prs.ShapeType.rect, { x: 0.5, y: 0.5, w: 1.5, h: 1.5, fill: { color: theme.light.replace('#', '') } });
              slide.addText(p.nama?.charAt(0) || '?', { x: 0.5, y: 0.5, w: 1.5, h: 1.5, align: 'center', valign: 'middle', fontSize: 36, bold: true, color: accentColor });
            }
          } else {
            slide.addShape(prs.ShapeType.rect, { x: 0.5, y: 0.5, w: 1.5, h: 1.5, fill: { color: theme.light.replace('#', '') } });
            slide.addText(p.nama?.charAt(0) || '?', { x: 0.5, y: 0.5, w: 1.5, h: 1.5, align: 'center', valign: 'middle', fontSize: 36, bold: true, color: accentColor });
          }

          slide.addText(p.nama || '-', { x: 2.3, y: 0.6, w: 5.5, h: 0.4, fontSize: 24, bold: true, color: '111827' });
          slide.addText(labelJabatan[p.jabatan] || p.jabatan || '-', { x: 2.3, y: 1.0, w: 5.5, h: 0.2, fontSize: 12, bold: true, color: accentColor });
          slide.addText(labelTim[p.tim] || p.tim || '-', { x: 2.3, y: 1.3, w: 1.5, h: 0.3, fontSize: 10, bold: true, color: accentColor, align: 'center', fill: { color: 'FFFFFF' }, line: { color: 'E5E7EB', pt: 1 } });

          // Quick Stats
          const statW = 1.35;
          const statGap = 0.1;
          const statY = 2.4;
          
          const addStatBox = (x: number, label: string, val: string) => {
            slide.addShape(prs.ShapeType.rect, { x, y: statY, w: statW, h: 0.8, fill: { color: 'F9FAFB' }, line: { color: 'F3F4F6', pt: 1 } });
            slide.addText(label, { x, y: statY + 0.1, w: statW, h: 0.2, align: 'center', fontSize: 7, bold: true, color: '9CA3AF' });
            slide.addText(val, { x, y: statY + 0.35, w: statW, h: 0.3, align: 'center', fontSize: 11, bold: true, color: '111827' });
          };

          addStatBox(0.5, 'MASA DINAS', p.bergabung_date ? hitungMasaDinas(p.bergabung_date) : '-');
          addStatBox(0.5 + statW + statGap, 'USIA', p.tgl_lahir ? `${hitungUsia(p.tgl_lahir)} Thn` : '-');
          addStatBox(0.5 + (statW + statGap) * 2, 'TGL LAHIR', p.tgl_lahir ? formatTanggal(p.tgl_lahir) : '-');
          addStatBox(0.5 + (statW + statGap) * 3, 'AGAMA', p.agama || '-');
          addStatBox(0.5 + (statW + statGap) * 4, 'STATUS', p.status_perkawinan || '-');

          // Details
          const rightX = 0.5;
          const rightW = 7.27;
          const colW = (rightW - 0.4) / 2;
          const gap = 0.4;

          const sectionHdr = (title: string, y: number, isSensitive = false) => {
            slide.addText(title, { x: rightX, y: y, w: 2.0, h: 0.2, fontSize: 9, bold: true, color: isSensitive ? 'FCA5A5' : 'D1D5DB' });
            slide.addShape(prs.ShapeType.line, { x: rightX + 1.5, y: y + 0.1, w: rightW - 1.5, h: 0, line: { color: isSensitive ? 'FEE2E2' : 'F3F4F6', pt: 1 } });
          };

          const fieldCell = (label: string, value: string | null | undefined, x: number, y: number, w: number) => {
            slide.addText(label, { x, y, w, h: 0.15, fontSize: 8, bold: true, color: '9CA3AF' });
            slide.addText(value || '-', { x, y: y + 0.2, w, h: 0.2, fontSize: 11, bold: true, color: '111827' });
          };

          sectionHdr('DATA PEKERJAAN', 3.6);
          fieldCell('Email OJK', p.email_ojk, rightX, 3.9, colW);
          fieldCell('No. Telepon', p.no_telepon, rightX + colW + gap, 3.9, colW);
          fieldCell('Bergabung', p.bergabung_date ? formatTanggal(p.bergabung_date) : null, rightX, 4.4, colW);
          fieldCell('NIP OJK', p.nip_ojk, rightX + colW + gap, 4.4, colW);
          fieldCell('Kontak Darurat', p.nama_kontak_darurat, rightX, 4.9, colW);
          fieldCell('Telp. Darurat', p.no_telepon_darurat ? `${p.no_telepon_darurat} (${p.hubungan_kontak_darurat || '-'})` : null, rightX + colW + gap, 4.9, colW);

          sectionHdr('LATAR BELAKANG', 5.5);
          fieldCell('Pendidikan', p.pendidikan, rightX, 5.8, colW);
          fieldCell('Lembaga', p.nama_lembaga, rightX + colW + gap, 5.8, colW);
          fieldCell('Jurusan', p.jurusan, rightX, 6.3, colW);
          fieldCell('Prev. Company', p.previous_company, rightX + colW + gap, 6.3, colW);
          fieldCell('Pengalaman CC', p.pengalaman_cc, rightX, 6.8, colW);
          fieldCell('Kelamin', p.jenis_kelamin, rightX + colW + gap, 6.8, colW);

          sectionHdr('🔒 DATA SENSITIF', 7.4, true);
          fieldCell('No. KTP', p.no_ktp, rightX, 7.7, colW);
          fieldCell('No. NPWP', p.no_npwp, rightX + colW + gap, 7.7, colW);
          fieldCell('No. Rekening', p.nomor_rekening ? `${p.nomor_rekening}${p.nama_bank ? ` · ${p.nama_bank}` : ''}` : null, rightX, 8.2, colW);
          fieldCell('Status Hunian', p.status_tempat_tinggal, rightX + colW + gap, 8.2, colW);
          fieldCell('Alamat Tinggal', p.alamat_tinggal, rightX, 8.7, rightW);

          const noteY = 9.4;
          if (p.catatan_tambahan) {
            slide.addShape(prs.ShapeType.rect, { x: rightX, y: noteY, w: rightW, h: 0.8, fill: { color: 'FFFBEB' }, line: { color: 'FEF3C7', pt: 1 } });
            slide.addText('⭐ CATATAN', { x: rightX + 0.1, y: noteY + 0.1, w: rightW - 0.2, h: 0.15, fontSize: 8, color: 'D97706', bold: true });
            slide.addText(p.catatan_tambahan, { x: rightX + 0.1, y: noteY + 0.25, w: rightW - 0.2, h: 0.5, fontSize: 10, color: '78350F', wrap: true });
          }
          if (p.keterangan) {
            const kY = p.catatan_tambahan ? noteY + 0.9 : noteY;
            slide.addShape(prs.ShapeType.rect, { x: rightX, y: kY, w: rightW, h: 0.8, fill: { color: 'F9FAFB' }, line: { color: 'F3F4F6', pt: 1 } });
            slide.addText('KETERANGAN', { x: rightX + 0.1, y: kY + 0.1, w: rightW - 0.2, h: 0.15, fontSize: 8, color: '9CA3AF', bold: true });
            slide.addText(p.keterangan, { x: rightX + 0.1, y: kY + 0.25, w: rightW - 0.2, h: 0.5, fontSize: 10, color: '4B5563', wrap: true });
          }

          // Footer
          slide.addShape(prs.ShapeType.rect, { x: 0, y: 11.29, w: '100%', h: 0.4, fill: { color: 'F9FAFB' }, line: { type: 'none' } });
          slide.addShape(prs.ShapeType.ellipse, { x: 0.5, y: 11.45, w: 0.08, h: 0.08, fill: { color: 'D1D5DB' } });
          slide.addText('Otoritas Jasa Keuangan — Kontak OJK 157', { x: 0.7, y: 11.35, w: 5, h: 0.2, fontSize: 9, color: 'D1D5DB', bold: true });
          slide.addText(`${selectedBatch.toUpperCase()} · ${p.nama?.toUpperCase()}`, { x: 3.27, y: 11.35, w: 4.5, h: 0.2, fontSize: 9, color: 'D1D5DB', align: 'right' });
        }
      }
      await prs.writeFile({ fileName: `${selectedBatch}_peserta.pptx` });
    } catch (err: any) { alert('Gagal membuat PPTX: ' + err.message); }
    finally { setGenerating(null); }
  };

  const buildSlideHTML = (p: Peserta, batch: string, orient: 'landscape' | 'portrait') => {
    const theme = timTheme(p.tim);
    const fields = (items: Array<[string, string | null | undefined, number?]>) =>
      items.filter(([, v]) => v).map(([label, value, span]) =>
        `<div style="${span === 2 ? 'grid-column:span 2;' : ''}"><div><div style="font-size:8px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">${label}</div><div style="font-size:11px;font-weight:700;color:#111827;">${value || '-'}</div></div></div>`
      ).join('');
      
    if (orient === 'portrait') {
      return `
<div style="width:600px;height:848px;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#FFFFFF;box-sizing:border-box;overflow:hidden;">
  <div style="height:4px;background:#${theme.accent};flex-shrink:0;"></div>
  <div style="display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;padding:32px 40px;gap:24px;box-sizing:border-box;">
    
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:24px;flex-shrink:0;">
      ${p.foto_url 
        ? `<div style="width:112px;height:112px;border-radius:24px;overflow:hidden;box-shadow:0 6px 15px rgba(0,0,0,0.1);flex-shrink:0;"><img src="${p.foto_url}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;" /></div>` 
        : `<div style="width:112px;height:112px;border-radius:24px;background:#${theme.light.replace('#','')};display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:bold;color:#${theme.accent};flex-shrink:0;">${p.nama?.charAt(0) || '?'}</div>`
      }
      <div style="display:flex;flex-direction:column;">
        <div style="font-size:24px;font-weight:bold;color:#111827;line-height:1.2;">${p.nama || '-'}</div>
        <div style="font-size:12px;font-weight:700;color:#${theme.accent};margin-top:4px;text-transform:uppercase;letter-spacing:1px;">${labelJabatan[p.jabatan] || p.jabatan || '-'}</div>
        <div style="display:inline-block;margin-top:8px;font-size:10px;font-weight:700;color:#${theme.accent};background:#FFFFFF;border:1px solid #E5E7EB;border-radius:6px;padding:4px 12px;width:fit-content;">${labelTim[p.tim] || p.tim || '-'}</div>
      </div>
    </div>

    <!-- Quick Stats -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;flex-shrink:0;">
      <div style="background:#F9FAFB;border:1px solid #F3F4F6;border-radius:12px;padding:10px 4px;text-align:center;">
        <div style="font-size:8px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Masa Dinas</div>
        <div style="font-size:12px;font-weight:900;color:#111827;line-height:1;">${p.bergabung_date ? hitungMasaDinas(p.bergabung_date) : '-'}</div>
      </div>
      <div style="background:#F9FAFB;border:1px solid #F3F4F6;border-radius:12px;padding:10px 4px;text-align:center;">
        <div style="font-size:8px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Usia</div>
        <div style="font-size:12px;font-weight:900;color:#111827;line-height:1;">${p.tgl_lahir ? `${hitungUsia(p.tgl_lahir)} Thn` : '-'}</div>
      </div>
      <div style="background:#F9FAFB;border:1px solid #F3F4F6;border-radius:12px;padding:10px 4px;text-align:center;">
        <div style="font-size:8px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Tgl Lahir</div>
        <div style="font-size:10px;font-weight:900;color:#111827;line-height:1.2;">${p.tgl_lahir ? formatTanggal(p.tgl_lahir) : '-'}</div>
      </div>
      <div style="background:#F9FAFB;border:1px solid #F3F4F6;border-radius:12px;padding:10px 4px;text-align:center;">
        <div style="font-size:8px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Agama</div>
        <div style="font-size:12px;font-weight:900;color:#111827;line-height:1.2;">${p.agama || '-'}</div>
      </div>
      <div style="background:#F9FAFB;border:1px solid #F3F4F6;border-radius:12px;padding:10px 4px;text-align:center;">
        <div style="font-size:8px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Status</div>
        <div style="font-size:11px;font-weight:900;color:#111827;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.status_perkawinan || '-'}</div>
      </div>
    </div>

    <!-- Details -->
    <div style="display:flex;flex-direction:column;gap:20px;flex:1;overflow:hidden;">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <span style="font-size:10px;font-weight:900;color:#D1D5DB;text-transform:uppercase;letter-spacing:2px;white-space:nowrap;">Data Pekerjaan</span>
          <div style="flex:1;height:1px;background:#F3F4F6;"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px 32px;">
          ${fields([['Email OJK', p.email_ojk], ['No. Telepon', p.no_telepon], ['Bergabung', p.bergabung_date ? formatTanggal(p.bergabung_date) : null], ['NIP OJK', p.nip_ojk], ['Kontak Darurat', p.nama_kontak_darurat], ['Telp. Darurat', p.no_telepon_darurat ? `${p.no_telepon_darurat} (${p.hubungan_kontak_darurat || '-'})` : null]])}
        </div>
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <span style="font-size:10px;font-weight:900;color:#D1D5DB;text-transform:uppercase;letter-spacing:2px;white-space:nowrap;">Latar Belakang</span>
          <div style="flex:1;height:1px;background:#F3F4F6;"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px 32px;">
          ${fields([['Pendidikan', p.pendidikan], ['Lembaga', p.nama_lembaga], ['Jurusan', p.jurusan], ['Prev. Company', p.previous_company], ['Pengalaman CC', p.pengalaman_cc], ['Kelamin', p.jenis_kelamin]])}
        </div>
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <span style="font-size:10px;font-weight:900;color:#FCA5A5;text-transform:uppercase;letter-spacing:2px;white-space:nowrap;">🔒 Data Sensitif</span>
          <div style="flex:1;height:1px;background:#FEE2E2;"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px 32px;">
          ${fields([['No. KTP', p.no_ktp], ['No. NPWP', p.no_npwp], ['No. Rekening', p.nomor_rekening ? `${p.nomor_rekening}${p.nama_bank ? ' · ' + p.nama_bank : ''}` : null], ['Status Hunian', p.status_tempat_tinggal], ['Alamat Tinggal', p.alamat_tinggal, 2]])}
        </div>
      </div>
    </div>

    <!-- Footer Notes -->
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:auto;flex-shrink:0;">
      ${p.catatan_tambahan ? `<div style="width:100%;background:#FFFBEB;border:1px solid #FEF3C7;border-radius:16px;padding:16px;box-sizing:border-box;"><div style="font-size:9px;font-weight:900;color:#D97706;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">⭐ Catatan</div><div style="font-size:11px;color:#78350F;line-height:1.6;font-weight:500;">${p.catatan_tambahan}</div></div>` : ''}
      ${p.keterangan ? `<div style="width:100%;background:#F9FAFB;border:1px solid #F3F4F6;border-radius:16px;padding:16px;box-sizing:border-box;"><div style="font-size:9px;font-weight:900;color:#9CA3AF;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Keterangan</div><div style="font-size:11px;color:#4B5563;line-height:1.6;font-weight:500;">${p.keterangan}</div></div>` : ''}
    </div>
  </div>
  <div style="height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:#F9FAFB;border-top:1px solid #F3F4F6;flex-shrink:0;box-sizing:border-box;">
    <div style="display:flex;align-items:center;gap:8px;"><div style="width:6px;height:6px;border-radius:50%;background:#D1D5DB;"></div><span style="font-size:10px;font-weight:700;color:#D1D5DB;text-transform:uppercase;letter-spacing:1.5px;">Otoritas Jasa Keuangan — Kontak OJK 157</span></div>
    <span style="font-size:10px;font-weight:700;color:#D1D5DB;letter-spacing:1px;">${batch.toUpperCase()} · ${p.nama?.toUpperCase()}</span>
  </div>
</div>`;
    }

    return `
<div style="width:960px;height:540px;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#FFFFFF;box-sizing:border-box;overflow:hidden;">
  <div style="height:4px;background:#${theme.accent};flex-shrink:0;"></div>
  <div style="display:flex;flex:1;min-height:0;overflow:hidden;">
    <!-- LEFT SIDEBAR -->
    <div style="width:288px;background:#F9FAFB;border-right:1px solid #F3F4F6;display:flex;flex-direction:column;align-items:center;padding:32px 24px;gap:24px;box-sizing:border-box;flex-shrink:0;overflow:hidden;">
      ${p.foto_url 
        ? `<div style="width:144px;height:144px;border-radius:24px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.1);"><img src="${p.foto_url}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;" /></div>` 
        : `<div style="width:144px;height:144px;border-radius:24px;background:#${theme.light.replace('#','')};display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:bold;color:#${theme.accent};">${p.nama?.charAt(0) || '?'}</div>`
      }
      <div style="text-align:center;width:100%;">
        <div style="font-size:20px;font-weight:bold;color:#111827;line-height:1.2;">${p.nama || '-'}</div>
        <div style="font-size:11px;font-weight:700;color:#${theme.accent};margin-top:6px;text-transform:uppercase;letter-spacing:1px;">${labelJabatan[p.jabatan] || p.jabatan || '-'}</div>
        <div style="display:inline-block;margin-top:12px;font-size:10px;font-weight:700;color:#${theme.accent};background:#FFFFFF;border:1px solid #E5E7EB;border-radius:6px;padding:4px 12px;">${labelTim[p.tim] || p.tim || '-'}</div>
      </div>
      ${p.bergabung_date ? `
      <div style="width:100%;background:#FFFFFF;border:1px solid #F3F4F6;border-radius:16px;text-align:center;padding:16px;box-sizing:border-box;">
        <div style="font-size:8px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:1.5px;">Masa Dinas</div>
        <div style="font-size:18px;font-weight:900;color:#111827;margin-top:4px;line-height:1;">${hitungMasaDinas(p.bergabung_date)}</div>
        <div style="font-size:10px;color:#9CA3AF;margin-top:6px;">sejak ${formatTanggal(p.bergabung_date)}</div>
      </div>` : ''}
      <div style="width:100%;display:flex;flex-direction:column;gap:8px;margin-top:auto;">
        ${([['NIP OJK', p.nip_ojk], ['Kelamin', p.jenis_kelamin], ['Agama', p.agama], ['Usia', p.tgl_lahir ? `${hitungUsia(p.tgl_lahir)} Tahun` : null], ['Tgl Lahir', p.tgl_lahir ? formatTanggal(p.tgl_lahir) : null], ['Status', p.status_perkawinan]] as Array<[string, string | null | undefined]>).filter(([, v]) => v).map(([label, value]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:0 4px;">
            <span style="font-size:8px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">${label}</span>
            <span style="font-size:11px;font-weight:700;color:#374151;text-align:right;">${value}</span>
          </div>`).join('')}
      </div>
    </div>
    <!-- RIGHT CONTENT -->
    <div style="flex:1;padding:32px 40px;display:flex;flex-direction:column;gap:32px;overflow:hidden;min-width:0;">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <span style="font-size:10px;font-weight:900;color:#D1D5DB;text-transform:uppercase;letter-spacing:2px;white-space:nowrap;">Data Pekerjaan</span>
          <div style="flex:1;height:1px;background:#F3F4F6;"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px 32px;">
          ${fields([['Email OJK', p.email_ojk], ['No. Telepon', p.no_telepon], ['Bergabung', p.bergabung_date ? formatTanggal(p.bergabung_date) : null], ['Telp. Darurat', p.no_telepon_darurat], ['Kontak Darurat', p.nama_kontak_darurat], ['Hubungan', p.hubungan_kontak_darurat]])}
        </div>
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <span style="font-size:10px;font-weight:900;color:#D1D5DB;text-transform:uppercase;letter-spacing:2px;white-space:nowrap;">Latar Belakang</span>
          <div style="flex:1;height:1px;background:#F3F4F6;"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px 32px;">
          ${fields([['Pendidikan', p.pendidikan], ['Lembaga', p.nama_lembaga], ['Jurusan', p.jurusan], ['Prev. Company', p.previous_company], ['Pengalaman CC', p.pengalaman_cc]])}
        </div>
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <span style="font-size:10px;font-weight:900;color:#FCA5A5;text-transform:uppercase;letter-spacing:2px;white-space:nowrap;">🔒 Data Sensitif</span>
          <div style="flex:1;height:1px;background:#FEE2E2;"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px 32px;">
          ${fields([['No. KTP', p.no_ktp], ['No. NPWP', p.no_npwp], ['No. Rekening', p.nomor_rekening ? `${p.nomor_rekening}${p.nama_bank ? ' · ' + p.nama_bank : ''}` : null], ['Status Hunian', p.status_tempat_tinggal], ['Alamat Tinggal', p.alamat_tinggal, 2]])}
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-top:auto;">
        ${p.catatan_tambahan ? `<div style="flex:1;background:#FFFBEB;border:1px solid #FEF3C7;border-radius:16px;padding:16px;box-sizing:border-box;"><div style="font-size:9px;font-weight:900;color:#D97706;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">⭐ Catatan</div><div style="font-size:11px;color:#78350F;line-height:1.6;font-weight:500;">${p.catatan_tambahan}</div></div>` : ''}
        ${p.keterangan ? `<div style="flex:1;background:#F9FAFB;border:1px solid #F3F4F6;border-radius:16px;padding:16px;box-sizing:border-box;"><div style="font-size:9px;font-weight:900;color:#9CA3AF;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Keterangan</div><div style="font-size:11px;color:#4B5563;line-height:1.6;font-weight:500;">${p.keterangan}</div></div>` : ''}
      </div>
    </div>
  </div>
  <div style="height:40px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:#F9FAFB;border-top:1px solid #F3F4F6;flex-shrink:0;box-sizing:border-box;">
    <div style="display:flex;align-items:center;gap:8px;"><div style="width:6px;height:6px;border-radius:50%;background:#D1D5DB;"></div><span style="font-size:9px;font-weight:700;color:#D1D5DB;text-transform:uppercase;letter-spacing:1.5px;">Otoritas Jasa Keuangan — Kontak OJK 157</span></div>
    <span style="font-size:9px;font-weight:700;color:#D1D5DB;letter-spacing:1px;">${batch.toUpperCase()} · ${p.nama?.toUpperCase()}</span>
  </div>
</div>`;
  };

  const downloadPDF = async () => {
    setGenerating('pdf');
    try {
      const { jsPDF }   = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      
      const isLandscape = orientation === 'landscape';
      const pdfW = isLandscape ? 960 : 600;
      const pdfH = isLandscape ? 540 : 848;
      
      const pdf = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'px', format: [pdfW, pdfH] });
      for (let i = 0; i < peserta.length; i++) {
        const p = peserta[i];
        const container = document.createElement('div');
        container.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${pdfW}px;height:${pdfH}px;overflow:hidden;z-index:-1;--tw-ring-color:transparent;--tw-shadow:none;`;
        container.innerHTML = buildSlideHTML(p, selectedBatch, orientation);
        document.body.appendChild(container);
        const canvas = await html2canvas(container, {
          scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#FFFFFF', width: pdfW, height: pdfH,
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove());
            const html = clonedDoc.documentElement;
            html.style.colorScheme = 'normal'; html.style.color = '#000000'; html.style.backgroundColor = '#FFFFFF';
          },
        });
        document.body.removeChild(container);
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
      }
      pdf.save(`${selectedBatch}_peserta.pdf`);
    } catch (err: any) { alert('Gagal membuat PDF: ' + err.message); }
    finally { setGenerating(null); }
  };

  const options = [
    { id: 'excel', icon: <FileSpreadsheet className="w-8 h-8 text-green-500" />,  title: 'Excel (.xlsx)',      desc: 'Semua data peserta dalam format spreadsheet',    action: downloadExcel, hover: 'hover:border-green-300 dark:hover:border-green-700'   },
    { id: 'csv',   icon: <FileText        className="w-8 h-8 text-blue-500" />,   title: 'CSV (.csv)',         desc: 'Format universal, semua field lengkap',          action: downloadCSV,   hover: 'hover:border-blue-300 dark:hover:border-blue-700'     },
    { id: 'pptx',  icon: <Presentation    className="w-8 h-8 text-orange-500" />, title: 'PowerPoint (.pptx)', desc: '1 slide per peserta, layout persis SlideView',   action: downloadPPTX,  hover: 'hover:border-orange-300 dark:hover:border-orange-700' },
    { id: 'pdf',   icon: <FileDown        className="w-8 h-8 text-red-500" />,    title: 'PDF (.pdf)',         desc: '1 halaman per peserta, layout persis SlideView', action: downloadPDF,   hover: 'hover:border-red-300 dark:hover:border-red-700'       },
  ];

  const disabled = generating !== null || loading || peserta.length === 0;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">

        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/profiler/table?batch=${encodeURIComponent(selectedBatch)}`)}
            className="flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground transition-opacity font-medium">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <h1 className="text-lg font-black tracking-tight text-foreground">Download Data KTP</h1>
        </div>

        {/* ── Folder Picker ── */}
        <div className="bg-card rounded-3xl overflow-hidden shadow-sm border border-border/40 focus-within:ring-2 focus-within:ring-ring focus-within:border-accent">
          <button onClick={() => setShowPicker(v => !v)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors focus-visible:outline-none">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Folder className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[11px] text-foreground/40 font-bold uppercase tracking-widest">Folder yang akan diunduh</p>
              <p className="text-[15px] font-black tracking-tight text-foreground truncate mt-0.5">
                {selectedBatch || 'Pilih folder...'}
              </p>
            </div>
            <ChevronDown className={`w-5 h-5 text-foreground/40 flex-shrink-0 transition-transform duration-200 ${showPicker ? 'rotate-180' : ''}`} />
          </button>
          {showPicker && (
            <div className="border-t border-border/40 max-h-80 overflow-y-auto p-3 space-y-4">
              {initialYears.length === 0 ? (
                <p className="text-sm text-foreground/40 font-medium text-center py-4">Tidak ada data tahun.</p>
              ) : initialYears.map(year => {
                const yearFolders = initialFolders.filter(f => f.year_id === year.id && !f.parent_id);
                if (yearFolders.length === 0) return null;

                return (
                  <div key={year.id} className="space-y-2">
                    <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest px-3">{year.label}</p>
                    <div className="space-y-1">
                      {yearFolders.map(folder => {
                        const subFolders = initialFolders.filter(f => f.parent_id === folder.id);
                        return (
                          <div key={folder.id} className="space-y-1">
                            <button
                              onClick={() => { handleBatchChange(folder.name); }}
                              className={`w-full flex items-center justify-between px-4 py-3 text-sm rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                folder.name === selectedBatch
                                  ? 'bg-primary/10 text-primary font-bold'
                                  : 'text-foreground/80 font-medium hover:bg-muted'
                              }`}
                            >
                              {folder.name}
                              {folder.name === selectedBatch && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                            </button>
                            
                            {subFolders.map(sub => (
                              <button
                                key={sub.id}
                                onClick={() => { handleBatchChange(sub.name); }}
                                className={`w-[calc(100%-1rem)] ml-4 flex items-center justify-between px-4 py-3 text-sm rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                  sub.name === selectedBatch
                                    ? 'bg-primary/10 text-primary font-bold'
                                    : 'text-foreground/80 font-medium hover:bg-muted'
                                }`}
                              >
                                {sub.name}
                                {sub.name === selectedBatch && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Summary ── */}
        <div className="bg-card rounded-3xl p-5 flex items-center justify-between shadow-sm border border-border/40">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/40 mb-1">Total peserta siap diunduh</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-black tracking-tight text-foreground leading-none">{peserta.length}</span>
              <span className="text-sm font-bold text-foreground/40">Orang</span>
            </div>
          </div>
          <div className="flex items-center bg-muted/50 rounded-2xl p-1.5 border border-border/40 space-x-1">
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${orientation === 'landscape' ? 'bg-card text-foreground shadow-sm' : 'text-foreground/40 hover:text-foreground/80'}`}
            >
              Landscape
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${orientation === 'portrait' ? 'bg-card text-foreground shadow-sm' : 'text-foreground/40 hover:text-foreground/80'}`}
            >
              Portrait
            </button>
          </div>
        </div>

        {/* ── Download options ── */}
        <div className="space-y-4">
          {options.map(opt => (
            <button key={opt.id} onClick={opt.action} disabled={disabled}
              className={`w-full flex items-center gap-5 p-6 bg-card border border-border/40 hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed rounded-3xl text-left transition-all shadow-sm group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
              <div className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                {generating === opt.id
                  ? <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  : opt.icon}
              </div>
              <div className="flex-1">
                <p className="font-black tracking-tight text-foreground text-base">{opt.title}</p>
                <p className="text-[13px] font-medium tracking-tight text-foreground/60 mt-1">{opt.desc}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                <Download className="w-5 h-5 text-primary" />
              </div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
