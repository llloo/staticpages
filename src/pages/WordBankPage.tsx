import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WordListMeta, Word } from '../types';
import {
  getAllUserWords,
  deleteWord,
  enableWordList,
  disableWordList,
} from '../lib/storage';
import { getWordListsMeta } from '../lib/adminStorage';
import { loadSettings } from '../lib/exportImport';
import AudioButton from '../components/AudioButton';
import './WordBankPage.css';

type Tab = 'builtin' | 'user';

export default function WordBankPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('builtin');
  const [manifest, setManifest] = useState<WordListMeta[]>([]);
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [userWords, setUserWords] = useState<Word[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const lists = await getWordListsMeta();
        const metaList: WordListMeta[] = lists.map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          wordCount: l.wordCount,
        }));
        setManifest(metaList);
      } catch {
        // Failed to load word lists
      }
      const settings = await loadSettings();
      setEnabledIds(settings.enabledListIds);
      const words = await getAllUserWords();
      setUserWords(words);
      setLoading(false);
    }
    load();
  }, []);

  const toggleList = async (listId: string) => {
    if (enabledIds.includes(listId)) {
      if (!confirm('禁用词库将清除该词库的学习进度，确定要禁用吗？')) return;
      try {
        await disableWordList(listId);
        setEnabledIds((prev) => prev.filter((id) => id !== listId));
      } catch (err) {
        console.error('Failed to disable word list:', err);
      }
    } else {
      setLoadingList(listId);
      const meta = manifest.find((m) => m.id === listId);
      if (!meta) return;

      try {
        await enableWordList(listId, meta.name);
        setEnabledIds((prev) => [...prev, listId]);
      } catch (err) {
        console.error('Failed to enable word list:', err);
      }
      setLoadingList(null);
    }
  };

  const handleDeleteWord = async (id: string) => {
    if (!confirm('确定要删除这个单词吗？')) return;
    await deleteWord(id);
    setUserWords((prev) => prev.filter((w) => w.id !== id));
  };

  const filteredUserWords = userWords.filter(
    (w) =>
      w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.definitions.some((d) =>
        d.meaning.includes(searchQuery)
      )
  );

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="wordbank-page">
      <div className="wordbank-tabs">
        <button
          className={`wordbank-tab ${tab === 'builtin' ? 'active' : ''}`}
          onClick={() => setTab('builtin')}
        >
          内置词库
        </button>
        <button
          className={`wordbank-tab ${tab === 'user' ? 'active' : ''}`}
          onClick={() => setTab('user')}
        >
          我的单词
        </button>
      </div>

      {tab === 'builtin' && (
        <div className="builtin-lists">
          {manifest.length === 0 && (
            <div className="empty-state">暂无可用词库</div>
          )}
          {manifest.map((meta) => (
            <div key={meta.id} className="list-card card">
              <div className="list-info">
                <div className="list-name">{meta.name}</div>
                <div className="list-desc text-secondary">
                  {meta.description} ({meta.wordCount} 词)
                </div>
              </div>
              <button
                className={`btn ${
                  enabledIds.includes(meta.id)
                    ? 'btn-outline'
                    : 'btn-primary'
                }`}
                onClick={() => toggleList(meta.id)}
                disabled={loadingList === meta.id}
              >
                {loadingList === meta.id
                  ? '加载中...'
                  : enabledIds.includes(meta.id)
                    ? '已启用'
                    : '启用'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'user' && (
        <div className="user-words">
          <div className="user-words-header">
            <input
              className="input"
              type="text"
              placeholder="搜索单词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={() => navigate('/words/add')}
            >
              添加单词
            </button>
          </div>

          {filteredUserWords.length === 0 ? (
            <div className="empty-state">
              {searchQuery ? '没有匹配的单词' : '还没有添加自定义单词'}
            </div>
          ) : (
            <div className="word-list">
              {filteredUserWords.map((word) => (
                <div key={word.id} className="word-item card">
                  <div className="word-item-main">
                    <div className="word-item-header">
                      <div className="word-item-word">{word.word}</div>
                      <AudioButton audioFile={word.audio} size="small" />
                    </div>
                    <div className="word-item-meaning text-secondary">
                      {word.definitions
                        .map((d) => d.pos ? `${d.pos} ${d.meaning}` : d.meaning)
                        .join('；')}
                    </div>
                  </div>
                  <div className="word-item-actions">
                    <button
                      className="btn btn-outline"
                      onClick={() =>
                        navigate(`/words/edit/${word.id}`)
                      }
                    >
                      编辑
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteWord(word.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
