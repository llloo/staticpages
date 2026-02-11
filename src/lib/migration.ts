import { supabase } from './supabase';
import { STORAGE_KEYS } from '../constants';
import { getDB } from './storage-legacy';
import type { UserSettings, StreakData } from '../types';

export async function checkLocalData(): Promise<boolean> {
  try {
    const db = await getDB();
    const wordCount = await db.count('words');
    const cardCount = await db.count('cardStates');
    return wordCount > 0 || cardCount > 0;
  } catch {
    return false;
  }
}

export async function migrateLocalDataToSupabase(): Promise<{
  migrated: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { migrated: false, errors: ['用户未登录'] };
    }

    const db = await getDB();

    // 1. Migrate user words
    const words = await db.getAll('words');
    if (words.length > 0) {
      const userWords = words.filter((w) => w.source === 'user');
      if (userWords.length > 0) {
        const rows = userWords.map((w) => ({
          id: w.id,
          user_id: user.id,
          word: w.word,
          phonetic: w.phonetic || null,
          audio: w.audio || null,
          definitions: w.definitions,
          example: w.example || null,
          tags: w.tags || [],
          source: w.source,
          list_id: w.listId || null,
        }));

        const { error } = await supabase.from('words').upsert(rows);
        if (error) errors.push(`单词迁移失败: ${error.message}`);
      }
    }

    // 2. Migrate card states
    const cardStates = await db.getAll('cardStates');
    if (cardStates.length > 0) {
      const rows = cardStates.map((cs) => ({
        word_id: cs.wordId,
        user_id: user.id,
        ease_factor: cs.easeFactor,
        interval: cs.interval,
        repetition: cs.repetition,
        due_date: cs.dueDate,
        last_review_date: cs.lastReviewDate || null,
        status: cs.status,
      }));

      const { error } = await supabase.from('card_states').upsert(rows);
      if (error) errors.push(`卡片状态迁移失败: ${error.message}`);
    }

    // 3. Migrate review logs in batches
    const reviewLogs = await db.getAll('reviewLogs');
    if (reviewLogs.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < reviewLogs.length; i += batchSize) {
        const batch = reviewLogs.slice(i, i + batchSize).map((rl) => ({
          id: rl.id,
          user_id: user.id,
          word_id: rl.wordId,
          quality: rl.quality,
          review_date: rl.reviewDate,
          previous_interval: rl.previousInterval,
          new_interval: rl.newInterval,
          previous_ef: rl.previousEF,
          new_ef: rl.newEF,
          mode: rl.mode,
        }));

        const { error } = await supabase.from('review_logs').insert(batch);
        if (error) errors.push(`复习日志迁移失败: ${error.message}`);
      }
    }

    // 4. Migrate quiz results
    const quizResults = await db.getAll('quizResults');
    if (quizResults.length > 0) {
      const rows = quizResults.map((qr) => ({
        id: qr.id,
        user_id: user.id,
        date: qr.date,
        mode: qr.mode,
        total_questions: qr.totalQuestions,
        correct_count: qr.correctCount,
        wrong_word_ids: qr.wrongWordIds,
        duration_seconds: qr.durationSeconds,
      }));

      const { error } = await supabase.from('quiz_results').insert(rows);
      if (error) errors.push(`测验结果迁移失败: ${error.message}`);
    }

    // 5. Migrate settings
    const settingsRaw = localStorage.getItem(STORAGE_KEYS.settings);
    if (settingsRaw) {
      try {
        const settings: UserSettings = JSON.parse(settingsRaw);
        const { error } = await supabase.from('user_settings').upsert({
          user_id: user.id,
          daily_new_card_limit: settings.dailyNewCardLimit,
          daily_review_limit: settings.dailyReviewLimit,
          enabled_list_ids: settings.enabledListIds,
        });
        if (error) errors.push(`设置迁移失败: ${error.message}`);
      } catch {
        errors.push('设置解析失败');
      }
    }

    // 6. Migrate streak
    const streakRaw = localStorage.getItem(STORAGE_KEYS.streak);
    if (streakRaw) {
      try {
        const streak: StreakData = JSON.parse(streakRaw);
        const { error } = await supabase.from('streak_data').upsert({
          user_id: user.id,
          current_streak: streak.currentStreak,
          longest_streak: streak.longestStreak,
          last_active_date: streak.lastActiveDate || null,
          active_dates: streak.activeDates,
        });
        if (error) errors.push(`打卡数据迁移失败: ${error.message}`);
      } catch {
        errors.push('打卡数据解析失败');
      }
    }

    // Clear local data on success
    if (errors.length === 0) {
      const tx = db.transaction(
        ['words', 'cardStates', 'reviewLogs', 'quizResults'],
        'readwrite'
      );
      await tx.objectStore('words').clear();
      await tx.objectStore('cardStates').clear();
      await tx.objectStore('reviewLogs').clear();
      await tx.objectStore('quizResults').clear();
      await tx.done;
      localStorage.removeItem(STORAGE_KEYS.settings);
      localStorage.removeItem(STORAGE_KEYS.streak);
    }

    return { migrated: errors.length === 0, errors };
  } catch (e) {
    return {
      migrated: false,
      errors: [`迁移出错: ${e instanceof Error ? e.message : '未知错误'}`],
    };
  }
}

export async function autoMigrateOnLogin(): Promise<void> {
  const hasLocal = await checkLocalData();
  if (!hasLocal) return;

  const shouldMigrate = confirm(
    '检测到本地学习数据，是否将其上传到云端？\n' +
      '这将帮助您在不同设备间同步学习进度。'
  );

  if (shouldMigrate) {
    const { migrated, errors } = await migrateLocalDataToSupabase();
    if (migrated) {
      alert('数据迁移成功！');
    } else {
      alert(`部分数据迁移失败：\n${errors.join('\n')}`);
    }
  }
}
