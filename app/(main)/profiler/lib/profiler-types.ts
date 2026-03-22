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

export interface Peserta {
  id?: string;
  trainer_id?: string;
  batch_name: string;
  tim: Tim;
  jabatan: Jabatan;
  nama: string;
  foto_url?: string;
  bergabung_date?: string;
  nip_ojk?: string;
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

export const labelTim: Record<string, string> = {
  telepon: 'Tim Telepon',
  chat:    'Tim Chat',
  email:   'Tim Email',
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

// ── Helpers ─────────────────────────────────────────────────
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
