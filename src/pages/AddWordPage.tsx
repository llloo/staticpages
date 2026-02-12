import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { nanoid } from 'nanoid';
import type { Word, Definition } from '../types';
import { getWord, addWords, upsertCardState } from '../lib/storage';
import { createInitialCardState } from '../lib/sm2';
import './AddWordPage.css';

export default function AddWordPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [word, setWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [audio, setAudio] = useState('');
  const [definitions, setDefinitions] = useState<Definition[]>([
    { pos: 'n.', meaning: '' },
  ]);
  const [example, setExample] = useState('');
  const [exampleCn, setExampleCn] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(isEditing);

  useEffect(() => {
    if (id) {
      getWord(id).then((w) => {
        if (w) {
          setWord(w.word);
          setPhonetic(w.phonetic || '');
          setAudio(w.audio || '');
          setDefinitions(
            w.definitions.length > 0
              ? w.definitions
              : [{ pos: 'n.', meaning: '' }]
          );
          setExample(w.example || '');
          setExampleCn(w.example_cn || '');
          setTags(w.tags.join(', '));
        }
        setLoading(false);
      });
    }
  }, [id]);

  const addDefinition = () => {
    setDefinitions([...definitions, { pos: 'n.', meaning: '' }]);
  };

  const removeDefinition = (index: number) => {
    if (definitions.length <= 1) return;
    setDefinitions(definitions.filter((_, i) => i !== index));
  };

  const updateDefinition = (
    index: number,
    field: keyof Definition,
    value: string
  ) => {
    setDefinitions(
      definitions.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  const handleSubmit = async () => {
    if (!word.trim()) return;
    if (!definitions.some((d) => d.meaning.trim())) return;

    const wordData: Word = {
      id: id || nanoid(),
      word: word.trim(),
      phonetic: phonetic.trim() || undefined,
      audio: audio.trim() || undefined,
      definitions: definitions.filter((d) => d.meaning.trim()),
      example: example.trim() || undefined,
      example_cn: exampleCn.trim() || undefined,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      source: 'user',
    };

    await addWords([wordData]);

    if (!isEditing) {
      await upsertCardState(createInitialCardState(wordData.id));
    }

    navigate('/words');
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="add-word-page">
      <h2>{isEditing ? '编辑单词' : '添加单词'}</h2>

      <div className="form-group">
        <label className="label">英文单词 *</label>
        <input
          className="input"
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="例: abandon"
          autoFocus
        />
      </div>

      <div className="form-group">
        <label className="label">音标</label>
        <input
          className="input"
          type="text"
          value={phonetic}
          onChange={(e) => setPhonetic(e.target.value)}
          placeholder="例: /əˈbændən/"
        />
      </div>

      <div className="form-group">
        <label className="label">语音文件</label>
        <input
          className="input"
          type="text"
          value={audio}
          onChange={(e) => setAudio(e.target.value)}
          placeholder="例: abandon.mp3"
        />
        <div className="form-hint text-secondary">
          MP3 文件需放在 data/audio/ 目录下
        </div>
      </div>

      <div className="form-group">
        <label className="label">释义 *</label>
        {definitions.map((def, i) => (
          <div key={i} className="definition-row">
            <select
              className="input pos-select"
              value={def.pos}
              onChange={(e) => updateDefinition(i, 'pos', e.target.value)}
            >
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
              type="text"
              value={def.meaning}
              onChange={(e) =>
                updateDefinition(i, 'meaning', e.target.value)
              }
              placeholder="中文释义"
            />
            {definitions.length > 1 && (
              <button
                className="btn btn-outline remove-def-btn"
                onClick={() => removeDefinition(i)}
              >
                &times;
              </button>
            )}
          </div>
        ))}
        <button
          className="btn btn-outline add-def-btn"
          onClick={addDefinition}
        >
          + 添加释义
        </button>
      </div>

      <div className="form-group">
        <label className="label">例句</label>
        <textarea
          className="input example-textarea"
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder="例: He abandoned his family."
          rows={2}
        />
      </div>

      <div className="form-group">
        <label className="label">例句中文翻译</label>
        <textarea
          className="input example-textarea"
          value={exampleCn}
          onChange={(e) => setExampleCn(e.target.value)}
          placeholder="例: 他抛弃了他的家人。"
          rows={2}
        />
      </div>

      <div className="form-group">
        <label className="label">标签</label>
        <input
          className="input"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="用逗号分隔，例: 高频, 考研"
        />
      </div>

      <div className="form-actions">
        <button className="btn btn-outline" onClick={() => navigate(-1)}>
          取消
        </button>
        <button className="btn btn-primary" onClick={handleSubmit}>
          {isEditing ? '保存' : '添加'}
        </button>
      </div>
    </div>
  );
}
