import { createClient } from '@/app/lib/supabase/server';
import { 
  ProfilerYear, 
  ProfilerFolder, 
  Peserta 
} from '../lib/profiler-types';
import { getCachedFolders, getCachedYears } from '@/lib/cache/user-cache';

export const profilerServiceServer = {
  
  getYears: async (): Promise<ProfilerYear[]> => {
    try {
      return await getCachedYears();
    } catch (error) {
      console.error('Error fetching cached years:', error);
      throw error;
    }
  },

  getFolders: async (): Promise<ProfilerFolder[]> => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthenticated');
    
    try {
      return await getCachedFolders();
    } catch (error) {
      console.error('Error fetching cached folders:', error);
      throw error;
    }
  },

  getBatches: async (): Promise<string[]> => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthenticated');
    
    try {
      const folders = await getCachedFolders();
      return folders.map(d => d.name);
    } catch (error) {
      console.error('Error fetching cached batches from folders:', error);
      throw error;
    }
  },

  getFolderCounts: async (): Promise<Record<string, number>> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiler_peserta')
      .select('batch_name');
    
    if (error) throw error;
    
    const counts: Record<string, number> = {};
    (data || []).forEach(p => {
      if (p.batch_name) {
        counts[p.batch_name] = (counts[p.batch_name] || 0) + 1;
      }
    });
    return counts;
  },

  getByBatch: async (batchName: string): Promise<Peserta[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiler_peserta')
      .select('*')
      .eq('batch_name', batchName)
      .order('nomor_urut', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  getGlobalPesertaPool: async (excludeBatch: string): Promise<Peserta[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiler_peserta')
      .select('*')
      .neq('batch_name', excludeBatch)
      .order('batch_name')
      .order('nama');
    if (error) throw error;
    return data || [];
  },

  getTimList: async (): Promise<string[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiler_tim_list')
      .select('nama')
      .order('created_at');
    if (error) throw error;
    return (data || []).map(d => d.nama);
  },
};
