import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../hooks/useAuth';
import type { WordListMeta } from '../types';
import { disableWordList } from '../lib/storage';
import { getWordListsMeta } from '../lib/adminStorage';
import { loadSettings } from '../lib/exportImport';
import './MorePage.css';

const menuItems = [
  {
    label: '测验模式',
    desc: '选择题与拼写测验',
    path: '/quiz',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    label: '学习统计',
    desc: '复习数据与进度图表',
    path: '/stats',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: '设置',
    desc: '每日学习限额',
    path: '/settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function MorePage() {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const { user, signOut } = useAuth();
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [manifest, setManifest] = useState<WordListMeta[]>([]);
  const [disablingId, setDisablingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const settings = await loadSettings();
      setEnabledIds(settings.enabledListIds);
      try {
        const lists = await getWordListsMeta();
        setManifest(lists.map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          wordCount: l.wordCount,
        })));
      } catch {
        // ignore
      }
    }
    load();
  }, []);

  const handleDisable = async (listId: string) => {
    if (!confirm('禁用词库将清除该词库的学习进度，确定要禁用吗？')) return;
    setDisablingId(listId);
    try {
      await disableWordList(listId);
      setEnabledIds((prev) => prev.filter((id) => id !== listId));
    } catch (err) {
      console.error('Failed to disable word list:', err);
    }
    setDisablingId(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const enabledLists = manifest.filter((m) => enabledIds.includes(m.id));

  const allItems = isAdmin
    ? [
        ...menuItems,
        {
          label: '管理后台',
          desc: '词库管理（管理员）',
          path: '/admin',
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          ),
        },
      ]
    : menuItems;

  return (
    <div className="more-page">
      <div className="more-user-section card">
        <div className="more-user-info">
          <div className="more-user-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="more-user-detail">
            <span className="more-user-email">{user?.email ?? '未登录'}</span>
            <span className="more-user-hint text-secondary">数据已同步至云端</span>
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleSignOut}>
          退出
        </button>
      </div>

      {enabledLists.length > 0 && (
        <div className="more-enabled-section">
          <div className="more-section-header">
            <span className="more-section-title">已启用词库</span>
            <button
              className="more-section-link"
              onClick={() => navigate('/words')}
            >
              管理词库
            </button>
          </div>
          <div className="more-enabled-list">
            {enabledLists.map((meta) => (
              <div key={meta.id} className="more-enabled-item card">
                <div className="more-enabled-info">
                  <span className="more-enabled-name">{meta.name}</span>
                  <span className="more-enabled-count text-secondary">{meta.wordCount} 词</span>
                </div>
                <button
                  className="btn btn-outline btn-sm btn-danger-text"
                  onClick={() => handleDisable(meta.id)}
                  disabled={disablingId === meta.id}
                >
                  {disablingId === meta.id ? '禁用中...' : '禁用'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="more-list">
        {allItems.map((item) => (
          <button
            key={item.path}
            className="more-item card"
            onClick={() => navigate(item.path)}
          >
            <span className="more-item-icon">{item.icon}</span>
            <div className="more-item-text">
              <span className="more-item-label">{item.label}</span>
              <span className="more-item-desc">{item.desc}</span>
            </div>
            <span className="more-item-arrow">&rsaquo;</span>
          </button>
        ))}
      </div>
    </div>
  );
}
