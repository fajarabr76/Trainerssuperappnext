import { createClient } from '@/app/lib/supabase/client';
import { AppSettings } from '@/app/types';
import { defaultSettings } from '../data';
import { parseSettings } from '../constants';

const supabase = createClient();
const LOCAL_STORAGE_KEY = 'ketik_app_settings_v2';

// ── Simpan ke localStorage (backup lokal) ──────────────
function saveToLocal(settings: AppSettings) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  }
}

// ── Ambil dari localStorage ────────────────────────────
function loadFromLocal(): AppSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? parseSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

// ── Simpan pengaturan ke Supabase + localStorage ───────
export async function saveSettings(settings: AppSettings): Promise<void> {
  // Selalu simpan ke localStorage dulu (instant, tidak perlu internet)
  saveToLocal(settings);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // Belum login, cukup simpan lokal

  // Ambil settings yang sudah ada untuk digabung (karena user_settings mungkin berisi settings untuk modul lain)
  const { data: existing } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle();

  const updatedSettings = {
    ...(existing?.settings || {}),
    ketik: settings
  };

  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { 
        user_id: user.id, 
        settings: updatedSettings, 
        updated_at: new Date().toISOString() 
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('[Settings] Gagal menyimpan ke Supabase:', error.message);
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Settings] Pengaturan berhasil disimpan ke Supabase');
    }
  }
}

// ── Ambil pengaturan: Supabase > localStorage > default ─
export async function loadSettings(): Promise<AppSettings> {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data?.settings?.ketik) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Settings] Pengaturan dimuat dari Supabase');
      }
      const parsed = parseSettings(data.settings.ketik);
      // Sinkronkan juga ke localStorage
      saveToLocal(parsed);
      return parsed;
    }
  }

  // Fallback: coba dari localStorage
  const local = loadFromLocal();
  if (local) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Settings] Pengaturan dimuat dari localStorage');
    }
    return local;
  }

  // Fallback terakhir: pakai default
  if (process.env.NODE_ENV === 'development') {
    console.log('[Settings] Menggunakan pengaturan default');
  }
  return defaultSettings;
}
