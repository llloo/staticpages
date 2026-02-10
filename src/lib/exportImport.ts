import type { UserSettings, StreakData } from '../types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';
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

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: UserSettings): void {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

export function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.streak);
    if (raw) return JSON.parse(raw);
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

export function saveStreak(streak: StreakData): void {
  localStorage.setItem(STORAGE_KEYS.streak, JSON.stringify(streak));
}

export function updateStreak(): StreakData {
  const streak = loadStreak();
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

  saveStreak(streak);
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
    settings: loadSettings(),
    streak: loadStreak(),
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

  if (data.settings) saveSettings(data.settings);
  if (data.streak) saveStreak(data.streak);
}
