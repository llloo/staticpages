export interface Definition {
  pos: string;
  meaning: string;
}

export interface Word {
  id: string;
  word: string;
  phonetic?: string;
  audio?: string;
  definitions: Definition[];
  example?: string;
  example_cn?: string;
  tags: string[];
  source: 'builtin' | 'user';
  listId?: string;
}

export interface CardState {
  wordId: string;
  easeFactor: number;
  interval: number;
  repetition: number;
  dueDate: string;
  lastReviewDate?: string;
  status: 'new' | 'learning' | 'review' | 'mastered' | 'retired';
  consecutiveEasyCount?: number; // Track consecutive "Easy" ratings
}

export interface ReviewLog {
  id: string;
  wordId: string;
  quality: number;
  reviewDate: string;
  previousInterval: number;
  newInterval: number;
  previousEF: number;
  newEF: number;
  mode: 'review' | 'quiz';
}

export interface QuizResult {
  id: string;
  date: string;
  mode: 'mcq' | 'spelling';
  totalQuestions: number;
  correctCount: number;
  wrongWordIds: string[];
  durationSeconds: number;
}

export interface UserSettings {
  dailyNewCardLimit: number;
  dailyReviewLimit: number;
  enabledListIds: string[];
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  activeDates: string[];
}

export interface WordListMeta {
  id: string;
  name: string;
  description: string;
  wordCount: number;
}

export interface RawWordEntry {
  word: string;
  phonetic?: string;
  audio?: string;
  definitions: Definition[];
  example?: string;
  example_cn?: string;
}
