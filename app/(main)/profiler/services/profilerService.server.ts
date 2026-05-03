import { createClient } from '@/app/lib/supabase/server';
import { 
  ProfilerYear, 
  ProfilerFolder, 
  Peserta 
} from '../lib/profiler-types';
import { getCachedFolders, getCachedYears } from '@/lib/cache/user-cache';
import type { LeaderScopeFilter } from '@/app/lib/access-control/leaderScope';

export const profilerServiceServer = {
  
  getYears: async (): Promise<ProfilerYear[]> => {
    try {
      return await getCachedYears();
    } catch (error) {
      console.error('Error fetching cached years:', error);
      throw error;
    }
  },

  getFolders: async (scope?: LeaderScopeFilter | null, participantIds?: string[] | null): Promise<ProfilerFolder[]> => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthenticated');
    
    try {
      const folders = await getCachedFolders();

      if (participantIds !== undefined && participantIds !== null) {
        if (participantIds.length === 0) return [];
        const { data: pesertaRows } = await supabase
          .from('profiler_peserta')
          .select('batch_name')
          .in('id', participantIds);
        const allowedBatches = new Set<string>();
        (pesertaRows || []).forEach((p: { batch_name?: string }) => {
          if (p.batch_name) allowedBatches.add(p.batch_name);
        });
        return folders.filter((f) => allowedBatches.has(f.name));
      }

      if (!scope) return folders;
      if (scope.batch_names && scope.batch_names.length > 0) {
        return folders.filter((f) => scope.batch_names!.includes(f.name));
      }
      const { data: pesertaRows } = await supabase
        .from('profiler_peserta')
        .select('batch_name');
      const allowedBatches = new Set<string>();
      const filteredRows = scope ? filterPesertaRows(pesertaRows || [], scope) : (pesertaRows || []);
      filteredRows.forEach((p: { batch_name?: string }) => {
        if (p.batch_name) allowedBatches.add(p.batch_name);
      });
      return folders.filter((f) => allowedBatches.has(f.name));
    } catch (error) {
      console.error('Error fetching cached folders:', error);
      throw error;
    }
  },

  getBatches: async (scope?: LeaderScopeFilter | null, participantIds?: string[] | null): Promise<string[]> => {
    const folders = await profilerServiceServer.getFolders(scope, participantIds);
    return folders.map(d => d.name);
  },

  getFolderCounts: async (scope?: LeaderScopeFilter | null, participantIds?: string[] | null): Promise<Record<string, number>> => {
    const supabase = await createClient();

    if (participantIds !== undefined && participantIds !== null) {
      if (participantIds.length === 0) return {};
      const { data, error } = await supabase
        .from('profiler_peserta')
        .select('batch_name, id')
        .in('id', participantIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((p: { batch_name?: string }) => {
        if (p.batch_name) {
          counts[p.batch_name] = (counts[p.batch_name] || 0) + 1;
        }
      });
      return counts;
    }

    const { data, error } = await supabase
      .from('profiler_peserta')
      .select('batch_name, tim, id');
    
    if (error) throw error;
    
    const filtered = scope ? filterPesertaRows(data || [], scope) : (data || []);
    const counts: Record<string, number> = {};
    filtered.forEach((p: { batch_name?: string }) => {
      if (p.batch_name) {
        counts[p.batch_name] = (counts[p.batch_name] || 0) + 1;
      }
    });
    return counts;
  },

  getByBatch: async (batchName: string, scope?: LeaderScopeFilter | null, participantIds?: string[] | null): Promise<Peserta[]> => {
    const supabase = await createClient();

    if (participantIds !== undefined && participantIds !== null) {
      if (participantIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiler_peserta')
        .select('*')
        .eq('batch_name', batchName)
        .in('id', participantIds)
        .order('nomor_urut', { ascending: true });
      if (error) throw error;
      return (data || []) as Peserta[];
    }

    const { data, error } = await supabase
      .from('profiler_peserta')
      .select('*')
      .eq('batch_name', batchName)
      .order('nomor_urut', { ascending: true });
    if (error) throw error;

    const rows = data || [];
    const filtered = scope ? filterPesertaRows(rows, scope) : rows;
    return filtered;
  },

  getGlobalPesertaPool: async (excludeBatch: string, scope?: LeaderScopeFilter | null, participantIds?: string[] | null): Promise<Peserta[]> => {
    const supabase = await createClient();

    if (participantIds !== undefined && participantIds !== null) {
      if (participantIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiler_peserta')
        .select('*')
        .neq('batch_name', excludeBatch)
        .in('id', participantIds)
        .order('batch_name')
        .order('nama');
      if (error) throw error;
      return (data || []) as Peserta[];
    }

    const { data, error } = await supabase
      .from('profiler_peserta')
      .select('*')
      .neq('batch_name', excludeBatch)
      .order('batch_name')
      .order('nama');
    if (error) throw error;

    const rows = data || [];
    const filtered = scope ? filterPesertaRows(rows, scope) : rows;
    return filtered;
  },

  getTimList: async (participantIds?: string[] | null): Promise<string[]> => {
    const supabase = await createClient();

    if (participantIds !== undefined && participantIds !== null) {
      if (participantIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiler_peserta')
        .select('tim')
        .in('id', participantIds);
      if (error) throw error;
      const tims = new Set<string>();
      (data || []).forEach((p: { tim?: string }) => {
        if (p.tim) tims.add(p.tim);
      });
      return Array.from(tims).sort();
    }

    const { data, error } = await supabase
      .from('profiler_tim_list')
      .select('nama')
      .order('created_at');
    if (error) throw error;
    return (data || []).map(d => d.nama);
  },
};

/**
 * Client-side filter for peserta rows by leader scope.
 * Used as a fail-closed post-fetch filter.
 */
export function filterPesertaRows(rows: Record<string, unknown>[], scope: LeaderScopeFilter): Record<string, unknown>[] {
  if (!scope) return rows;
  const { peserta_ids, batch_names, tims } = scope;

  return rows.filter((row) => {
    if (peserta_ids && peserta_ids.length > 0 && peserta_ids.includes(row.id as string)) return true;
    if (batch_names && batch_names.length > 0 && batch_names.includes(row.batch_name as string)) return true;
    if (tims && tims.length > 0 && tims.includes(row.tim as string)) return true;
    return false;
  });
}
