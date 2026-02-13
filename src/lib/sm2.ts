import type { CardState } from '../types';
import { SM2_DEFAULTS, MASTERY_THRESHOLD_DAYS } from '../constants';

export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetition: number;
}

export function calculateNextReview(
  quality: number,
  repetition: number,
  easeFactor: number,
  interval: number
): SM2Result {
  quality = Math.max(0, Math.min(5, Math.round(quality)));

  const newEF = Math.max(
    SM2_DEFAULTS.minimumEF,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  let newInterval: number;
  let newRepetition: number;

  if (quality < 3) {
    newRepetition = 0;
    newInterval = 1;
  } else {
    newRepetition = repetition + 1;
    if (newRepetition === 1) {
      newInterval = 1;
    } else if (newRepetition === 2) {
      // Quality-dependent second step:
      // Hard (3): 4 days — need more frequent review
      // Good (4): 6 days — standard SM2
      // Easy (5): 8 days — confident, less frequent
      if (quality === 3) newInterval = 4;
      else if (quality === 5) newInterval = 8;
      else newInterval = 6;
    } else {
      // Quality-dependent multiplier:
      // Hard: capped slower growth (min 1.2x, or 80% of EF)
      // Good/Easy: standard EF (easy naturally has higher EF from +0.10/review)
      const multiplier = quality === 3
        ? Math.max(1.2, newEF * 0.8)
        : newEF;
      newInterval = Math.ceil(interval * multiplier);
      
      // Cap at maximum interval to prevent unreasonable long intervals (e.g., 10 years)
      newInterval = Math.min(newInterval, SM2_DEFAULTS.maxIntervalDays);
    }
  }

  return {
    easeFactor: Math.round(newEF * 100) / 100,
    interval: newInterval,
    repetition: newRepetition,
  };
}

export function deriveCardStatus(
  repetition: number,
  interval: number,
  consecutiveEasyCount: number,
  currentStatus: CardState['status']
): CardState['status'] {
  // Check retirement conditions
  // Condition 1: 5 consecutive "Easy" ratings
  if (consecutiveEasyCount >= 5) return 'retired';
  
  // Condition 2: After mastered, 3 consecutive "Easy" ratings
  if (currentStatus === 'mastered' && consecutiveEasyCount >= 3) return 'retired';
  
  if (repetition === 0) return 'learning';
  if (interval >= MASTERY_THRESHOLD_DAYS) return 'mastered';
  return 'review';
}

/**
 * Apply fuzz (random variation) to interval to prevent review clustering.
 * - For intervals > 7 days: ±20% variation
 * - For intervals 3-7 days: ±1 day variation
 * - For intervals < 3 days: no variation
 */
function applyIntervalFuzz(interval: number): number {
  if (interval < 3) return interval;
  
  if (interval <= 7) {
    // Small intervals: ±1 day
    const fuzz = Math.random() < 0.5 ? -1 : 1;
    return Math.max(interval + fuzz, interval - 1); // Ensure not less than interval-1
  }
  
  // Longer intervals: ±20% variation
  const fuzzRange = interval * 0.2;
  const fuzz = (Math.random() * 2 - 1) * fuzzRange; // Random value between -fuzzRange and +fuzzRange
  return Math.round(interval + fuzz);
}

export function calculateDueDate(interval: number, fromDate?: Date): string {
  const date = fromDate ? new Date(fromDate) : new Date();
  const fuzzedInterval = applyIntervalFuzz(interval);
  date.setDate(date.getDate() + fuzzedInterval);
  return date.toISOString().split('T')[0];
}

export function createInitialCardState(wordId: string): CardState {
  const today = new Date().toISOString().split('T')[0];
  return {
    wordId,
    easeFactor: SM2_DEFAULTS.initialEF,
    interval: 0,
    repetition: 0,
    dueDate: today,
    status: 'new',
    consecutiveEasyCount: 0,
  };
}
