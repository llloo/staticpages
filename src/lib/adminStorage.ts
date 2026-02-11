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

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRecord(row: any): WordListRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    wordCount: row.word_count,
    words: row.words ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
  const { data, error } = await supabase
    .from('word_lists')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toRecord(data) : null;
}

export async function createWordList(
  name: string,
  description: string,
  words: RawWordEntry[],
  createdBy: string
): Promise<string> {
  const { data, error } = await supabase
    .from('word_lists')
    .insert({ name, description, words, created_by: createdBy })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateWordList(
  id: string,
  name: string,
  description: string,
  words: RawWordEntry[]
): Promise<void> {
  const { error } = await supabase
    .from('word_lists')
    .update({ name, description, words })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteWordList(id: string): Promise<void> {
  const { error } = await supabase
    .from('word_lists')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
