import { unstable_cache, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/app/lib/supabase/admin';
import type { ProfilerFolder, ProfilerYear } from '@/app/(main)/profiler/lib/profiler-types';

/**
 * ------------------------------------------------------------------
 * BAGIAN 1: PROFILER FOLDERS (PER-USER)
 * Digunakan untuk mengambil daftar folder spesifik milik seorang trainer
 * TTL: 5 menit (300 detik)
 * Tag invalidation: profiler-folders-{userId}
 * ------------------------------------------------------------------
 */

/**
 * [UNTUK profilerService]
 * Mendapatkan daftar lengkap folder milik user tertentu (return Promise<ProfilerFolder[]>)
 */
export const getCachedFolders = async (): Promise<ProfilerFolder[]> => {
  const fetchFolders = unstable_cache(
    async () => {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('profiler_folders')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching cached folders:', error);
        return [];
      }
      return data || [];
    },
    ['profiler-folders-global'],
    {
      revalidate: 300,
      tags: ['profiler-folders-global'],
    }
  );

  return await fetchFolders();
};

/**
 * [UNTUK qaService]
 * Mendapatkan daftar nama (string) folder milik user tertentu (return Promise<string[]>)
 */
export const getCachedFolderNames = async (): Promise<string[]> => {
  const fetchFolderNames = unstable_cache(
    async () => {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('profiler_folders')
        .select('name')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching cached folder names:', error);
        return [];
      }
      return (data || []).map((d: any) => d.name);
    },
    ['profiler-folder-names-global'], 
    {
      revalidate: 300,
      tags: ['profiler-folders-global'], // Tag sama dengan object utuh, jika folder berubah maka semua invalid
    }
  );

  return await fetchFolderNames();
};

/**
 * ------------------------------------------------------------------
 * BAGIAN 2: PROFILER YEARS (GLOBAL)
 * Tabel years bersifat global tanpa trainer_id, sehingga di-share ke semua.
 * TTL: 1 Jam (3600 detik)
 * Tag invalidation: profiler-years-global
 * ------------------------------------------------------------------
 */

/**
 * [UNTUK profilerService]
 * Mendapatkan daftar objek lengkap tahun (return Promise<ProfilerYear[]>)
 */
export const getCachedYears = async (): Promise<ProfilerYear[]> => {
  const fetchYears = unstable_cache(
    async () => {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('profiler_years')
        .select('*')
        .order('year', { ascending: false });

      if (error) {
        console.error('Error fetching cached years:', error);
        return [];
      }
      return data || [];
    },
    ['profiler-years-global'],
    {
      revalidate: 3600,
      tags: ['profiler-years-global'],
    }
  );

  return await fetchYears();
};

/**
 * [UNTUK qaService]
 * Mendapatkan daftar number array dari tahun (return Promise<number[]>)
 */
export const getCachedAvailableYears = async (): Promise<number[]> => {
  const fetchAvailableYears = unstable_cache(
    async () => {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('profiler_years')
        .select('year')
        .order('year', { ascending: false });

      if (error) {
        console.error('Error fetching cached available years:', error);
        return [];
      }
      return (data || []).map((d: any) => d.year);
    },
    ['profiler-available-years-global'], 
    {
      revalidate: 3600,
      tags: ['profiler-years-global'], // Tag sama agar cukup 1 invalidasi
    }
  );

  return await fetchAvailableYears();
};

/**
 * ------------------------------------------------------------------
 * BAGIAN 3: CACHE INVALIDATION HELPERS
 * Fungsi pembantu yang aman dipanggil kapan saja saat data berubah
 * ------------------------------------------------------------------
 */

export function invalidateFoldersCache() {
  revalidateTag('profiler-folders-global');
}

export function invalidateYearsCache() {
  revalidateTag('profiler-years-global');
}
