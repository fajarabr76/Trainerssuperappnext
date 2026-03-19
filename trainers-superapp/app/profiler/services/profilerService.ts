import { createClient } from '../../lib/supabase/client';
import imageCompression from 'browser-image-compression';

const supabase = createClient();

// ── Types ────────────────────────────────────────────────────
export type Tim = string;
export type Jabatan =
  | 'operation_manager'
  | 'spv'
  | 'team_leader'
  | 'trainer'
  | 'wfm'
  | 'qa'
  | 'cca_senior'
  | 'cca'
  | 'cso';

export interface ProfilerYear {
  id: string;
  year: number;
  label: string;
  created_at: string;
}

export interface ProfilerFolder {
  id: string;
  name: string;
  trainer_id: string;
  year_id: string | null;
  parent_id: string | null;
  created_at: string;
}

export const labelTim: Record<string, string> = {
  telepon: 'Tim Telepon',
  chat:    'Tim Chat',
  email:   'Tim Email',
};

export interface Peserta {
  id?: string;
  trainer_id?: string;
  batch_name: string;
  tim: Tim;
  jabatan: Jabatan;
  nama: string;
  foto_url?: string;
  bergabung_date?: string;
  nik_ojk?: string;
  email_ojk?: string;
  no_telepon?: string;
  no_telepon_darurat?: string;
  nama_kontak_darurat?: string;
  hubungan_kontak_darurat?: 'Orang Tua' | 'Saudara' | 'Pasangan' | 'Teman';
  jenis_kelamin?: 'Laki-laki' | 'Perempuan';
  agama?: 'Islam' | 'Kristen' | 'Katolik' | 'Hindu' | 'Buddha' | 'Konghucu';
  tgl_lahir?: string;
  status_perkawinan?: 'Belum Menikah' | 'Menikah' | 'Cerai';
  pendidikan?: 'SMA' | 'D3' | 'S1' | 'S2' | 'S3';
  no_ktp?: string;
  no_npwp?: string;
  nomor_rekening?: string;
  nama_bank?: string;
  alamat_tinggal?: string;
  status_tempat_tinggal?: 'Milik Sendiri' | 'Milik Orang Tua' | 'Kost/Sewa' | 'Lainnya';
  nama_lembaga?: string;
  jurusan?: string;
  previous_company?: string;
  pengalaman_cc?: string;
  catatan_tambahan?: string;
  keterangan?: string;
  nomor_urut?: number;
  created_at?: string;
  updated_at?: string;
}

// ── Helper: Kalkulasi Otomatis ───────────────────────────────
export const hitungMasaDinas = (bergabungDate: string): string => {
  const bergabung = new Date(bergabungDate);
  const now = new Date();
  let years = now.getFullYear() - bergabung.getFullYear();
  let months = now.getMonth() - bergabung.getMonth();
  if (months < 0) { years--; months += 12; }
  return `${years} Tahun ${months} Bulan`;
};

export const hitungUsia = (tglLahir: string): string => {
  const lahir = new Date(tglLahir);
  const now = new Date();
  let age = now.getFullYear() - lahir.getFullYear();
  const m = now.getMonth() - lahir.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < lahir.getDate())) age--;
  return `${age} Tahun`;
};

export const formatTanggal = (dateStr: string): string => {
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
};

export const labelJabatan: Record<string, string> = {
  operation_manager: 'Operation Manager',
  spv:               'Supervisor',
  team_leader:       'Team Leader',
  trainer:           'Trainer',
  wfm:               'WFM',
  qa:                'QA',
  cca_senior:        'CCA Senior',
  cca:               'CCA',
  cso:               'CSO',
};

export const DEFAULT_TIMS = ['Telepon', 'Chat', 'Email'];

// ── Upload Foto ──────────────────────────────────────────────
export const uploadFoto = async (file: File, pesertaId: string): Promise<string> => {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 400,
    useWebWorker: true,
  });

  const ext = file.name.split('.').pop();
  const path = `${pesertaId}.${ext}`;

  const { error } = await supabase.storage
    .from('profiler-foto')
    .upload(path, compressed, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage
    .from('profiler-foto')
    .getPublicUrl(path);

  return data.publicUrl;
};

// ── CRUD ─────────────────────────────────────────────────────
export const profilerService = {

  getByBatch: async (batchName: string): Promise<Peserta[]> => {
    const { data, error } = await supabase
      .from('profiler_peserta')
      .select('*')
      .eq('batch_name', batchName)
      .order('nomor_urut', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  getYears: async (): Promise<ProfilerYear[]> => {
    const { data, error } = await supabase
      .from('profiler_years')
      .select('*')
      .order('year', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  createYear: async (year: number): Promise<ProfilerYear> => {
    const { data, error } = await supabase
      .from('profiler_years')
      .insert({ year, label: `Tahun ${year}` })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteYear: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('profiler_years')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  getFolders: async (): Promise<ProfilerFolder[]> => {
    const { data, error } = await supabase
      .from('profiler_folders')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  getBatches: async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from('profiler_folders')
      .select('name')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(d => d.name);
  },

  createFolder: async (name: string, yearId: string | null = null, parentId: string | null = null): Promise<ProfilerFolder> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');
    const { data, error } = await supabase
      .from('profiler_folders')
      .insert({ 
        name, 
        trainer_id: user.id,
        year_id: yearId,
        parent_id: parentId
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  duplicateFolder: async (folderId: string, targetYearId: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    // 1. Get original folder
    const { data: folder, error: fErr } = await supabase
      .from('profiler_folders')
      .select('*')
      .eq('id', folderId)
      .single();
    if (fErr) throw fErr;

    // 2. Get participants
    const { data: participants, error: pErr } = await supabase
      .from('profiler_peserta')
      .select('*')
      .eq('batch_name', folder.name);
    if (pErr) throw pErr;

    // 3. Create new folder name (handle conflict)
    let newName = folder.name;
    const { data: existing } = await supabase
      .from('profiler_folders')
      .select('name')
      .eq('year_id', targetYearId)
      .eq('name', newName);
    
    if (existing && existing.length > 0) {
      newName = `${folder.name} (Copy)`;
    }

    // 4. Create folder
    const { data: newFolder, error: nfErr } = await supabase
      .from('profiler_folders')
      .insert({
        name: newName,
        trainer_id: user.id,
        year_id: targetYearId
      })
      .select()
      .single();
    if (nfErr) throw nfErr;

    // 5. Copy participants
    if (participants && participants.length > 0) {
      const newParticipants = participants.map(p => {
        const { id, created_at, updated_at, ...rest } = p;
        return {
          ...rest,
          batch_name: newName,
          trainer_id: user.id
        };
      });
      const { error: insErr } = await supabase
        .from('profiler_peserta')
        .insert(newParticipants);
      if (insErr) throw insErr;
    }
  },

  getGlobalPesertaPool: async (excludeBatch: string): Promise<Peserta[]> => {
    const { data, error } = await supabase
      .from('profiler_peserta')
      .select('*')
      .neq('batch_name', excludeBatch)
      .order('batch_name')
      .order('nama');
    if (error) throw error;
    return data || [];
  },

  copyPesertaToFolder: async (pesertaIds: string[], targetBatch: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tidak terautentikasi');

    const { data: sources, error: sErr } = await supabase
      .from('profiler_peserta')
      .select('*')
      .in('id', pesertaIds);
    if (sErr) throw sErr;

    if (sources && sources.length > 0) {
      const newPeserta = sources.map(s => {
        const { id, created_at, updated_at, ...rest } = s;
        return {
          ...rest,
          batch_name: targetBatch,
          trainer_id: user.id
        };
      });
      const { error: insErr } = await supabase
        .from('profiler_peserta')
        .insert(newPeserta);
      if (insErr) throw insErr;
    }
  },

  create: async (peserta: Peserta): Promise<Peserta> => {
    const { data, error } = await supabase
      .from('profiler_peserta')
      .insert([peserta])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, peserta: Partial<Peserta>): Promise<void> => {
    const { error } = await supabase
      .from('profiler_peserta')
      .update(peserta)
      .eq('id', id);
    if (error) throw error;
  },

  bulkUpdate: async (pesertaList: Peserta[]): Promise<void> => {
    const updates = pesertaList.map(p =>
      supabase.from('profiler_peserta').update(p).eq('id', p.id!)
    );
    await Promise.all(updates);
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('profiler_peserta')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  bulkCreate: async (pesertaList: Peserta[]): Promise<void> => {
    const { error } = await supabase
      .from('profiler_peserta')
      .insert(pesertaList);
    if (error) throw error;
  },

  renameBatch: async (oldName: string, newName: string): Promise<void> => {
    // 1. Rename di tabel folders
    const { error: folderErr } = await supabase
      .from('profiler_folders')
      .update({ name: newName })
      .eq('name', oldName);
    if (folderErr) throw folderErr;

    // 2. Update batch_name di semua peserta dalam folder ini
    const { error: pesertaErr } = await supabase
      .from('profiler_peserta')
      .update({ batch_name: newName })
      .eq('batch_name', oldName);
    if (pesertaErr) throw pesertaErr;
  },

  deleteBatch: async (batchName: string): Promise<void> => {
    // 1. Hapus semua peserta dulu
    const { error: pesertaErr } = await supabase
      .from('profiler_peserta')
      .delete()
      .eq('batch_name', batchName);
    if (pesertaErr) throw pesertaErr;

    // 2. Hapus folder
    const { error: folderErr } = await supabase
      .from('profiler_folders')
      .delete()
      .eq('name', batchName);
    if (folderErr) throw folderErr;
  },

  getTimList: async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from('profiler_tim_list')
      .select('nama')
      .order('created_at');
    if (error) throw error;
    return (data || []).map(d => d.nama);
  },

  addTim: async (nama: string): Promise<void> => {
    const { error } = await supabase
      .from('profiler_tim_list')
      .insert([{ nama }]);
    if (error) throw error;
  },

  deleteTim: async (nama: string): Promise<void> => {
    const { error } = await supabase
      .from('profiler_tim_list')
      .delete()
      .eq('nama', nama);
    if (error) throw error;
  },
};
