import { createClient } from '@/app/lib/supabase/client';
import { AppSettings } from '@/app/types';
import { defaultTelefunSettings } from '../data';
import { parseTelefunSettings } from '../constants';

const supabase = createClient();
const LOCAL_STORAGE_KEY = 'telefun_app_settings_v1';

function saveToLocal(settings: AppSettings) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  }
}

function loadFromLocal(): AppSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? parseTelefunSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function saveTelefunSettings(settings: AppSettings): Promise<void> {
  saveToLocal(settings);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .maybeSingle();

  const updatedSettings = {
    ...(existing?.settings || {}),
    telefun: settings
  };

  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      settings: updatedSettings,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('[Telefun Settings] Gagal menyimpan ke Supabase:', error.message);
  } else {
    console.log('[Telefun Settings] Pengaturan berhasil disimpan ke Supabase');
  }
}

export async function loadTelefunSettings(): Promise<AppSettings> {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data?.settings?.telefun) {
      console.log('[Telefun Settings] Pengaturan dimuat dari Supabase');
      const parsed = parseTelefunSettings(data.settings.telefun);
      saveToLocal(parsed);
      return parsed;
    }
  }

  const local = loadFromLocal();
  if (local) {
    console.log('[Telefun Settings] Pengaturan dimuat dari localStorage');
    return local;
  }

  console.log('[Telefun Settings] Menggunakan pengaturan default');
  return defaultTelefunSettings;
}
