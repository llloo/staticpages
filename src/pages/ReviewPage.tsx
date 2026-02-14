import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { getDueCards } from '../lib/scheduler';
import {
  generateMCQFromWords,
  type MCQQuestion,
} from '../lib/quizGenerator';
import {
  calculateNextReview,
  deriveCardStatus,
  calculateDueDate,
} from '../lib/sm2';
import { getWordsByIds, batchUpsertCardStates, batchAddReviewLogs, upsertCardState, addReviewLog, getCardStatesByWordIds, getEnabledWordIds, getCardState, addQuizResult, getReviewLogsSince } from '../lib/storage';
import { loadSettings, updateStreak } from '../lib/exportImport';
import type { CardState, Word, ReviewLog } from '../types';
import AudioButton from '../components/AudioButton';
import './ReviewPage.css';

interface ReviewCard {
  cardState: CardState;
  word: Word;
}

const QUALITY_BUTTONS = [
  { label: '忘记', quality: 1, className: 'rating-forget' },
  { label: '困难', quality: 3, className: 'rating-hard' },
  { label: '良好', quality: 4, className: 'rating-good' },
  { label: '简单', quality: 5, className: 'rating-easy' },
];

const LS_TODAY_NEW_DONE = 'vocab_today_new_done';

export default function ReviewPage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    reviewed: 0,
    correct: 0,
    incorrect: 0,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [hasWords, setHasWords] = useState(true);
  const [allMastered, setAllMastered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionPhase, setSessionPhase] = useState<'learning' | 'reinforcing' | 'quizzing'>('learning');
  const sessionWordsRef = useRef<Map<string, ReviewCard>>(new Map());
  const sessionQualitiesRef = useRef<Map<string, number>>(new Map());
  const [reinforceStats, setReinforceStats] = useState({ reviewed: 0, correct: 0, incorrect: 0 });
  const [quizQuestions, setQuizQuestions] = useState<MCQQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizShowResult, setQuizShowResult] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [isStartingReinforce, setIsStartingReinforce] = useState(false);
  const quizStartTime = useRef(0);
  const quizWrongIdsRef = useRef<string[]>([]);
  const hadNewCardsRef = useRef(false);
  const [todayLogWordCount, setTodayLogWordCount] = useState(0);
  const transitionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingCardStatesRef = useRef<CardState[]>([]);
  const pendingReviewLogsRef = useRef<ReviewLog[]>([]);

  const flushPendingUpdates = useCallback(async () => {
    const cardStates = pendingCardStatesRef.current;
    const reviewLogs = pendingReviewLogsRef.current;

    if (cardStates.length === 0 && reviewLogs.length === 0) return;

    // Deduplicate card states — keep only the latest per wordId
    const stateMap = new Map<string, CardState>();
    for (const state of cardStates) {
      stateMap.set(state.wordId, state);
    }

    await Promise.all([
      batchUpsertCardStates(Array.from(stateMap.values())),
      batchAddReviewLogs(reviewLogs),
    ]);

    // Only clear refs after successful write (so data isn't lost on failure)
    pendingCardStatesRef.current = [];
    pendingReviewLogsRef.current = [];

    updateStreak().catch(() => {});
  }, []);

  useEffect(() => {
    async function loadQueue() {
      const settings = await loadSettings();
      const today = new Date().toISOString().split('T')[0];
      const todayNewDone = localStorage.getItem(LS_TODAY_NEW_DONE) === today;

      const newLimit = todayNewDone ? 0 : settings.dailyNewCardLimit;
      const { reviewCards, newCards } = await getDueCards(
        newLimit,
        settings.dailyReviewLimit,
        settings.enabledListIds
      );
      
      const todayLogs = await getReviewLogsSince(today);
      const todayWordIds = [...new Set(todayLogs.map((l) => l.wordId))];
      const todayWordIdSet = new Set(todayWordIds);
      setTodayLogWordCount(todayWordIds.length);

      // Exclude already-learned words from today's session
      const filteredNewCards = newCards.filter((c) => !todayWordIdSet.has(c.wordId));
      const allCards = [...reviewCards, ...filteredNewCards];
      hadNewCardsRef.current = filteredNewCards.length > 0;

      // Restore session words from today's review logs
      if (todayWordIds.length > 0) {
        const todayCardStates = await getCardStatesByWordIds(todayWordIds);
        const stateMap = new Map(todayCardStates.map((s) => [s.wordId, s]));
        const todayWords = await getWordsByIds(todayWordIds);
        
        for (const wordId of todayWordIds) {
          const word = todayWords.get(wordId);
          const card = stateMap.get(wordId);
          if (word && card) {
            sessionWordsRef.current.set(wordId, { cardState: card, word });
            const wordLogs = todayLogs.filter((l) => l.wordId === wordId);
            const worstQuality = Math.min(...wordLogs.map((l) => l.quality));
            sessionQualitiesRef.current.set(wordId, worstQuality);
          }
        }
      }

      // Batch load all words in a single query
      const wordIds = allCards.map((c) => c.wordId);
      const wordMap = await getWordsByIds(wordIds);

      const reviewQueue: ReviewCard[] = [];
      for (const card of allCards) {
        const word = wordMap.get(card.wordId);
        if (word) {
          reviewQueue.push({ cardState: card, word });
        }
      }

      setQueue(reviewQueue);
      if (reviewQueue.length === 0) {
        // If today's new words are done and we have session words, go straight to completion
        if (todayNewDone && sessionWordsRef.current.size > 0) {
          setIsComplete(true);
          setLoading(false);
          return;
        }
        const enabledWordIds = await getEnabledWordIds(settings.enabledListIds);
        if (enabledWordIds.size === 0) {
          setHasWords(false);
        } else {
          // If we have enabled words but no cards to review, likely all mastered
          setAllMastered(true);
        }
        setIsComplete(true);
      }
      setLoading(false);
    }
    loadQueue();
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, []);

  // Flush pending data and mark today's new learning done (only after successful persistence)
  useEffect(() => {
    if (!isComplete) return;

    (async () => {
      await flushPendingUpdates();
      
      // Load all today's words into sessionWordsRef for reinforcement/quiz
      if (sessionPhase === 'learning') {
        const today = new Date().toISOString().split('T')[0];
        const todayLogs = await getReviewLogsSince(today);
        const todayWordIds = [...new Set(todayLogs.map((l) => l.wordId))];
        setTodayLogWordCount(todayWordIds.length);
        const settings = await loadSettings();
        const enabledWordIds = await getEnabledWordIds(settings.enabledListIds);
        
        if (todayWordIds.length > 0) {
          const todayWords = await getWordsByIds(todayWordIds);
          const todayCardStates = await getCardStatesByWordIds(todayWordIds);
          const stateMap = new Map(todayCardStates.map((s) => [s.wordId, s]));
          
          for (const wordId of todayWordIds) {
            const word = todayWords.get(wordId);
            const card = stateMap.get(wordId);
            if (word && card && enabledWordIds.has(wordId)) {
              // Update sessionWordsRef with the latest state
              sessionWordsRef.current.set(wordId, { cardState: card, word });
              
              // Track worst quality for this word (if not already tracked)
              if (!sessionQualitiesRef.current.has(wordId)) {
                const wordLogs = todayLogs.filter((l) => l.wordId === wordId);
                const worstQuality = Math.min(...wordLogs.map((l) => l.quality));
                sessionQualitiesRef.current.set(wordId, worstQuality);
              }
            }
          }
        }
        
        // Only set the flag after data is safely persisted
        if (hadNewCardsRef.current) {
          localStorage.setItem(LS_TODAY_NEW_DONE, today);
        }
      }
    })().catch(() => {});
  }, [isComplete, flushPendingUpdates, sessionPhase]);

  // Best-effort flush on unmount (e.g. navigating away mid-session)
  useEffect(() => {
    return () => {
      flushPendingUpdates();
    };
  }, [flushPendingUpdates]);

  const currentCard = queue[currentIndex];

  const handleFlip = () => {
    if (isTransitioning) return;
    setIsFlipped((prev) => !prev);
  };

  const handleRating = useCallback(
    async (quality: number) => {
      if (!currentCard || isTransitioning) return;

      const { cardState, word } = currentCard;
      const result = calculateNextReview(
        quality,
        cardState.repetition,
        cardState.easeFactor,
        cardState.interval
      );
      const newDueDate = calculateDueDate(result.interval);

      // Track consecutive "Easy" (quality=5) ratings
      const newConsecutiveEasyCount = quality === 5 
        ? (cardState.consecutiveEasyCount || 0) + 1 
        : 0;

      const updatedCard: CardState = {
        ...cardState,
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetition: result.repetition,
        dueDate: newDueDate,
        lastReviewDate: new Date().toISOString().split('T')[0],
        consecutiveEasyCount: newConsecutiveEasyCount,
        status: deriveCardStatus(result.repetition, result.interval, newConsecutiveEasyCount, cardState.status),
      };

      // Buffer updates for batch flush at phase completion
      pendingCardStatesRef.current.push(updatedCard);
      pendingReviewLogsRef.current.push({
        id: nanoid(),
        wordId: word.id,
        quality,
        reviewDate: new Date().toISOString(),
        previousInterval: cardState.interval,
        newInterval: result.interval,
        previousEF: cardState.easeFactor,
        newEF: result.easeFactor,
        mode: 'review',
      });

      // Track session words for reinforcement (keep latest card state, track worst quality)
      sessionWordsRef.current.set(word.id, { cardState: updatedCard, word });
      const prevQuality = sessionQualitiesRef.current.get(word.id);
      if (prevQuality === undefined || quality < prevQuality) {
        sessionQualitiesRef.current.set(word.id, quality);
      }
      
      if (quality < 3) {
        setQueue((prev) => [
          ...prev,
          { cardState: updatedCard, word },
        ]);
      }

      const statsUpdate = {
        reviewed: 1,
        correct: quality >= 3 ? 1 : 0,
        incorrect: quality < 3 ? 1 : 0,
      };
      if (sessionPhase === 'reinforcing') {
        setReinforceStats((prev) => ({
          reviewed: prev.reviewed + statsUpdate.reviewed,
          correct: prev.correct + statsUpdate.correct,
          incorrect: prev.incorrect + statsUpdate.incorrect,
        }));
      } else {
        setSessionStats((prev) => ({
          reviewed: prev.reviewed + statsUpdate.reviewed,
          correct: prev.correct + statsUpdate.correct,
          incorrect: prev.incorrect + statsUpdate.incorrect,
        }));
      }

      // Fade out then advance
      setIsTransitioning(true);
      setIsFlipped(false);

      transitionTimer.current = setTimeout(() => {
        if (currentIndex + 1 >= queue.length && quality >= 3) {
          setIsComplete(true);
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
        setIsTransitioning(false);
      }, 350);
    },
    [currentCard, currentIndex, queue.length, isTransitioning, sessionPhase]
  );

  const getProjectedInterval = (quality: number): string => {
    if (!currentCard) return '';
    const { cardState } = currentCard;
    const result = calculateNextReview(
      quality,
      cardState.repetition,
      cardState.easeFactor,
      cardState.interval
    );
    if (result.interval === 0) return '< 1天';
    if (result.interval === 1) return '1天';
    if (result.interval < 30) return `${result.interval}天`;
    const months = Math.round(result.interval / 30);
    return `${months}个月`;
  };

  const handleNextCard = useCallback(() => {
    if (!currentCard || isTransitioning) return;

    // In reinforcing phase, just count as reviewed without updating card state
    setReinforceStats((prev) => ({
      reviewed: prev.reviewed + 1,
      correct: prev.correct,
      incorrect: prev.incorrect,
    }));

    // Fade out then advance
    setIsTransitioning(true);
    setIsFlipped(false);

    transitionTimer.current = setTimeout(() => {
      if (currentIndex + 1 >= queue.length) {
        setIsComplete(true);
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
      setIsTransitioning(false);
    }, 350);
  }, [currentCard, currentIndex, queue.length, isTransitioning]);

  const startReinforcement = useCallback(async () => {
    if (isStartingReinforce) return;
    setIsStartingReinforce(true);

    await flushPendingUpdates();

    let words = Array.from(sessionWordsRef.current.values());

    if (words.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const todayLogs = await getReviewLogsSince(today);
      const todayWordIds = [...new Set(todayLogs.map((l) => l.wordId))];
      if (todayWordIds.length === 0) return;

      const allStates = await getCardStatesByWordIds(todayWordIds);
      const stateMap = new Map(allStates.map((s) => [s.wordId, s]));
      const todayWords = await getWordsByIds(todayWordIds);

      sessionWordsRef.current.clear();
      sessionQualitiesRef.current.clear();

      const loadedWords: ReviewCard[] = [];
      for (const wordId of todayWordIds) {
        const word = todayWords.get(wordId);
        const card = stateMap.get(wordId);
        if (!word || !card) continue;
        loadedWords.push({ cardState: card, word });
        sessionWordsRef.current.set(wordId, { cardState: card, word });
        const wordLogs = todayLogs.filter((l) => l.wordId === wordId);
        const worstQuality = Math.min(...wordLogs.map((l) => l.quality));
        sessionQualitiesRef.current.set(wordId, worstQuality);
      }

      words = loadedWords;
    }

    if (words.length === 0) {
      setIsStartingReinforce(false);
      return;
    }

    const qualities = sessionQualitiesRef.current;
    // Sort: difficult words first (low quality), then shuffle within same tier
    const sorted = [...words].sort((a, b) => {
      const qa = qualities.get(a.word.id) ?? 5;
      const qb = qualities.get(b.word.id) ?? 5;
      if (qa !== qb) return qa - qb;
      return Math.random() - 0.5;
    });

    setQueue(sorted);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsComplete(false);
    setIsTransitioning(false);
    setSessionPhase('reinforcing');
    setReinforceStats({ reviewed: 0, correct: 0, incorrect: 0 });
    setIsStartingReinforce(false);
  }, [flushPendingUpdates, isStartingReinforce]);

  const canReinforce = todayLogWordCount > 0;
  const canQuiz = todayLogWordCount >= 4;

  const startQuiz = useCallback(() => {
    const words = Array.from(sessionWordsRef.current.values()).map((r) => r.word);
    const questions = generateMCQFromWords(words, Math.min(words.length, 10));
    if (questions.length === 0) return;

    setQuizQuestions(questions);
    setQuizIndex(0);
    setQuizSelected(null);
    setQuizShowResult(false);
    setQuizCorrect(0);
    setQuizTotal(questions.length);
    quizStartTime.current = Date.now();
    quizWrongIdsRef.current = [];
    setSessionPhase('quizzing');
    setIsComplete(false);
  }, []);

  const recordQuizAnswer = useCallback(async (wordId: string, isCorrect: boolean) => {
    const quality = isCorrect ? 4 : 1;
    const card = await getCardState(wordId);
    if (card) {
      const result = calculateNextReview(quality, card.repetition, card.easeFactor, card.interval);
      
      // Quiz mode: only reset count on wrong answer, preserve on correct
      const newConsecutiveEasyCount = quality < 3 ? 0 : (card.consecutiveEasyCount || 0);
      
      const updatedCard: CardState = {
        ...card,
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetition: result.repetition,
        dueDate: calculateDueDate(result.interval),
        lastReviewDate: new Date().toISOString().split('T')[0],
        consecutiveEasyCount: newConsecutiveEasyCount,
        status: deriveCardStatus(result.repetition, result.interval, newConsecutiveEasyCount, card.status),
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
    updateStreak().catch(() => {});
  }, []);

  const handleQuizSelect = useCallback(async (answer: string) => {
    if (quizShowResult) return;
    setQuizSelected(answer);
    setQuizShowResult(true);
    const q = quizQuestions[quizIndex];
    const isCorrect = answer === q.correctAnswer;
    if (isCorrect) {
      setQuizCorrect((c) => c + 1);
    } else {
      quizWrongIdsRef.current.push(q.wordId);
    }
    await recordQuizAnswer(q.wordId, isCorrect);
  }, [quizShowResult, quizQuestions, quizIndex, recordQuizAnswer]);

  const handleQuizNext = useCallback(async () => {
    if (quizIndex + 1 >= quizTotal) {
      const duration = Math.round((Date.now() - quizStartTime.current) / 1000);
      await addQuizResult({
        id: nanoid(),
        date: new Date().toISOString(),
        mode: 'mcq',
        totalQuestions: quizTotal,
        correctCount: quizCorrect,
        wrongWordIds: quizWrongIdsRef.current,
        durationSeconds: duration,
      });
      setIsComplete(true);
    } else {
      setQuizIndex((i) => i + 1);
      setQuizSelected(null);
      setQuizShowResult(false);
    }
  }, [quizIndex, quizTotal, quizCorrect]);

  if (loading) {
    return (
      <div className="review-page">
        <div className="review-progress">
          <div className="progress-text"><span className="skeleton-text" style={{ width: 48 }} /></div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: 0 }} /></div>
        </div>
        <div className="flashcard-container">
          <div className="flashcard">
            <div className="flashcard-front">
              <div className="skeleton-text" style={{ width: 120, height: 28, margin: '0 auto' }} />
              <div className="skeleton-text" style={{ width: 80, height: 16, margin: '8px auto 0' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isComplete) {
    if (!hasWords && sessionStats.reviewed === 0) {
      return (
        <div className="review-page">
          <div className="review-empty">
            <div className="empty-icon">📚</div>
            <h2>还没有单词</h2>
            <p className="empty-desc">先去词库添加或启用单词吧</p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/words')}
            >
              管理词库
            </button>
          </div>
        </div>
      );
    }

    if (allMastered && sessionStats.reviewed === 0) {
      return (
        <div className="review-page">
          <div className="review-complete">
            <div className="complete-icon">&#127942;</div>
            <h2>全部掌握！</h2>
            <p className="empty-desc">当前词库的所有单词都已掌握，去添加更多单词吧</p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/words')}
            >
              管理词库
            </button>
          </div>
        </div>
      );
    }

    const isQuizzing = sessionPhase === 'quizzing';
    const isReinforcing = sessionPhase === 'reinforcing';
    const stats = isReinforcing ? reinforceStats : sessionStats;

    if (isQuizzing) {
      return (
        <div className="review-page">
          <div className="review-complete">
            <div className="complete-icon">&#10003;</div>
            <h2>测验完成</h2>
            <div className="complete-stats">
              <div className="complete-stat">
                <span className="complete-stat-number correct">{quizCorrect}</span>
                <span className="complete-stat-label">正确</span>
              </div>
              <div className="complete-stat">
                <span className="complete-stat-number incorrect">{quizTotal - quizCorrect}</span>
                <span className="complete-stat-label">错误</span>
              </div>
            </div>
            {quizTotal > 0 && (
              <div className="complete-accuracy">
                正确率 {Math.round((quizCorrect / quizTotal) * 100)}%
              </div>
            )}
            <div className="complete-actions">
              <div className="complete-actions-row">
                {canReinforce && (
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={startReinforcement}
                    disabled={isStartingReinforce}
                  >
                    {isStartingReinforce ? '准备中...' : '巩固复习'}
                  </button>
                )}
                {canQuiz && (
                  <button className={`btn ${canReinforce ? 'btn-outline' : 'btn-primary'} btn-lg`} onClick={startQuiz}>
                    再测一轮
                  </button>
                )}
              </div>
              <button className="btn-secondary-link" onClick={() => {
                localStorage.removeItem(LS_TODAY_NEW_DONE);
                window.location.reload();
              }}>
                学习新词
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="review-page">
        <div className="review-complete">
          <div className="complete-icon">&#10003;</div>
          <h2>{isReinforcing ? '巩固完成' : '学习完成'}</h2>
          <div className="complete-stats">
            <div className="complete-stat">
              <span className="complete-stat-number">
                {stats.reviewed}
              </span>
              <span className="complete-stat-label">已复习</span>
            </div>
            {!isReinforcing && (
              <>
                <div className="complete-stat">
                  <span className="complete-stat-number correct">
                    {stats.correct}
                  </span>
                  <span className="complete-stat-label">记住</span>
                </div>
                <div className="complete-stat">
                  <span className="complete-stat-number incorrect">
                    {stats.incorrect}
                  </span>
                  <span className="complete-stat-label">忘记</span>
                </div>
              </>
            )}
          </div>
          {stats.reviewed > 0 && !isReinforcing && (
            <div className="complete-accuracy">
              正确率{' '}
              {Math.round(
                (stats.correct / stats.reviewed) * 100
              )}
              %
            </div>
          )}
          <div className="complete-actions">
            <div className="complete-actions-row">
              {canReinforce && (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={startReinforcement}
                  disabled={isStartingReinforce}
                >
                  {isStartingReinforce ? '准备中...' : (isReinforcing ? '再次巩固' : '巩固复习')}
                </button>
              )}
              {canQuiz && (
                <button
                  className={`btn ${canReinforce ? 'btn-outline' : 'btn-primary'} btn-lg`}
                  onClick={startQuiz}
                >
                  快速测验
                </button>
              )}
            </div>
            <button
              className="btn-secondary-link"
              onClick={() => {
                localStorage.removeItem(LS_TODAY_NEW_DONE);
                window.location.reload();
              }}
            >
              学习新词
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sessionPhase === 'quizzing' && !isComplete) {
    const q = quizQuestions[quizIndex];
    if (!q) return null;
    return (
      <div className="review-page">
        <div className="review-progress">
          <div className="progress-text">
            <span className="phase-badge">快速测验</span>
            {quizIndex + 1} / {quizTotal}
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((quizIndex + 1) / quizTotal) * 100}%` }}
            />
          </div>
        </div>
        <div className="inline-quiz">
          <div className="inline-quiz-question">
            <div className="flashcard-word-row">
              <div className="flashcard-word">{q.questionText}</div>
              <AudioButton audioFile={q.audio} size="large" />
            </div>
            {q.phonetic && <div className="flashcard-phonetic">{q.phonetic}</div>}
          </div>
          <div className="inline-quiz-options">
            {q.options.map((option, i) => {
              let cls = 'inline-quiz-option';
              if (quizShowResult) {
                if (option === q.correctAnswer) cls += ' correct';
                else if (option === quizSelected) cls += ' wrong';
              }
              return (
                <button
                  key={i}
                  className={cls}
                  onClick={() => handleQuizSelect(option)}
                  disabled={quizShowResult}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {quizShowResult && (
            <button className="btn btn-primary btn-block" onClick={handleQuizNext}>
              {quizIndex + 1 >= quizTotal ? '查看结果' : '下一题'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!currentCard) return null;

  return (
    <div className="review-page">
      <div className="review-progress">
        <div className="progress-text">
          {sessionPhase === 'reinforcing' && <span className="phase-badge">巩固复习</span>}
          {currentIndex + 1} / {queue.length}
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${((currentIndex + 1) / queue.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="flashcard-container" onClick={handleFlip}>
        <div className="flashcard">
          <div className={`flashcard-front ${isFlipped ? 'hidden' : ''}`}>
            <div className="flashcard-word-row">
              <div className="flashcard-word">{currentCard.word.word}</div>
              <AudioButton audioFile={currentCard.word.audio} size="large" />
            </div>
            {currentCard.word.phonetic && (
              <div className="flashcard-phonetic">
                {currentCard.word.phonetic}
              </div>
            )}
            <div className="flip-hint">点击查看释义</div>
          </div>
          <div className={`flashcard-back ${isFlipped ? '' : 'hidden'}`}>
            <div className="flashcard-word-row">
              <div className="flashcard-word-small">
                {currentCard.word.word}
              </div>
              <AudioButton audioFile={currentCard.word.audio} size="medium" />
            </div>
            <div className="flashcard-definitions">
              {currentCard.word.definitions.map((def, i) => (
                <div key={i} className="definition-item">
                  {def.pos && <span className="definition-pos">{def.pos}</span>}
                  <span className="definition-meaning">
                    {def.meaning}
                  </span>
                </div>
              ))}
            </div>
            {currentCard.word.example && (
              <div className="flashcard-example">
                {currentCard.word.example}
              </div>
            )}
            {currentCard.word.example_cn && (
              <div className="flashcard-example-cn">
                {currentCard.word.example_cn}
              </div>
            )}
          </div>
        </div>
      </div>

      {isFlipped && !isTransitioning && (
        <div className="rating-buttons">
          {sessionPhase === 'reinforcing' ? (
            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={handleNextCard}
              style={{ margin: '0 auto', maxWidth: '300px' }}
            >
              下一个
            </button>
          ) : (
            QUALITY_BUTTONS.map((btn) => (
              <button
                key={btn.quality}
                className={`rating-btn ${btn.className}`}
                onClick={() => handleRating(btn.quality)}
              >
                <span className="rating-label">{btn.label}</span>
                <span className="rating-interval">
                  {getProjectedInterval(btn.quality)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
