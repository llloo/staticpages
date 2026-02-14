import type { CardState } from '../types';
import { getDueCardStates, getNewCardStates, getEnabledWordIds } from './storage';

export interface ScheduledQueue {
  reviewCards: CardState[];
  newCards: CardState[];
}

export async function getDueCards(
  dailyNewLimit: number,
  dailyReviewLimit: number,
  enabledListIds: string[]
): Promise<ScheduledQueue> {
  const today = new Date().toISOString().split('T')[0];
  const enabledWordIds = await getEnabledWordIds(enabledListIds);

  const reviewCards = await getDueCardStates(enabledWordIds, today, dailyReviewLimit);
  const newCards = await getNewCardStates(enabledWordIds, dailyNewLimit);

  return { reviewCards, newCards };
}
