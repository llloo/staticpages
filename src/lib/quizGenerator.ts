import type { Word } from '../types';
import { getAllCardStates, getAllWords } from './storage';

export interface MCQQuestion {
  type: 'mcq';
  wordId: string;
  questionText: string;
  phonetic?: string;
  audio?: string;
  correctAnswer: string;
  options: string[];
}

export interface SpellingQuestion {
  type: 'spelling';
  wordId: string;
  hint: string;
  correctAnswer: string;
  phonetic?: string;
  audio?: string;
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function getStudiedWords(): Promise<Word[]> {
  const allCards = await getAllCardStates();
  const studiedIds = new Set(
    allCards.filter((c) => c.status !== 'new').map((c) => c.wordId)
  );
  const allWords = await getAllWords();
  return allWords.filter((w) => studiedIds.has(w.id));
}

export async function generateMCQQuestions(
  count: number
): Promise<MCQQuestion[]> {
  const studiedWords = await getStudiedWords();
  if (studiedWords.length < 4) return [];

  const selected = shuffle(studiedWords).slice(0, count);
  const questions: MCQQuestion[] = [];

  for (const word of selected) {
    const correctAnswer = word.definitions[0].meaning;
    const distractors = shuffle(
      studiedWords.filter((w) => w.id !== word.id)
    )
      .slice(0, 3)
      .map((w) => w.definitions[0].meaning);

    questions.push({
      type: 'mcq',
      wordId: word.id,
      questionText: word.word,
      phonetic: word.phonetic,
      audio: word.audio,
      correctAnswer,
      options: shuffle([correctAnswer, ...distractors]),
    });
  }

  return questions;
}

export async function generateSpellingQuestions(
  count: number
): Promise<SpellingQuestion[]> {
  const studiedWords = await getStudiedWords();
  if (studiedWords.length === 0) return [];

  const selected = shuffle(studiedWords).slice(0, count);
  return selected.map((word) => ({
    type: 'spelling' as const,
    wordId: word.id,
    hint: word.definitions[0].meaning,
    correctAnswer: word.word,
    phonetic: word.phonetic,
    audio: word.audio,
  }));
}
