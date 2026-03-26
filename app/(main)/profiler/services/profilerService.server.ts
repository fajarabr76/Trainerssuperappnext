import { createClient } from '@/app/lib/supabase/server';
import { 
  ProfilerYear, 
  ProfilerFolder, 
  Peserta 
} from '../lib/profiler-types';
import { maskPesertaData } from '@/app/lib/utils.server';

export const profilerServiceServer = {
  
  getYears: async (): Promise<ProfilerYear[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiler_years')
      .select('*')
      .order('year', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  getFolders: async (): Promise<ProfilerFolder[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiler_folders')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  getBatches: async (): Promise<string[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiler_folders')
      .select('name')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(d => d.name);
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
    return (data || []).map(maskPesertaData);
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
    return (data || []).map(maskPesertaData);
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
