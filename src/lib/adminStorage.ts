import { supabase } from './supabase';
import type { RawWordEntry } from '../types';

export interface WordListRecord {
  id: string;
  name: string;
  description: string;
  wordCount: number;
  words: RawWordEntry[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const BATCH_SIZE = 50;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toMetaRecord(row: any): Omit<WordListRecord, 'words'> {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    wordCount: row.word_count,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRawWordEntry(row: any): RawWordEntry {
  return {
    word: row.word,
    phonetic: row.phonetic ?? undefined,
    audio: row.audio ?? undefined,
    definitions: row.definitions,
    example: row.example ?? undefined,
    example_cn: row.example_cn ?? undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getWordListsMeta(): Promise<Omit<WordListRecord, 'words'>[]> {
  const { data, error } = await supabase
    .from('word_lists')
    .select('id, name, description, word_count, created_by, created_at, updated_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toMetaRecord);
}

export async function getWordListById(id: string): Promise<WordListRecord | null> {
  const { data: listData, error: listError } = await supabase
    .from('word_lists')
    .select('id, name, description, word_count, created_by, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (listError) throw listError;
  if (!listData) return null;

  const { data: entriesData, error: entriesError } = await supabase
    .from('word_list_entries')
    .select('word, phonetic, audio, definitions, example, example_cn')
    .eq('list_id', id)
    .order('position', { ascending: true });
  if (entriesError) throw entriesError;

  return {
    ...toMetaRecord(listData),
    words: (entriesData ?? []).map(toRawWordEntry),
  };
}

export async function createWordList(
  name: string,
  description: string,
  words: RawWordEntry[],
  createdBy: string
): Promise<string> {
  const { data, error } = await supabase
    .from('word_lists')
    .insert({ name, description, created_by: createdBy })
    .select('id')
    .single();
  if (error) throw error;

  const listId = data.id;
  await insertEntries(listId, words);
  return listId;
}

export async function updateWordList(
  id: string,
  name: string,
  description: string,
  words: RawWordEntry[]
): Promise<void> {
  const { error: metaError } = await supabase
    .from('word_lists')
    .update({ name, description })
    .eq('id', id);
  if (metaError) throw metaError;

  // Delete old entries and re-insert
  const { error: deleteError } = await supabase
    .from('word_list_entries')
    .delete()
    .eq('list_id', id);
  if (deleteError) throw deleteError;

  await insertEntries(id, words);
}

export async function deleteWordList(id: string): Promise<void> {
  const { error } = await supabase
    .from('word_lists')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

async function insertEntries(listId: string, words: RawWordEntry[]): Promise<void> {
  if (words.length === 0) return;

  const rows = words.map((w, i) => ({
    list_id: listId,
    position: i,
    word: w.word,
    phonetic: w.phonetic ?? null,
    audio: w.audio ?? null,
    definitions: w.definitions,
    example: w.example ?? null,
    example_cn: w.example_cn ?? null,
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('word_list_entries').insert(batch);
    if (error) throw error;
  }
}
