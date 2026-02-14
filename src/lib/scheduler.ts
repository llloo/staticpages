import type { CardState } from '../types';
import { getCardStatesByWordIds, getEnabledWordIds } from './storage';

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
  const allCards = await getCardStatesByWordIds(Array.from(enabledWordIds));

  const reviewCards = allCards
    .filter((c) => c.dueDate <= today && c.status !== 'new' && c.status !== 'retired')
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return a.easeFactor - b.easeFactor;
    })
    .slice(0, dailyReviewLimit);

  const newCards = allCards
    .filter((c) => c.status === 'new')
    .slice(0, dailyNewLimit);

  return { reviewCards, newCards };
}
