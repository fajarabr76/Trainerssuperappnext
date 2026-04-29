import { createClient } from '@/app/lib/supabase/client';
import imageCompression from 'browser-image-compression';
import { 
  Peserta, 
  ProfilerYear, 
  ProfilerFolder
} from '../lib/profiler-types';

const supabase = createClient();

export { 
  type Peserta, 
  type ProfilerYear, 
  type ProfilerFolder
};


// ── Upload Foto ──────────────────────────────────────────────
export const uploadFoto = async (file: File, pesertaId: string): Promise<string> => {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 400,
    useWebWorker: true,
  });

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  const path = `${pesertaId}/${Date.now()}-${random}.${ext}`;

  const { error } = await supabase.storage
    .from('profiler-foto')
    .upload(path, compressed, { upsert: false });

  if (error) throw error;

  const { data } = supabase.storage
    .from('profiler-foto')
    .getPublicUrl(path);

  return data.publicUrl;
};

