import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../hooks/useAuth';
import {
  getWordListById,
  createWordList,
  updateWordList,
} from '../lib/adminStorage';
import type { RawWordEntry, Definition } from '../types';
import './AdminEditListPage.css';

function validateWordListJson(data: unknown): RawWordEntry[] {
  if (!Array.isArray(data)) throw new Error('JSON 必须是数组');
  for (const item of data) {
    if (!item.word || typeof item.word !== 'string')
      throw new Error('每个单词必须有 word 字段');
    if (!Array.isArray(item.definitions) || item.definitions.length === 0)
      throw new Error(`单词 "${item.word}" 缺少 definitions`);
    for (const def of item.definitions) {
      if (!def.pos || !def.meaning)
        throw new Error(`单词 "${item.word}" 的释义格式错误`);
    }
  }
  return data as RawWordEntry[];
}

export default function AdminEditListPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [words, setWords] = useState<RawWordEntry[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Inline editor state
  const [editWord, setEditWord] = useState('');
  const [editPhonetic, setEditPhonetic] = useState('');
  const [editAudio, setEditAudio] = useState('');
  const [editDefs, setEditDefs] = useState<Definition[]>([{ pos: 'n.', meaning: '' }]);
  const [editExample, setEditExample] = useState('');

  useEffect(() => {
    if (!id || adminLoading || !isAdmin) return;
    getWordListById(id).then((record) => {
      if (record) {
        setName(record.name);
        setDescription(record.description);
        setWords(record.words);
      }
      setLoading(false);
    });
  }, [id, isAdmin, adminLoading]);

  if (adminLoading || loading) {
    return <div className="admin-edit-page"><div className="loading-text">加载中...</div></div>;
  }

  if (!isAdmin) {
    return (
      <div className="admin-edit-page">
        <div className="admin-denied">
          <h2>无权限访问</h2>
          <button className="btn btn-primary" onClick={() => navigate('/more')}>返回</button>
        </div>
      </div>
    );
  }

  const openEditor = (index: number) => {
    const w = words[index];
    setEditWord(w.word);
    setEditPhonetic(w.phonetic || '');
    setEditAudio(w.audio || '');
    setEditDefs(w.definitions.length > 0 ? [...w.definitions] : [{ pos: 'n.', meaning: '' }]);
    setEditExample(w.example || '');
    setEditingIndex(index);
  };

  const openNewEditor = () => {
    setEditWord('');
    setEditPhonetic('');
    setEditAudio('');
    setEditDefs([{ pos: 'n.', meaning: '' }]);
    setEditExample('');
    setEditingIndex(words.length); // new item at end
  };

  const saveEditor = () => {
    if (!editWord.trim()) return;
    if (!editDefs.some((d) => d.meaning.trim())) return;

    const entry: RawWordEntry = {
      word: editWord.trim(),
      phonetic: editPhonetic.trim() || undefined,
      audio: editAudio.trim() || undefined,
      definitions: editDefs.filter((d) => d.meaning.trim()),
      example: editExample.trim() || undefined,
    };

    if (editingIndex !== null && editingIndex < words.length) {
      setWords((prev) => prev.map((w, i) => (i === editingIndex ? entry : w)));
    } else {
      setWords((prev) => [...prev, entry]);
    }
    setEditingIndex(null);
  };

  const cancelEditor = () => {
    setEditingIndex(null);
  };

  const handleDeleteWord = (index: number) => {
    if (!confirm(`确定要删除单词「${words[index].word}」吗？`)) return;
    setWords((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const validated = validateWordListJson(data);
        setWords(validated);
        setError('');
        setEditingIndex(null);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入词库名称');
      return;
    }
    if (words.length === 0) {
      setError('请至少添加一个单词');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (isEditing && id) {
        await updateWordList(id, name.trim(), description.trim(), words);
      } else {
        await createWordList(name.trim(), description.trim(), words, user!.id);
      }
      navigate('/admin');
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const updateDef = (index: number, field: keyof Definition, value: string) => {
    setEditDefs((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  return (
    <div className="admin-edit-page">
      <h2>{isEditing ? '编辑词库' : '新建词库'}</h2>

      {error && <div className="admin-error">{error}</div>}

      <div className="form-group">
        <label className="label">词库名称 *</label>
        <input
          className="input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 大学英语四级"
        />
      </div>

      <div className="form-group">
        <label className="label">词库描述</label>
        <input
          className="input"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例: CET-4 核心词汇"
        />
      </div>

      <div className="admin-words-section">
        <div className="admin-words-header">
          <span className="label">单词列表（{words.length} 词）</span>
          <button className="btn btn-outline" onClick={handleFileUpload}>
            上传 JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={onFileSelected}
          />
        </div>

        {words.length === 0 && editingIndex === null && (
          <div className="empty-state">暂无单词，请上传 JSON 或手动添加</div>
        )}

        <div className="admin-word-list">
          {words.map((w, i) =>
            editingIndex === i ? (
              <div key={i} className="admin-word-editor card">
                <div className="form-group">
                  <label className="label">英文单词 *</label>
                  <input className="input" value={editWord} onChange={(e) => setEditWord(e.target.value)} placeholder="例: abandon" />
                </div>
                <div className="form-group">
                  <label className="label">音标</label>
                  <input className="input" value={editPhonetic} onChange={(e) => setEditPhonetic(e.target.value)} placeholder="例: /əˈbændən/" />
                </div>
                <div className="form-group">
                  <label className="label">语音文件</label>
                  <input className="input" value={editAudio} onChange={(e) => setEditAudio(e.target.value)} placeholder="例: abandon.mp3" />
                </div>
                <div className="form-group">
                  <label className="label">释义 *</label>
                  {editDefs.map((def, di) => (
                    <div key={di} className="definition-row">
                      <select className="input pos-select" value={def.pos} onChange={(e) => updateDef(di, 'pos', e.target.value)}>
                        <option value="n.">n.</option>
                        <option value="v.">v.</option>
                        <option value="adj.">adj.</option>
                        <option value="adv.">adv.</option>
                        <option value="prep.">prep.</option>
                        <option value="conj.">conj.</option>
                        <option value="pron.">pron.</option>
                        <option value="int.">int.</option>
                      </select>
                      <input
                        className="input meaning-input"
                        value={def.meaning}
                        onChange={(e) => updateDef(di, 'meaning', e.target.value)}
                        placeholder="中文释义"
                      />
                      {editDefs.length > 1 && (
                        <button className="btn btn-outline remove-def-btn" onClick={() => setEditDefs((prev) => prev.filter((_, j) => j !== di))}>
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-outline add-def-btn" onClick={() => setEditDefs((prev) => [...prev, { pos: 'n.', meaning: '' }])}>
                    + 添加释义
                  </button>
                </div>
                <div className="form-group">
                  <label className="label">例句</label>
                  <input className="input" value={editExample} onChange={(e) => setEditExample(e.target.value)} placeholder="例: He abandoned his plan." />
                </div>
                <div className="admin-editor-actions">
                  <button className="btn btn-outline" onClick={cancelEditor}>取消</button>
                  <button className="btn btn-primary" onClick={saveEditor}>确定</button>
                </div>
              </div>
            ) : (
              <div key={i} className="admin-word-card card">
                <div className="admin-word-info">
                  <div className="admin-word-title">
                    <span className="admin-word-name">{w.word}</span>
                    {w.phonetic && <span className="admin-word-phonetic">{w.phonetic}</span>}
                  </div>
                  <div className="admin-word-defs text-secondary">
                    {w.definitions.map((d) => `${d.pos} ${d.meaning}`).join(' / ')}
                  </div>
                </div>
                <div className="admin-word-actions">
                  <button className="btn btn-outline" onClick={() => openEditor(i)}>编辑</button>
                  <button className="btn btn-danger" onClick={() => handleDeleteWord(i)}>删除</button>
                </div>
              </div>
            )
          )}

          {editingIndex === words.length && (
            <div className="admin-word-editor card">
              <div className="form-group">
                <label className="label">英文单词 *</label>
                <input className="input" value={editWord} onChange={(e) => setEditWord(e.target.value)} placeholder="例: abandon" autoFocus />
              </div>
              <div className="form-group">
                <label className="label">音标</label>
                <input className="input" value={editPhonetic} onChange={(e) => setEditPhonetic(e.target.value)} placeholder="例: /əˈbændən/" />
              </div>
              <div className="form-group">
                <label className="label">语音文件</label>
                <input className="input" value={editAudio} onChange={(e) => setEditAudio(e.target.value)} placeholder="例: abandon.mp3" />
              </div>
              <div className="form-group">
                <label className="label">释义 *</label>
                {editDefs.map((def, di) => (
                  <div key={di} className="definition-row">
                    <select className="input pos-select" value={def.pos} onChange={(e) => updateDef(di, 'pos', e.target.value)}>
                      <option value="n.">n.</option>
                      <option value="v.">v.</option>
                      <option value="adj.">adj.</option>
                      <option value="adv.">adv.</option>
                      <option value="prep.">prep.</option>
                      <option value="conj.">conj.</option>
                      <option value="pron.">pron.</option>
                      <option value="int.">int.</option>
                    </select>
                    <input
                      className="input meaning-input"
                      value={def.meaning}
                      onChange={(e) => updateDef(di, 'meaning', e.target.value)}
                      placeholder="中文释义"
                    />
                    {editDefs.length > 1 && (
                      <button className="btn btn-outline remove-def-btn" onClick={() => setEditDefs((prev) => prev.filter((_, j) => j !== di))}>
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                <button className="btn btn-outline add-def-btn" onClick={() => setEditDefs((prev) => [...prev, { pos: 'n.', meaning: '' }])}>
                  + 添加释义
                </button>
              </div>
              <div className="form-group">
                <label className="label">例句</label>
                <input className="input" value={editExample} onChange={(e) => setEditExample(e.target.value)} placeholder="例: He abandoned his plan." />
              </div>
              <div className="admin-editor-actions">
                <button className="btn btn-outline" onClick={cancelEditor}>取消</button>
                <button className="btn btn-primary" onClick={saveEditor}>确定</button>
              </div>
            </div>
          )}
        </div>

        {editingIndex === null && (
          <button className="btn btn-outline admin-add-word-btn" onClick={openNewEditor}>
            + 添加单词
          </button>
        )}
      </div>

      <div className="form-actions">
        <button className="btn btn-outline" onClick={() => navigate('/admin')}>
          取消
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
