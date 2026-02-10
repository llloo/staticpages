import { useState } from 'react';
import {
  loadSettings,
  saveSettings,
  exportAllData,
  triggerDownload,
  importData,
} from '../lib/exportImport';
import { clearAllData } from '../lib/storage';
import { STORAGE_KEYS } from '../constants';
import './SettingsPage.css';

export default function SettingsPage() {
  const [settings, setSettings] = useState(loadSettings);
  const [message, setMessage] = useState('');

  const handleNewCardLimit = (value: number) => {
    const updated = { ...settings, dailyNewCardLimit: value };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleReviewLimit = (value: number) => {
    const updated = { ...settings, dailyReviewLimit: value };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      triggerDownload(data);
      setMessage('数据已导出');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('导出失败');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await importData(text);
        setSettings(loadSettings());
        setMessage('数据已导入，请刷新页面');
      } catch (err) {
        setMessage(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    };
    input.click();
  };

  const handleClearAll = async () => {
    if (!confirm('确定要清除所有数据吗？此操作不可撤销！')) return;
    if (!confirm('再次确认：所有学习进度和自定义单词将被永久删除。')) return;

    await clearAllData();
    localStorage.removeItem(STORAGE_KEYS.settings);
    localStorage.removeItem(STORAGE_KEYS.streak);
    setSettings(loadSettings());
    setMessage('所有数据已清除，请刷新页面');
  };

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

      <div className="settings-section card">
        <h3>数据管理</h3>
        <div className="data-buttons">
          <button className="btn btn-outline btn-block" onClick={handleExport}>
            导出数据
          </button>
          <button className="btn btn-outline btn-block" onClick={handleImport}>
            导入数据
          </button>
          <button
            className="btn btn-danger btn-block"
            onClick={handleClearAll}
          >
            清除所有数据
          </button>
        </div>
      </div>

      {message && <div className="settings-message">{message}</div>}

      <div className="settings-footer text-secondary">
        <p>词忆 - 智能背单词应用</p>
        <p>数据存储在浏览器本地，建议定期导出备份</p>
      </div>
    </div>
  );
}
