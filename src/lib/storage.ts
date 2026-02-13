import { supabase } from './supabase';
import type { Word, CardState, ReviewLog, QuizResult } from '../types';

// ============= Helpers =============

let cachedUserId: string | null = null;

supabase.auth.onAuthStateChange(() => {
  cachedUserId = null;
});

async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('未登录');
  cachedUserId = session.user.id;
  return cachedUserId;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toWord(row: any): Word {
  return {
    id: row.id,
    word: row.word,
    phonetic: row.phonetic ?? undefined,
    audio: row.audio ?? undefined,
    definitions: row.definitions,
    example: row.example ?? undefined,
    example_cn: row.example_cn ?? undefined,
    tags: row.tags ?? [],
    source: row.source,
    listId: row.list_id ?? undefined,
  };
}

function toCardState(row: any): CardState {
  return {
    wordId: row.word_id,
    easeFactor: Number(row.ease_factor),
    interval: row.interval,
    repetition: row.repetition,
    dueDate: row.due_date,
    lastReviewDate: row.last_review_date ?? undefined,
    status: row.status,
    consecutiveEasyCount: row.consecutive_easy_count ?? 0,
  };
}

function toReviewLog(row: any): ReviewLog {
  return {
    id: row.id,
    wordId: row.word_id,
    quality: row.quality,
    reviewDate: row.review_date,
    previousInterval: row.previous_interval,
    newInterval: row.new_interval,
    previousEF: Number(row.previous_ef),
    newEF: Number(row.new_ef),
    mode: row.mode,
  };
}

function toQuizResult(row: any): QuizResult {
  return {
    id: row.id,
    date: row.date,
    mode: row.mode,
    totalQuestions: row.total_questions,
    correctCount: row.correct_count,
    wrongWordIds: row.wrong_word_ids ?? [],
    durationSeconds: row.duration_seconds,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ============= Words =============

const BATCH_SIZE = 50;

export async function addWords(words: Word[]): Promise<void> {
  const userId = await getUserId();
  const rows = words.map((w) => ({
    id: w.id,
    user_id: userId,
    word: w.word,
    phonetic: w.phonetic ?? null,
    audio: w.audio ?? null,
    definitions: w.definitions,
    example: w.example ?? null,
    example_cn: w.example_cn ?? null,
    tags: w.tags ?? [],
    source: w.source,
    list_id: w.listId ?? null,
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('words').upsert(batch);
    if (error) throw error;
  }
}

export async function getWord(id: string): Promise<Word | undefined> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? toWord(data) : undefined;
}

export async function getWordsByIds(ids: string[]): Promise<Map<string, Word>> {
  if (ids.length === 0) return new Map();
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('user_id', userId)
    .in('id', ids);

  if (error) throw error;
  const map = new Map<string, Word>();
  for (const row of data ?? []) {
    const word = toWord(row);
    map.set(word.id, word);
  }
  return map;
}

export async function getAllWords(): Promise<Word[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map(toWord);
}

export async function getAllUserWords(): Promise<Word[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('user_id', userId)
    .eq('source', 'user');

  if (error) throw error;
  return (data ?? []).map(toWord);
}

export async function getWordsByListId(listId: string): Promise<Word[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .eq('user_id', userId)
    .eq('list_id', listId);

  if (error) throw error;
  return (data ?? []).map(toWord);
}

export async function deleteWord(id: string): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('words')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteWordsByListId(listId: string): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('words')
    .delete()
    .eq('user_id', userId)
    .eq('list_id', listId);

  if (error) throw error;
}

// ============= Card States =============

export async function getCardState(wordId: string): Promise<CardState | undefined> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('card_states')
    .select('*')
    .eq('user_id', userId)
    .eq('word_id', wordId)
    .maybeSingle();

  if (error) throw error;
  return data ? toCardState(data) : undefined;
}

export async function getAllCardStates(): Promise<CardState[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('card_states')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map(toCardState);
}

export async function upsertCardState(state: CardState): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase.from('card_states').upsert({
    word_id: state.wordId,
    user_id: userId,
    ease_factor: state.easeFactor,
    interval: state.interval,
    repetition: state.repetition,
    due_date: state.dueDate,
    last_review_date: state.lastReviewDate ?? null,
    status: state.status,
    consecutive_easy_count: state.consecutiveEasyCount ?? 0,
  });

  if (error) throw error;
}

export async function batchUpsertCardStates(states: CardState[]): Promise<void> {
  const userId = await getUserId();
  const rows = states.map((s) => ({
    word_id: s.wordId,
    user_id: userId,
    ease_factor: s.easeFactor,
    interval: s.interval,
    repetition: s.repetition,
    due_date: s.dueDate,
    last_review_date: s.lastReviewDate ?? null,
    status: s.status,
    consecutive_easy_count: s.consecutiveEasyCount ?? 0,
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('card_states').upsert(batch);
    if (error) throw error;
  }
}

// ============= Review Logs =============

export async function addReviewLog(log: ReviewLog): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase.from('review_logs').insert({
    id: log.id,
    user_id: userId,
    word_id: log.wordId,
    quality: log.quality,
    review_date: log.reviewDate,
    previous_interval: log.previousInterval,
    new_interval: log.newInterval,
    previous_ef: log.previousEF,
    new_ef: log.newEF,
    mode: log.mode,
  });

  if (error) throw error;
}

export async function batchAddReviewLogs(logs: ReviewLog[]): Promise<void> {
  if (logs.length === 0) return;
  const userId = await getUserId();
  const rows = logs.map((log) => ({
    id: log.id,
    user_id: userId,
    word_id: log.wordId,
    quality: log.quality,
    review_date: log.reviewDate,
    previous_interval: log.previousInterval,
    new_interval: log.newInterval,
    previous_ef: log.previousEF,
    new_ef: log.newEF,
    mode: log.mode,
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('review_logs').insert(batch);
    if (error) throw error;
  }
}

export async function getAllReviewLogs(): Promise<ReviewLog[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('review_logs')
    .select('*')
    .eq('user_id', userId)
    .order('review_date', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toReviewLog);
}

export async function getReviewLogsSince(since: string): Promise<ReviewLog[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('review_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('review_date', since)
    .order('review_date', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toReviewLog);
}

// ============= Quiz Results =============

export async function addQuizResult(result: QuizResult): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase.from('quiz_results').insert({
    id: result.id,
    user_id: userId,
    date: result.date,
    mode: result.mode,
    total_questions: result.totalQuestions,
    correct_count: result.correctCount,
    wrong_word_ids: result.wrongWordIds,
    duration_seconds: result.durationSeconds,
  });

  if (error) throw error;
}

export async function getAllQuizResults(): Promise<QuizResult[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('quiz_results')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toQuizResult);
}

// ============= Clear All Data =============

export async function clearAllData(): Promise<void> {
  const userId = await getUserId();
  await Promise.all([
    supabase.from('review_logs').delete().eq('user_id', userId),
    supabase.from('quiz_results').delete().eq('user_id', userId),
  ]);
  await supabase.from('words').delete().eq('user_id', userId);
  await Promise.all([
    supabase.from('user_settings').delete().eq('user_id', userId),
    supabase.from('streak_data').delete().eq('user_id', userId),
  ]);
}

// ============= Word List Enable/Disable (RPC) =============

export async function enableWordList(listId: string, listName: string): Promise<void> {
  const { error } = await supabase.rpc('enable_word_list', {
    p_list_id: listId,
    p_list_name: listName,
  });
  if (error) throw error;
}

export async function disableWordList(listId: string): Promise<void> {
  const { error } = await supabase.rpc('disable_word_list', {
    p_list_id: listId,
  });
  if (error) throw error;
}

// ============= Enabled Word Filtering =============

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getEnabledWordIds(enabledListIds: string[]): Promise<Set<string>> {
  const userId = await getUserId();
  const conditions = ['source.eq.user'];
  if (enabledListIds.length > 0) {
    conditions.push(`list_id.in.(${enabledListIds.join(',')})`);
  }
  const { data, error } = await supabase
    .from('words')
    .select('id')
    .eq('user_id', userId)
    .or(conditions.join(','));

  if (error) throw error;
  return new Set((data ?? []).map((row: any) => row.id as string));
}
/* eslint-enable @typescript-eslint/no-explicit-any */
