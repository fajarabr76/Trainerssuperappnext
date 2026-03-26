'use server'

import { createClient } from '@/app/lib/supabase/server';
import { Peserta } from './lib/profiler-types';
import { revalidatePath } from 'next/cache';

export async function createYear(year: number) {
  const supabase = await createClient();

  // 1. Validation for Range (22003 fix)
  if (year < 2000 || year > 2100) {
    throw new Error('Tahun harus antara 2000 dan 2100');
  }

  // 2. Check for existence (23505 fix)
  const { data: existing } = await supabase
    .from('profiler_years')
    .select('year')
    .eq('year', year)
    .single();
  
  if (existing) {
    throw new Error(`Tahun ${year} sudah ada.`);
  }

  const { data, error } = await supabase
    .from('profiler_years')
    .insert({ year, label: `Tahun ${year}` })
    .select()
    .single();
    
  if (error) throw error;
  revalidatePath('/profiler');
  return data;
}

export async function deleteYear(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiler_years')
    .delete()
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/profiler');
}

export async function createFolder(name: string, yearId: string | null = null, parentId: string | null = null) {
  const supabase = await createClient();
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

  // Log Activity
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: user.email,
    action: `Membuat Folder: ${name}`,
    module: 'KTP',
    type: 'add'
  });

  revalidatePath('/profiler');
  return data;
}

export async function updateFolder(id: string, patch: { name?: string; year_id?: string; parent_id?: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiler_folders')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  revalidatePath('/profiler');
  return data;
}

export async function renameBatch(oldName: string, newName: string) {
  const supabase = await createClient();
  
  // 1. Update folder name
  const { error: folderErr } = await supabase
    .from('profiler_folders')
    .update({ name: newName })
    .eq('name', oldName);
  if (folderErr) throw folderErr;

  // 2. Update all peserta batch_name
  const { error: pesertaErr } = await supabase
    .from('profiler_peserta')
    .update({ batch_name: newName })
    .eq('batch_name', oldName);
  if (pesertaErr) throw pesertaErr;

  revalidatePath('/profiler');
}

export async function deleteBatch(batchName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

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
  
  // Log Activity
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: user.email,
    action: `Menghapus Batch: ${batchName}`,
    module: 'KTP',
    type: 'delete'
  });

  revalidatePath('/profiler');
}

export async function duplicateFolder(folderId: string, targetYearId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

  // 1. Get source folder
  const { data: folder, error: fErr } = await supabase
    .from('profiler_folders').select('*').eq('id', folderId).single();
  if (fErr) throw fErr;

  // 2. Get participants
  const { data: participants, error: pErr } = await supabase
    .from('profiler_peserta').select('*').eq('batch_name', folder.name);
  if (pErr) throw pErr;

  // 3. Handle conflict
  let newName = folder.name;
  const { data: existing } = await supabase
    .from('profiler_folders')
    .select('name')
    .eq('year_id', targetYearId)
    .eq('name', newName);
  
  if (existing && existing.length > 0) {
    newName = `${folder.name} (Copy)`;
  }

  // 4. Create new folder
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
    const { data: insertedData, error: insErr } = await supabase
      .from('profiler_peserta')
      .insert(newParticipants)
      .select();
    if (insErr) throw insErr;

    revalidatePath('/profiler');
    return { folder: newFolder, participants: insertedData };
  }
  
  revalidatePath('/profiler');
  return { folder: newFolder, participants: [] };
}

export async function copyPesertaToFolder(pesertaIds: string[], targetBatch: string) {
  const supabase = await createClient();
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
      const { data: insertedData, error: insErr } = await supabase
      .from('profiler_peserta')
      .insert(newPeserta)
      .select();
    if (insErr) throw insErr;
    
    revalidatePath('/profiler');
    return insertedData;
  }
  return [];
}

export async function getOriginalPeserta(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiler_peserta')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePeserta(id: string, data: Partial<Peserta>, path?: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiler_peserta')
    .update(data)
    .eq('id', id);
  if (error) throw error;
  if (path) revalidatePath(path);
}

export async function deletePeserta(id: string, path?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

  const { error } = await supabase
    .from('profiler_peserta')
    .delete()
    .eq('id', id);
  if (error) throw error;

  // Log Activity
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: user.email,
    action: `Menghapus Peserta ID: ${id}`,
    module: 'KTP',
    type: 'delete'
  });

  if (path) revalidatePath(path);
}

export async function bulkCreatePeserta(pesertaList: Peserta[], path?: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiler_peserta')
    .insert(pesertaList);
  if (error) throw error;
  if (path) revalidatePath(path);
}

export async function getGlobalPesertaPool(excludeBatch: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiler_peserta')
    .select('*')
    .neq('batch_name', excludeBatch)
    .order('batch_name')
    .order('nama');
  if (error) throw error;
  return data || [];
}

export async function getTimList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiler_tim_list')
    .select('nama')
    .order('created_at');
  if (error) throw error;
  return (data || []).map(d => d.nama);
}

export async function addTim(nama: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('profiler_tim_list').insert([{ nama }]);
  if (error) throw error;
  revalidatePath('/profiler');
}

export async function deleteTim(nama: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('profiler_tim_list').delete().eq('nama', nama);
  if (error) throw error;
  revalidatePath('/profiler');
}

export async function getPesertaByBatch(batchName: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiler_peserta')
    .select('*')
    .eq('batch_name', batchName);
  if (error) throw error;
  return data || [];
}

export async function createPeserta(data: Peserta) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tidak terautentikasi');

  const { error } = await supabase.from('profiler_peserta').insert([data]);
  if (error) throw error;

  // Log Activity
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    user_name: user.email,
    action: `Menambah Peserta: ${data.nama}`,
    module: 'KTP',
    type: 'add'
  });

  revalidatePath('/profiler');
}
