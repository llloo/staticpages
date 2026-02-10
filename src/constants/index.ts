import type { UserSettings } from '../types';

export const DB_NAME = 'vocabAppDB';
export const DB_VERSION = 1;

export const DEFAULT_SETTINGS: UserSettings = {
  dailyNewCardLimit: 20,
  dailyReviewLimit: 100,
  enabledListIds: [],
};

export const STORAGE_KEYS = {
  settings: 'vocab_settings',
  streak: 'vocab_streak',
} as const;

export const SM2_DEFAULTS = {
  initialEF: 2.5,
  minimumEF: 1.3,
} as const;

export const MASTERY_THRESHOLD_DAYS = 21;
