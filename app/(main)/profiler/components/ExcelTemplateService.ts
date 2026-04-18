'use client';

import { labelJabatan } from '../services/profilerService';

export const ExcelTemplateService = {
  generateTemplate: async (batchName: string, timList: string[]) => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    
    // 1. Sheet Data Peserta
    const sheet = workbook.addWorksheet('Data Peserta');
    
    // Header Configuration
    const columns = [
      { header: 'Nama Lengkap*', key: 'nama', width: 30 },
      { header: 'Tim*', key: 'tim', width: 20 },
      { header: 'Jabatan*', key: 'jabatan', width: 20 },
      { header: 'NIP OJK', key: 'nip_ojk', width: 15 },
      { header: 'Tgl Bergabung (YYYY-MM-DD)', key: 'bergabung_date', width: 25 },
      { header: 'Email OJK', key: 'email_ojk', width: 25 },
      { header: 'No Telepon', key: 'no_telepon', width: 20 },
      { header: 'No Telp Darurat', key: 'no_telepon_darurat', width: 20 },
      { header: 'Nama Kontak Darurat', key: 'nama_kontak_darurat', width: 25 },
      { header: 'Hubungan Kontak*', key: 'hubungan_kontak_darurat', width: 20 },
      { header: 'Jenis Kelamin*', key: 'jenis_kelamin', width: 15 },
      { header: 'Agama*', key: 'agama', width: 15 },
      { header: 'Tgl Lahir (YYYY-MM-DD)', key: 'tgl_lahir', width: 25 },
      { header: 'Status Perkawinan*', key: 'status_perkawinan', width: 20 },
      { header: 'Pendidikan*', key: 'pendidikan', width: 15 },
      { header: 'No KTP', key: 'no_ktp', width: 20 },
      { header: 'No NPWP', key: 'no_npwp', width: 20 },
      { header: 'No Rekening', key: 'nomor_rekening', width: 20 },
      { header: 'Nama Bank', key: 'nama_bank', width: 20 },
      { header: 'Alamat Tinggal', key: 'alamat_tinggal', width: 40 },
      { header: 'Status Hunian*', key: 'status_tempat_tinggal', width: 20 },
      { header: 'Nama Lembaga', key: 'nama_lembaga', width: 30 },
      { header: 'Jurusan', key: 'jurusan', width: 25 },
      { header: 'Perusahaan Sebelumnya', key: 'previous_company', width: 30 },
      { header: 'Pengalaman CC*', key: 'pengalaman_cc', width: 15 },
      { header: 'Catatan Tambahan', key: 'catatan_tambahan', width: 40 },
      { header: 'Keterangan', key: 'keterangan', width: 40 },
    ];
    
    sheet.columns = columns;
    
    // Styling Header
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).eachCell((cell, _colNumber) => {
      const headerText = cell.value as string;
      const isRequired = headerText.includes('*');
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isRequired ? 'FF15803D' : 'FF1E40AF' } // Green for required, Blue for optional
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    
    // 2. Sheet Pilihan (Hidden)
    const choiceSheet = workbook.addWorksheet('_Pilihan');
    
    const choices = {
      tim: timList,
      jabatan: Object.values(labelJabatan),
      hubungan: ['Orang Tua', 'Saudara', 'Pasangan', 'Teman'],
      gender: ['Laki-laki', 'Perempuan'],
      agama: ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'],
      statusKawin: ['Belum Menikah', 'Menikah', 'Cerai'],
      pendidikan: ['SMA', 'D3', 'S1', 'S2', 'S3'],
      hunian: ['Milik Sendiri', 'Milik Orang Tua', 'Kost/Sewa', 'Lainnya'],
      pengalaman: ['Pernah', 'Tidak Pernah']
    };
    
    // Fill choice sheet
    Object.entries(choices).forEach(([key, values], idx) => {
      const col = idx + 1;
      choiceSheet.getCell(1, col).value = key;
      values.forEach((val, rowIdx) => {
        choiceSheet.getCell(rowIdx + 2, col).value = val;
      });
    });
    
    // Hide choice sheet
    choiceSheet.state = 'veryHidden';
    
    // 3. Apply Data Validations to Data Sheet (1000 rows)
    const getRange = (colIdx: number, count: number) => {
      const colLetter = String.fromCharCode(64 + colIdx);
      return `_Pilihan!$${colLetter}$2:$${colLetter}$${count + 1}`;
    };
    
    for (let i = 2; i <= 1000; i++) {
      const row = sheet.getRow(i);
      
      // Tim (Col 2)
      row.getCell(2).dataValidation = { type: 'list', allowBlank: true, formulae: [getRange(1, choices.tim.length)] };
      // Jabatan (Col 3)
      row.getCell(3).dataValidation = { type: 'list', allowBlank: true, formulae: [getRange(2, choices.jabatan.length)] };
      // Hubungan (Col 10)
      row.getCell(10).dataValidation = { type: 'list', allowBlank: true, formulae: [getRange(3, choices.hubungan.length)] };
      // Gender (Col 11)
      row.getCell(11).dataValidation = { type: 'list', allowBlank: true, formulae: [getRange(4, choices.gender.length)] };
      // Agama (Col 12)
      row.getCell(12).dataValidation = { type: 'list', allowBlank: true, formulae: [getRange(5, choices.agama.length)] };
      // Status Kawin (Col 14)
      row.getCell(14).dataValidation = { type: 'list', allowBlank: true, formulae: [getRange(6, choices.statusKawin.length)] };
      // Pendidikan (Col 15)
      row.getCell(15).dataValidation = { type: 'list', allowBlank: true, formulae: [getRange(7, choices.pendidikan.length)] };
      // Hunian (Col 21)
      row.getCell(21).dataValidation = { type: 'list', allowBlank: true, formulae: [getRange(8, choices.hunian.length)] };
      // Pengalaman (Col 25)
      row.getCell(25).dataValidation = { type: 'list', allowBlank: true, formulae: [getRange(9, choices.pengalaman.length)] };
    }
    
    // 4. Panduan Sheet
    const guideSheet = workbook.addWorksheet('Panduan');
    guideSheet.columns = [{ width: 5 }, { width: 40 }, { width: 60 }];
    guideSheet.addRow(['No', 'Kolom', 'Keterangan']);
    guideSheet.getRow(1).font = { bold: true };
    guideSheet.addRows([
      [1, 'Nama Lengkap', 'Wajib diisi. Nama sesuai KTP.'],
      [2, 'Tim', 'Pilih dari dropdown.'],
      [3, 'Jabatan', 'Pilih dari dropdown.'],
      [4, 'Tgl Bergabung / Lahir', 'Format YYYY-MM-DD (Contoh: 1995-08-17).'],
      [5, 'NIP OJK', 'Nomor Induk Pegawai OJK (jika ada).'],
      [6, 'Data Sensitif', 'KTP, NPWP, Rekening bersifat opsional namun disarankan.'],
    ]);
    
    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Template_Profiler_${batchName.replace(/\s+/g, '_')}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }
};
