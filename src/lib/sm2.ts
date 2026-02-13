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
  interval: number
): CardState['status'] {
  if (repetition === 0) return 'learning';
  if (interval >= MASTERY_THRESHOLD_DAYS) return 'mastered';
  return 'review';
}

export function calculateDueDate(interval: number, fromDate?: Date): string {
  const date = fromDate ? new Date(fromDate) : new Date();
  date.setDate(date.getDate() + interval);
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
  };
}
