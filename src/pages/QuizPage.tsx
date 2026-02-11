import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import {
  generateMCQQuestions,
  generateSpellingQuestions,
  type MCQQuestion,
  type SpellingQuestion,
} from '../lib/quizGenerator';
import {
  calculateNextReview,
  deriveCardStatus,
  calculateDueDate,
} from '../lib/sm2';
import {
  getCardState,
  upsertCardState,
  addReviewLog,
  addQuizResult,
} from '../lib/storage';
import { updateStreak } from '../lib/exportImport';
import type { CardState } from '../types';
import AudioButton from '../components/AudioButton';
import './QuizPage.css';

type QuizMode = 'mcq' | 'spelling';

export default function QuizPage() {
  const [mode, setMode] = useState<QuizMode>('mcq');
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
  const [spellingQuestions, setSpellingQuestions] = useState<SpellingQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [spellingInput, setSpellingInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [, setWrong] = useState(0);
  const [wrongWordIds, setWrongWordIds] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startTime] = useState(Date.now());
  const [noWords, setNoWords] = useState(false);

  const loadQuestions = useCallback(async (quizMode: QuizMode) => {
    setLoading(true);
    setCurrentIndex(0);
    setCorrect(0);
    setWrong(0);
    setWrongWordIds([]);
    setIsComplete(false);
    setSelectedAnswer(null);
    setSpellingInput('');
    setShowResult(false);

    if (quizMode === 'mcq') {
      const questions = await generateMCQQuestions(10);
      if (questions.length === 0) {
        setNoWords(true);
      } else {
        setMcqQuestions(questions);
        setNoWords(false);
      }
    } else {
      const questions = await generateSpellingQuestions(10);
      if (questions.length === 0) {
        setNoWords(true);
      } else {
        setSpellingQuestions(questions);
        setNoWords(false);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadQuestions(mode);
  }, [mode, loadQuestions]);

  const questions = mode === 'mcq' ? mcqQuestions : spellingQuestions;
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  const recordQuizAnswer = async (wordId: string, isCorrect: boolean) => {
    const quality = isCorrect ? 4 : 1;
    const card = await getCardState(wordId);
    if (card) {
      const result = calculateNextReview(
        quality,
        card.repetition,
        card.easeFactor,
        card.interval
      );
      const updatedCard: CardState = {
        ...card,
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetition: result.repetition,
        dueDate: calculateDueDate(result.interval),
        lastReviewDate: new Date().toISOString().split('T')[0],
        status: deriveCardStatus(result.repetition, result.interval),
      };
      await upsertCardState(updatedCard);
      await addReviewLog({
        id: nanoid(),
        wordId,
        quality,
        reviewDate: new Date().toISOString(),
        previousInterval: card.interval,
        newInterval: result.interval,
        previousEF: card.easeFactor,
        newEF: result.easeFactor,
        mode: 'quiz',
      });
    }
    await updateStreak();
  };

  const handleMCQSelect = async (answer: string) => {
    if (showResult) return;
    setSelectedAnswer(answer);
    setShowResult(true);

    const q = currentQuestion as MCQQuestion;
    const isCorrect = answer === q.correctAnswer;

    if (isCorrect) {
      setCorrect((c) => c + 1);
    } else {
      setWrong((w) => w + 1);
      setWrongWordIds((ids) => [...ids, q.wordId]);
    }
    await recordQuizAnswer(q.wordId, isCorrect);
  };

  const handleSpellingSubmit = async () => {
    if (showResult) return;
    setShowResult(true);

    const q = currentQuestion as SpellingQuestion;
    const isCorrect =
      spellingInput.trim().toLowerCase() === q.correctAnswer.toLowerCase();

    if (isCorrect) {
      setCorrect((c) => c + 1);
    } else {
      setWrong((w) => w + 1);
      setWrongWordIds((ids) => [...ids, q.wordId]);
    }
    await recordQuizAnswer(q.wordId, isCorrect);
  };

  const handleNext = async () => {
    if (currentIndex + 1 >= totalQuestions) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      await addQuizResult({
        id: nanoid(),
        date: new Date().toISOString(),
        mode,
        totalQuestions,
        correctCount: correct,
        wrongWordIds,
        durationSeconds: duration,
      });
      setIsComplete(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setSpellingInput('');
      setShowResult(false);
    }
  };

  if (loading) {
    return <div className="loading">准备题目中...</div>;
  }

  if (noWords) {
    return (
      <div className="quiz-empty">
        <h2>暂无可测验的单词</h2>
        <p className="text-secondary">
          {mode === 'mcq'
            ? '选择题至少需要学习 4 个单词'
            : '请先学习一些单词再来测验'}
        </p>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="quiz-complete">
        <h2>测验完成</h2>
        <div className="quiz-score">
          <span className="score-number">
            {correct}/{totalQuestions}
          </span>
          <span className="score-label">
            正确率 {Math.round((correct / totalQuestions) * 100)}%
          </span>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => loadQuestions(mode)}
        >
          再来一轮
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <div className="quiz-tabs">
          <button
            className={`quiz-tab ${mode === 'mcq' ? 'active' : ''}`}
            onClick={() => setMode('mcq')}
          >
            选择题
          </button>
          <button
            className={`quiz-tab ${mode === 'spelling' ? 'active' : ''}`}
            onClick={() => setMode('spelling')}
          >
            拼写题
          </button>
        </div>
        <div className="quiz-progress">
          {currentIndex + 1} / {totalQuestions}
        </div>
      </div>

      {mode === 'mcq' && currentQuestion && (
        <div className="mcq-section">
          <div className="mcq-question">
            <div className="mcq-word-row">
              <div className="mcq-word">
                {(currentQuestion as MCQQuestion).questionText}
              </div>
              <AudioButton audioFile={(currentQuestion as MCQQuestion).audio} size="large" />
            </div>
            {(currentQuestion as MCQQuestion).phonetic && (
              <div className="mcq-phonetic">
                {(currentQuestion as MCQQuestion).phonetic}
              </div>
            )}
          </div>
          <div className="mcq-options">
            {(currentQuestion as MCQQuestion).options.map((option, i) => {
              let optionClass = 'mcq-option';
              if (showResult) {
                if (
                  option ===
                  (currentQuestion as MCQQuestion).correctAnswer
                ) {
                  optionClass += ' correct';
                } else if (option === selectedAnswer) {
                  optionClass += ' wrong';
                }
              } else if (option === selectedAnswer) {
                optionClass += ' selected';
              }
              return (
                <button
                  key={i}
                  className={optionClass}
                  onClick={() => handleMCQSelect(option)}
                  disabled={showResult}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === 'spelling' && currentQuestion && (
        <div className="spelling-section">
          <div className="spelling-hint">
            {(currentQuestion as SpellingQuestion).hint}
          </div>
          <div className="spelling-audio-row">
            {(currentQuestion as SpellingQuestion).phonetic && (
              <div className="spelling-phonetic">
                {(currentQuestion as SpellingQuestion).phonetic}
              </div>
            )}
            <AudioButton audioFile={(currentQuestion as SpellingQuestion).audio} size="medium" />
          </div>
          <input
            className="input spelling-input"
            type="text"
            value={spellingInput}
            onChange={(e) => setSpellingInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !showResult) handleSpellingSubmit();
              if (e.key === 'Enter' && showResult) handleNext();
            }}
            placeholder="输入英文单词..."
            disabled={showResult}
            autoFocus
          />
          {showResult && (
            <div
              className={`spelling-result ${
                spellingInput.trim().toLowerCase() ===
                (currentQuestion as SpellingQuestion).correctAnswer.toLowerCase()
                  ? 'correct'
                  : 'wrong'
              }`}
            >
              {spellingInput.trim().toLowerCase() ===
              (currentQuestion as SpellingQuestion).correctAnswer.toLowerCase()
                ? '正确!'
                : `正确答案: ${(currentQuestion as SpellingQuestion).correctAnswer}`}
            </div>
          )}
          {!showResult && (
            <button
              className="btn btn-primary btn-block"
              onClick={handleSpellingSubmit}
            >
              确认
            </button>
          )}
        </div>
      )}

      {showResult && (
        <button className="btn btn-primary btn-block" onClick={handleNext}>
          {currentIndex + 1 >= totalQuestions ? '查看结果' : '下一题'}
        </button>
      )}
    </div>
  );
}
