import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function SupabaseTestPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const checkEnv = () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setResult('❌ 环境变量未配置！请检查 .env.local 文件');
    } else {
      setResult(`✅ 环境变量已配置\nURL: ${url}\nKey: ${key.substring(0, 30)}...`);
    }
  };

  const testSignUp = async () => {
    if (!email || !password) {
      setResult('❌ 请输入邮箱和密码');
      return;
    }

    setLoading(true);
    setResult('注册中...');

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setResult(`❌ 注册失败：${error.message}\n\n详细错误：\n${JSON.stringify(error, null, 2)}`);
      } else {
        setResult(`✅ 注册成功！\n\nUser ID: ${data.user?.id}\nEmail: ${data.user?.email}\n\n完整响应：\n${JSON.stringify(data, null, 2)}`);
      }
    } catch (err) {
      setResult(`❌ 网络错误：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const testSignIn = async () => {
    if (!email || !password) {
      setResult('❌ 请输入邮箱和密码');
      return;
    }

    setLoading(true);
    setResult('登录中...');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setResult(`❌ 登录失败：${error.message}\n\n详细错误：\n${JSON.stringify(error, null, 2)}`);
      } else {
        setResult(`✅ 登录成功！\n\nUser ID: ${data.user?.id}\nEmail: ${data.user?.email}\nSession: ${data.session ? '已创建' : '未创建'}\n\n完整响应：\n${JSON.stringify(data.user, null, 2)}`);
      }
    } catch (err) {
      setResult(`❌ 网络错误：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setResult('测试连接中...');

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setResult(`❌ 连接失败：${error.message}`);
      } else {
        setResult(`✅ Supabase 连接正常\n\n当前会话：${data.session ? '已登录' : '未登录'}`);
      }
    } catch (err) {
      setResult(`❌ 网络错误：${err instanceof Error ? err.message : '未知错误'}\n\n请检查：\n1. VITE_SUPABASE_URL 是否正确\n2. VITE_SUPABASE_ANON_KEY 是否正确\n3. 网络连接是否正常`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Supabase 连接测试</h1>

      <div style={{ marginBottom: '20px' }}>
        <h3>1. 检查环境变量</h3>
        <button
          onClick={checkEnv}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          检查环境变量
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>2. 测试连接</h3>
        <button
          onClick={testConnection}
          disabled={loading}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          测试 Supabase 连接
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>3. 测试注册</h3>
        <input
          type="email"
          placeholder="test@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '8px', width: '250px', marginRight: '10px' }}
        />
        <input
          type="password"
          placeholder="password123"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '8px', width: '150px', marginRight: '10px' }}
        />
        <button
          onClick={testSignUp}
          disabled={loading}
          style={{ padding: '8px 20px', cursor: 'pointer' }}
        >
          测试注册
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>4. 测试登录</h3>
        <button
          onClick={testSignIn}
          disabled={loading}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          使用上面的邮箱密码登录
        </button>
      </div>

      {result && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: result.startsWith('✅') ? '#e8f5e9' : '#ffebee',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '13px'
        }}>
          {result}
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', background: '#f5f5f5', borderRadius: '4px' }}>
        <h4>常见问题排查：</h4>
        <ol style={{ marginLeft: '20px' }}>
          <li><strong>Missing environment variables</strong> → 确保 .env.local 文件存在且格式正确</li>
          <li><strong>Invalid API key</strong> → 检查 VITE_SUPABASE_ANON_KEY 是否正确复制</li>
          <li><strong>Email not confirmed</strong> → 在 Supabase Dashboard 关闭邮箱验证</li>
          <li><strong>Failed to fetch</strong> → 检查 VITE_SUPABASE_URL 格式和网络连接</li>
          <li><strong>User already registered</strong> → 使用不同的邮箱或在 Supabase Dashboard 删除用户</li>
        </ol>
      </div>
    </div>
  );
}
