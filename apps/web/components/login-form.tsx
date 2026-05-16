'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useContext, useState } from 'react';

import { AuthContext } from './auth-provider';
import { api } from '@/lib/api';

export function LoginForm() {
  const router = useRouter();
  const { refresh } = useContext(AuthContext);
  const [email, setEmail] = useState('admin@vechart.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.login(email, password);
      await refresh();
      router.push('/');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel form" onSubmit={onSubmit}>
      <div>
        <p className="eyebrow">Product Cloud Album</p>
        <h1>登录 VeChart</h1>
        <p className="muted">首版支持管理员与协作用户登录后查看和维护商品图库。</p>
      </div>
      <label>
        邮箱
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        密码
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="error-text">{error}</p> : null}
      <button className="button" disabled={submitting}>
        {submitting ? '登录中...' : '登录'}
      </button>
      <p className="muted">演示账号：admin@vechart.local / admin123</p>
    </form>
  );
}
