import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { Word, CardState, ReviewLog, QuizResult } from '../types';
import { DB_NAME, DB_VERSION } from '../constants';

interface VocabDB extends DBSchema {
  words: {
    key: string;
    value: Word;
    indexes: {
      'by-source': string;
      'by-listId': string;
    };
  };
  cardStates: {
    key: string;
    value: CardState;
    indexes: {
      'by-dueDate': string;
      'by-status': string;
    };
  };
  reviewLogs: {
    key: string;
    value: ReviewLog;
    indexes: {
      'by-date': string;
      'by-wordId': string;
    };
  };
  quizResults: {
    key: string;
    value: QuizResult;
    indexes: {
      'by-date': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<VocabDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<VocabDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VocabDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const wordStore = db.createObjectStore('words', { keyPath: 'id' });
        wordStore.createIndex('by-source', 'source');
        wordStore.createIndex('by-listId', 'listId');

        const cardStore = db.createObjectStore('cardStates', { keyPath: 'wordId' });
        cardStore.createIndex('by-dueDate', 'dueDate');
        cardStore.createIndex('by-status', 'status');

        const logStore = db.createObjectStore('reviewLogs', { keyPath: 'id' });
        logStore.createIndex('by-date', 'reviewDate');
        logStore.createIndex('by-wordId', 'wordId');

        const quizStore = db.createObjectStore('quizResults', { keyPath: 'id' });
        quizStore.createIndex('by-date', 'date');
      },
    });
  }
  return dbPromise;
}

export async function addWords(words: Word[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('words', 'readwrite');
  for (const word of words) {
    await tx.store.put(word);
  }
  await tx.done;
}

export async function getWord(id: string): Promise<Word | undefined> {
  const db = await getDB();
  return db.get('words', id);
}

export async function getAllWords(): Promise<Word[]> {
  const db = await getDB();
  return db.getAll('words');
}

export async function getAllUserWords(): Promise<Word[]> {
  const db = await getDB();
  return db.getAllFromIndex('words', 'by-source', 'user');
}

export async function getWordsByListId(listId: string): Promise<Word[]> {
  const db = await getDB();
  return db.getAllFromIndex('words', 'by-listId', listId);
}

export async function deleteWord(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['words', 'cardStates'], 'readwrite');
  await tx.objectStore('words').delete(id);
  await tx.objectStore('cardStates').delete(id);
  await tx.done;
}

export async function deleteWordsByListId(listId: string): Promise<void> {
  const db = await getDB();
  const words = await db.getAllFromIndex('words', 'by-listId', listId);
  const tx = db.transaction(['words', 'cardStates'], 'readwrite');
  for (const word of words) {
    await tx.objectStore('words').delete(word.id);
    await tx.objectStore('cardStates').delete(word.id);
  }
  await tx.done;
}

export async function getCardState(wordId: string): Promise<CardState | undefined> {
  const db = await getDB();
  return db.get('cardStates', wordId);
}

export async function getAllCardStates(): Promise<CardState[]> {
  const db = await getDB();
  return db.getAll('cardStates');
}

export async function upsertCardState(state: CardState): Promise<void> {
  const db = await getDB();
  await db.put('cardStates', state);
}

export async function batchUpsertCardStates(states: CardState[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cardStates', 'readwrite');
  for (const state of states) {
    await tx.store.put(state);
  }
  await tx.done;
}

export async function addReviewLog(log: ReviewLog): Promise<void> {
  const db = await getDB();
  await db.put('reviewLogs', log);
}

export async function getAllReviewLogs(): Promise<ReviewLog[]> {
  const db = await getDB();
  return db.getAll('reviewLogs');
}

export async function addQuizResult(result: QuizResult): Promise<void> {
  const db = await getDB();
  await db.put('quizResults', result);
}

export async function getAllQuizResults(): Promise<QuizResult[]> {
  const db = await getDB();
  return db.getAll('quizResults');
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['words', 'cardStates', 'reviewLogs', 'quizResults'],
    'readwrite'
  );
  await tx.objectStore('words').clear();
  await tx.objectStore('cardStates').clear();
  await tx.objectStore('reviewLogs').clear();
  await tx.objectStore('quizResults').clear();
  await tx.done;
}
