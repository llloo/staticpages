import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getAllCardStates, getAllReviewLogs } from '../lib/storage';
import { loadStreak } from '../lib/exportImport';
import type { ReviewLog, StreakData } from '../types';
import './StatsPage.css';

interface DailyCount {
  date: string;
  count: number;
}

interface MasteryData {
  name: string;
  value: number;
  color: string;
}

interface ForecastData {
  date: string;
  count: number;
}

const STATUS_COLORS: Record<string, string> = {
  new: '#818CF8',
  learning: '#F59E0B',
  review: '#3B82F6',
  mastered: '#10B981',
};

const STATUS_LABELS: Record<string, string> = {
  new: '新词',
  learning: '学习中',
  review: '复习中',
  mastered: '已掌握',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function StatsPage() {
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [mastery, setMastery] = useState<MasteryData[]>([]);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    activeDates: [],
  });
  const [totalReviews, setTotalReviews] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const allLogs = await getAllReviewLogs();
      const allCards = await getAllCardStates();
      const streakData = await loadStreak();

      // Daily counts for last 30 days
      const now = new Date();
      const days: DailyCount[] = [];
      const logsByDate = new Map<string, ReviewLog[]>();
      for (const log of allLogs) {
        const date = log.reviewDate.split('T')[0];
        if (!logsByDate.has(date)) logsByDate.set(date, []);
        logsByDate.get(date)!.push(log);
      }

      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        days.push({
          date: formatDate(dateStr),
          count: logsByDate.get(dateStr)?.length || 0,
        });
      }
      setDailyCounts(days);

      // Mastery distribution
      const statusCounts: Record<string, number> = {
        new: 0,
        learning: 0,
        review: 0,
        mastered: 0,
      };
      for (const card of allCards) {
        statusCounts[card.status] = (statusCounts[card.status] || 0) + 1;
      }
      const masteryData: MasteryData[] = Object.entries(statusCounts)
        .filter(([_, v]) => v > 0)
        .map(([key, value]) => ({
          name: STATUS_LABELS[key] || key,
          value,
          color: STATUS_COLORS[key] || '#ccc',
        }));
      setMastery(masteryData);

      // Forecast
      const forecastData: ForecastData[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const count = allCards.filter((c) => c.dueDate === dateStr).length;
        forecastData.push({ date: formatDate(dateStr), count });
      }
      setForecast(forecastData);

      setStreak(streakData);
      setTotalReviews(allLogs.length);
      setTotalWords(allCards.length);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="stats-page">
      <div className="stats-summary">
        <div className="summary-item">
          <div className="summary-number">{totalWords}</div>
          <div className="summary-label">总词量</div>
        </div>
        <div className="summary-item">
          <div className="summary-number">{totalReviews}</div>
          <div className="summary-label">总复习次数</div>
        </div>
        <div className="summary-item">
          <div className="summary-number">{streak.currentStreak}</div>
          <div className="summary-label">当前连续</div>
        </div>
        <div className="summary-item">
          <div className="summary-number">{streak.longestStreak}</div>
          <div className="summary-label">最长连续</div>
        </div>
      </div>

      {totalWords > 0 && (
        <>
          <div className="chart-section card">
            <h3>掌握程度分布</h3>
            <div className="chart-container pie-chart-container">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={mastery}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${value}`}
                  >
                    {mastery.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-section card">
            <h3>近30天复习量</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyCounts}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="var(--color-primary)"
                    radius={[2, 2, 0, 0]}
                    name="复习数"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-section card">
            <h3>未来7天预测</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={forecast}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="var(--color-warning)"
                    radius={[2, 2, 0, 0]}
                    name="到期数"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {streak.activeDates.length > 0 && (
            <div className="chart-section card">
              <h3>学习日历 (近90天)</h3>
              <ActivityCalendar activeDates={streak.activeDates} />
            </div>
          )}
        </>
      )}

      {totalWords === 0 && (
        <div className="empty-state">
          开始学习后这里会显示统计数据
        </div>
      )}
    </div>
  );
}

function ActivityCalendar({ activeDates }: { activeDates: string[] }) {
  const activeSet = new Set(activeDates);
  const days: { date: string; active: boolean }[] = [];
  const now = new Date();

  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({ date: dateStr, active: activeSet.has(dateStr) });
  }

  return (
    <div className="calendar-grid">
      {days.map((day) => (
        <div
          key={day.date}
          className={`calendar-cell ${day.active ? 'active' : ''}`}
          title={day.date}
        />
      ))}
    </div>
  );
}
