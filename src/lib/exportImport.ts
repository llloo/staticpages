import type { UserSettings, StreakData } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { supabase } from './supabase';
import {
  getAllWords,
  getAllCardStates,
  getAllReviewLogs,
  getAllQuizResults,
  addWords,
  batchUpsertCardStates,
  addReviewLog,
  addQuizResult,
  clearAllData,
} from './storage';

async function getUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('未登录');
  return session.user.id;
}

export async function loadSettings(): Promise<UserSettings> {
  try {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return {
        dailyNewCardLimit: data.daily_new_card_limit,
        dailyReviewLimit: data.daily_review_limit,
        enabledListIds: data.enabled_list_ids ?? [],
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    daily_new_card_limit: settings.dailyNewCardLimit,
    daily_review_limit: settings.dailyReviewLimit,
    enabled_list_ids: settings.enabledListIds,
  });
  if (error) throw error;
}

export async function loadStreak(): Promise<StreakData> {
  try {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('streak_data')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return {
        currentStreak: data.current_streak,
        longestStreak: data.longest_streak,
        lastActiveDate: data.last_active_date ?? '',
        activeDates: data.active_dates ?? [],
      };
    }
  } catch {
    // ignore
  }
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    activeDates: [],
  };
}

export async function saveStreak(streak: StreakData): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase.from('streak_data').upsert({
    user_id: userId,
    current_streak: streak.currentStreak,
    longest_streak: streak.longestStreak,
    last_active_date: streak.lastActiveDate || null,
    active_dates: streak.activeDates,
  });
  if (error) throw error;
}

export async function updateStreak(): Promise<StreakData> {
  const streak = await loadStreak();
  const today = new Date().toISOString().split('T')[0];

  if (streak.lastActiveDate === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (streak.lastActiveDate === yesterdayStr) {
    streak.currentStreak += 1;
  } else {
    streak.currentStreak = 1;
  }

  streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
  streak.lastActiveDate = today;

  if (!streak.activeDates.includes(today)) {
    streak.activeDates.push(today);
    // Keep last 365 days
    if (streak.activeDates.length > 365) {
      streak.activeDates = streak.activeDates.slice(-365);
    }
  }

  await saveStreak(streak);
  return streak;
}

interface ExportData {
  version: number;
  exportDate: string;
  words: Awaited<ReturnType<typeof getAllWords>>;
  cardStates: Awaited<ReturnType<typeof getAllCardStates>>;
  reviewLogs: Awaited<ReturnType<typeof getAllReviewLogs>>;
  quizResults: Awaited<ReturnType<typeof getAllQuizResults>>;
  settings: UserSettings;
  streak: StreakData;
}

export async function exportAllData(): Promise<string> {
  const words = await getAllWords();
  const data: ExportData = {
    version: 1,
    exportDate: new Date().toISOString(),
    words: words.filter((w) => w.source === 'user'),
    cardStates: await getAllCardStates(),
    reviewLogs: await getAllReviewLogs(),
    quizResults: await getAllQuizResults(),
    settings: await loadSettings(),
    streak: await loadStreak(),
  };
  return JSON.stringify(data, null, 2);
}

export function triggerDownload(jsonString: string): void {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vocab-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importData(jsonString: string): Promise<void> {
  const data: ExportData = JSON.parse(jsonString);
  if (data.version !== 1) throw new Error('不支持的数据版本');

  await clearAllData();

  if (data.words.length > 0) await addWords(data.words);
  if (data.cardStates.length > 0) await batchUpsertCardStates(data.cardStates);
  for (const log of data.reviewLogs) await addReviewLog(log);
  for (const quiz of data.quizResults) await addQuizResult(quiz);

  if (data.settings) await saveSettings(data.settings);
  if (data.streak) await saveStreak(data.streak);
}
