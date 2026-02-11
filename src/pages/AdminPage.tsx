import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import { getWordListsMeta, deleteWordList } from '../lib/adminStorage';
import type { WordListRecord } from '../lib/adminStorage';
import './AdminPage.css';

export default function AdminPage() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [lists, setLists] = useState<Omit<WordListRecord, 'words'>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    getWordListsMeta()
      .then(setLists)
      .finally(() => setLoading(false));
  }, [isAdmin, adminLoading]);

  if (adminLoading) {
    return <div className="admin-page"><div className="loading-text">加载中...</div></div>;
  }

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-denied">
          <h2>无权限访问</h2>
          <p className="text-secondary">此页面仅管理员可访问</p>
          <button className="btn btn-primary" onClick={() => navigate('/more')}>
            返回
          </button>
        </div>
      </div>
    );
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除词库「${name}」吗？删除后无法恢复。`)) return;
    await deleteWordList(id);
    setLists((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>词库管理后台</h2>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/admin/edit')}
        >
          新建词库
        </button>
      </div>

      {loading ? (
        <div className="loading-text">加载中...</div>
      ) : lists.length === 0 ? (
        <div className="empty-state">暂无词库，请点击「新建词库」添加</div>
      ) : (
        <div className="admin-list">
          {lists.map((list) => (
            <div key={list.id} className="admin-list-card card">
              <div className="admin-card-info">
                <div className="admin-card-name">{list.name}</div>
                <div className="admin-card-meta text-secondary">
                  {list.description} · {list.wordCount} 词
                </div>
              </div>
              <div className="admin-card-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => navigate(`/admin/edit/${list.id}`)}
                >
                  编辑
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(list.id, list.name)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
