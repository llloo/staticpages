import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { getDueCards } from '../lib/scheduler';
import {
  calculateNextReview,
  deriveCardStatus,
  calculateDueDate,
} from '../lib/sm2';
import { getWordsByIds, upsertCardState, addReviewLog, getAllCardStates } from '../lib/storage';
import { loadSettings, updateStreak } from '../lib/exportImport';
import type { CardState, Word } from '../types';
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
  const transitionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    async function loadQueue() {
      const settings = await loadSettings();
      const { reviewCards, newCards } = await getDueCards(
        settings.dailyNewCardLimit,
        settings.dailyReviewLimit
      );
      const allCards = [...reviewCards, ...newCards];

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
        const allStates = await getAllCardStates();
        if (allStates.length === 0) {
          setHasWords(false);
        } else if (allStates.every((c) => c.status === 'mastered')) {
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

      const updatedCard: CardState = {
        ...cardState,
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetition: result.repetition,
        dueDate: newDueDate,
        lastReviewDate: new Date().toISOString().split('T')[0],
        status: deriveCardStatus(result.repetition, result.interval),
      };

      // Run API calls in parallel; streak is fire-and-forget
      await Promise.all([
        upsertCardState(updatedCard),
        addReviewLog({
          id: nanoid(),
          wordId: word.id,
          quality,
          reviewDate: new Date().toISOString(),
          previousInterval: cardState.interval,
          newInterval: result.interval,
          previousEF: cardState.easeFactor,
          newEF: result.easeFactor,
          mode: 'review',
        }),
      ]);
      updateStreak().catch(() => {});

      if (quality < 3) {
        setQueue((prev) => [
          ...prev,
          { cardState: updatedCard, word },
        ]);
      }

      setSessionStats((prev) => ({
        reviewed: prev.reviewed + 1,
        correct: quality >= 3 ? prev.correct + 1 : prev.correct,
        incorrect: quality < 3 ? prev.incorrect + 1 : prev.incorrect,
      }));

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
    [currentCard, currentIndex, queue.length, isTransitioning]
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
    if (result.interval < 365)
      return `${Math.round(result.interval / 30)}个月`;
    return `${Math.round(result.interval / 365)}年`;
  };

  if (loading) {
    return <div className="review-page"><div className="loading-text">加载中...</div></div>;
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

    return (
      <div className="review-page">
        <div className="review-complete">
          <div className="complete-icon">&#10003;</div>
          <h2>今日复习完成</h2>
          <div className="complete-stats">
            <div className="complete-stat">
              <span className="complete-stat-number">
                {sessionStats.reviewed}
              </span>
              <span className="complete-stat-label">已复习</span>
            </div>
            <div className="complete-stat">
              <span className="complete-stat-number correct">
                {sessionStats.correct}
              </span>
              <span className="complete-stat-label">记住</span>
            </div>
            <div className="complete-stat">
              <span className="complete-stat-number incorrect">
                {sessionStats.incorrect}
              </span>
              <span className="complete-stat-label">忘记</span>
            </div>
          </div>
          {sessionStats.reviewed > 0 && (
            <div className="complete-accuracy">
              正确率{' '}
              {Math.round(
                (sessionStats.correct / sessionStats.reviewed) * 100
              )}
              %
            </div>
          )}
          <button
            className="btn btn-primary btn-lg"
            onClick={() => window.location.reload()}
          >
            继续学习
          </button>
        </div>
      </div>
    );
  }

  if (!currentCard) return null;

  return (
    <div className="review-page">
      <div className="review-progress">
        <div className="progress-text">
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
          {QUALITY_BUTTONS.map((btn) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
