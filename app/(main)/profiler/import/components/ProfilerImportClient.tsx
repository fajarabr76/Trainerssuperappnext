'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download, MinusCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Peserta, labelJabatan, DEFAULT_TIMS } from '../../lib/profiler-types';
import { ProfilerYear, ProfilerFolder } from '../../services/profilerService';
import { ExcelTemplateService } from '../../components/ExcelTemplateService';
import { createPeserta, getPesertaByBatch } from '../../actions';
import { createClient } from '@/app/lib/supabase/client';

type RowResult = { nama: string; status: 'success' | 'error' | 'skipped'; message?: string };

const TEMPLATE_COLUMNS = [
  { header: 'Nama Lengkap',            key: 'nama',                    required: true,  contoh: 'Budi Santoso', width: 25 },
  { header: 'Tim',                      key: 'tim',                     required: true,  contoh: 'Telepon',         width: 15, choices: DEFAULT_TIMS },
  { header: 'Jabatan',                  key: 'jabatan',                 required: true,  contoh: 'cca',             width: 20, choices: ['operation_manager', 'spv', 'team_leader', 'trainer', 'wfm', 'qa', 'cca_senior', 'cca', 'cso'] },
  { header: 'NIK OJK',                  key: 'nik_ojk',                 required: false, contoh: '1234567',         width: 15 },
  { header: 'Tanggal Bergabung',        key: 'bergabung_date',          required: false, contoh: '2024-01-15',      width: 18, type: 'date' },
  { header: 'Email OJK',                key: 'email_ojk',               required: false, contoh: 'budi@ojk.go.id',  width: 25 },
  { header: 'No. Telepon',              key: 'no_telepon',              required: false, contoh: '08123456789',     width: 15 },
  { header: 'No. Telepon Darurat',      key: 'no_telepon_darurat',      required: false, contoh: '08129876543',     width: 15 },
  { header: 'Nama Kontak Darurat',      key: 'nama_kontak_darurat',     required: false, contoh: 'Siti Aminah',     width: 20 },
  { header: 'Hubungan Kontak Darurat',  key: 'hubungan_kontak_darurat', required: false, contoh: 'Orang Tua',       width: 20, choices: ['Orang Tua', 'Saudara', 'Pasangan', 'Teman'] },
  { header: 'Jenis Kelamin',            key: 'jenis_kelamin',           required: false, contoh: 'Laki-laki',       width: 15, choices: ['Laki-laki', 'Perempuan'] },
  { header: 'Agama',                    key: 'agama',                   required: false, contoh: 'Islam',           width: 15, choices: ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'] },
  { header: 'Tanggal Lahir',            key: 'tgl_lahir',               required: false, contoh: '1998-07-20',      width: 18, type: 'date' },
  { header: 'Status Perkawinan',        key: 'status_perkawinan',       required: false, contoh: 'Belum Menikah',   width: 18, choices: ['Belum Menikah', 'Menikah', 'Cerai'] },
  { header: 'Pendidikan',               key: 'pendidikan',              required: false, contoh: 'S1',              width: 12, choices: ['SMA', 'D3', 'S1', 'S2', 'S3'] },
  { header: 'No. KTP',                  key: 'no_ktp',                  required: false, contoh: '3201234567890001', width: 20 },
  { header: 'No. NPWP',                 key: 'no_npwp',                 required: false, contoh: '12.345.678.9-012.345', width: 20 },
  { header: 'Nomor Rekening',           key: 'nomor_rekening',          required: false, contoh: '1234567890',      width: 20 },
  { header: 'Nama Bank',                key: 'nama_bank',               required: false, contoh: 'BCA',             width: 15 },
  { header: 'Alamat Tinggal',           key: 'alamat_tinggal',          required: false, contoh: 'Jl. Merdeka No. 1, Jakarta', width: 35 },
  { header: 'Status Tempat Tinggal',    key: 'status_tempat_tinggal',   required: false, contoh: 'Kost/Sewa',        width: 25, choices: ['Milik Sendiri', 'Milik Orang Tua', 'Kost/Sewa', 'Lainnya'] },
  { header: 'Nama Lembaga Pendidikan',  key: 'nama_lembaga',            required: false, contoh: 'Universitas Indonesia', width: 25 },
  { header: 'Jurusan',                  key: 'jurusan',                 required: false, contoh: 'Komunikasi',      width: 20 },
  { header: 'Previous Company',         key: 'previous_company',        required: false, contoh: 'PT Telkom Indonesia', width: 25 },
  { header: 'Pengalaman Kontak OJK 157',key: 'pengalaman_cc',           required: false, contoh: 'Pernah',          width: 25, choices: ['Pernah', 'Tidak Pernah'] },
  { header: 'Catatan Tambahan',         key: 'catatan_tambahan',        required: false, contoh: 'Juara 1 Public Speaking 2024', width: 35 },
  { header: 'Keterangan',               key: 'keterangan',              required: false, contoh: 'Dalam masa percobaan', width: 30 },
];

interface ProfilerImportClientProps {
  batchName: string;
  initialTimList: string[];
}

export default function ProfilerImportClient({
  batchName,
  initialTimList
}: ProfilerImportClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);
  const [done, setDone] = useState(false);

  const downloadTemplate = async () => {
    try {
      await ExcelTemplateService.generateTemplate(batchName || 'Batch', initialTimList);
    } catch (error) {
      console.error('Error generating template:', error);
      alert('Gagal membuat template Excel');
    }
  };

  const processFile = async (file: File) => {
    setProcessing(true);
    setResults([]);
    setDone(false);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const { data: { user } } = await supabase.auth.getUser();
      // Fetch existing participants via Server Action or API
      const existing = await getPesertaByBatch(batchName);
      const existingNames = new Set(existing.map((p: any) => p.nama?.toLowerCase().trim() ?? ''));
      const importedThisRun = new Set<string>();

      const res: RowResult[] = [];

      const HEADER_MAP: Record<string, keyof Peserta> = {};
      TEMPLATE_COLUMNS.forEach(c => {
        HEADER_MAP[c.header.trim()] = c.key as keyof Peserta;
      });

      for (const row of rows) {
        const mapped: Partial<Peserta> = {
          batch_name: batchName,
          trainer_id: user?.id,
        };

        for (const [rawHeader, rawVal] of Object.entries(row)) {
          const field = HEADER_MAP[rawHeader.trim()];
          if (!field) continue;

          let val = rawVal;
          if (val instanceof Date) {
            val = val.toISOString().split('T')[0];
          } else {
            val = String(val ?? '').trim();
          }

          (mapped as any)[field] = val;
        }

        const nama = mapped.nama || '';
        if (!nama || nama.toLowerCase().includes('budi santoso')) continue;

        const namaKey = nama.toLowerCase().trim();
        if (existingNames.has(namaKey) || importedThisRun.has(namaKey)) {
          res.push({ nama, status: 'skipped', message: 'Sudah ada di folder ini' });
          continue;
        }

        try {
          await createPeserta(mapped as Peserta);
          importedThisRun.add(namaKey);
          res.push({ nama, status: 'success' });
        } catch (err: any) {
          res.push({ nama, status: 'error', message: err.message });
        }
      }

      setResults(res);
      setDone(true);
    } catch (err: any) {
      alert('Gagal membaca file: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('Format file harus .xlsx, .xls, atau .csv');
      return;
    }
    processFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount   = results.filter(r => r.status === 'error').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/profiler/table?batch=${encodeURIComponent(batchName)}`)}
            className="flex items-center gap-1.5 text-sm text-[#5A5A40] dark:text-[#A8A870] hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">
            Import Excel — <span className="text-gray-500 dark:text-gray-400 font-normal">{batchName}</span>
          </h1>
        </div>

        <div className="bg-white dark:bg-card rounded-2xl p-5 border border-[#5A5A40]/10 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                Langkah 1 — Download Template
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Template Excel dengan <strong className="text-gray-700 dark:text-gray-200">dropdown otomatis</strong> untuk kolom pilihan dan format tanggal yang benar.
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#5A5A40] hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-all whitespace-nowrap shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download .xlsx
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { label: 'Identitas Utama', items: 'Nama, Tim, Jabatan' },
              { label: 'Data Kerja', items: 'NIK, Bergabung, Email, Telepon' },
              { label: 'Data Pribadi', items: 'JK, Agama, Lahir, Pendidikan' },
              { label: 'Data Sensitif', items: 'KTP, NPWP, Rekening, Bank' },
            ].map(g => (
              <div key={g.label} className="bg-[#FDFCF8] dark:bg-card rounded-xl px-3 py-2 border border-[#5A5A40]/5">
                <p className="text-[10px] font-bold text-[#5A5A40] dark:text-[#5A5A40] uppercase tracking-wider mb-0.5">{g.label}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{g.items}</p>
              </div>
            ))}
          </div>
        </div>

        {!done && (
          <div className="bg-white dark:bg-card rounded-2xl p-5 border border-[#5A5A40]/10 shadow-sm">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Langkah 2 — Upload File
            </p>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
                dragging
                  ? 'border-[#5A5A40] bg-[#5A5A40]/5'
                  : 'border-gray-200 dark:border-white/10 bg-[#FDFCF8] dark:bg-card'
              }`}
            >
              {processing ? (
                <div className="space-y-3">
                  <Loader2 className="w-10 h-10 text-[#5A5A40] animate-spin mx-auto" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Memproses data...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <FileSpreadsheet className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Drag & drop file Excel di sini
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Format: .xlsx, .xls, atau .csv
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#5A5A40] hover:opacity-90 text-white rounded-xl text-sm font-semibold cursor-pointer transition-all shadow-sm">
                    <Upload className="w-4 h-4" />
                    Pilih File
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {done && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 bg-green-50 dark:bg-green-500/10 rounded-2xl p-4 text-center border border-green-200/50 dark:border-green-500/20">
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{successCount}</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">Berhasil</p>
              </div>
              {skippedCount > 0 && (
                <div className="flex-1 bg-yellow-50 dark:bg-yellow-500/10 rounded-2xl p-4 text-center border border-yellow-200/50 dark:border-yellow-500/20">
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{skippedCount}</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 font-medium">Duplikat</p>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex-1 bg-red-50 dark:bg-red-500/10 rounded-2xl p-4 text-center border border-red-200/50 dark:border-red-500/20">
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">{errorCount}</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">Gagal</p>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-card rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto border border-[#5A5A40]/10 shadow-sm">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  {r.status === 'success'
                    ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    : r.status === 'skipped'
                    ? <MinusCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                  <span className={`text-sm flex-1 truncate ${
                    r.status === 'skipped' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
                  }`}>{r.nama}</span>
                  {r.message && (
                    <span className={`text-xs flex-shrink-0 max-w-[180px] truncate ${
                      r.status === 'skipped' ? 'text-yellow-500' : 'text-red-400'
                    }`}>{r.message}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setDone(false); setResults([]); }}
                className="flex-1 py-3 bg-gray-100 dark:bg-card hover:bg-gray-200 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 rounded-2xl text-sm font-semibold"
              >
                Import Lagi
              </button>
              <button
                onClick={() => router.push(`/profiler/table?batch=${encodeURIComponent(batchName)}`)}
                className="flex-1 py-3 bg-[#5A5A40] hover:opacity-90 text-white rounded-2xl text-sm font-semibold shadow-sm"
              >
                Lihat Tabel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
