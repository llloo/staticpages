import { useState, useEffect } from 'react';
import {
  loadSettings,
  saveSettings,
} from '../lib/exportImport';
import { DEFAULT_SETTINGS } from '../constants';
import type { UserSettings } from '../types';
import './SettingsPage.css';

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const handleNewCardLimit = async (value: number) => {
    const updated = { ...settings, dailyNewCardLimit: value };
    setSettings(updated);
    await saveSettings(updated);
  };

  const handleReviewLimit = async (value: number) => {
    const updated = { ...settings, dailyReviewLimit: value };
    setSettings(updated);
    await saveSettings(updated);
  };

  if (loading) {
    return <div className="settings-page"><div className="loading">加载中...</div></div>;
  }

  return (
    <div className="settings-page">
      <h2>设置</h2>

      <div className="settings-section card">
        <h3>学习目标</h3>

        <div className="setting-item">
          <div className="setting-label">
            <span>每日新词上限</span>
            <span className="setting-value">{settings.dailyNewCardLimit}</span>
          </div>
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={settings.dailyNewCardLimit}
            onChange={(e) => handleNewCardLimit(Number(e.target.value))}
            className="setting-slider"
          />
        </div>

        <div className="setting-item">
          <div className="setting-label">
            <span>每日复习上限</span>
            <span className="setting-value">{settings.dailyReviewLimit}</span>
          </div>
          <input
            type="range"
            min="50"
            max="500"
            step="50"
            value={settings.dailyReviewLimit}
            onChange={(e) => handleReviewLimit(Number(e.target.value))}
            className="setting-slider"
          />
        </div>
      </div>

      <div className="settings-footer text-secondary">
        <p>词忆 - 智能背单词应用</p>
      </div>
    </div>
  );
}
