'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '../../components/Icon';
import AuthFrame from '../../components/AuthFrame';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify(form) });
      router.replace('/');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      eyebrow="WELCOME BACK"
      title="Good to see you."
      description="Pick up where your brand left off."
    >
      <form onSubmit={submit} className="auth-form">
        {error && <div className="form-alert">{error}</div>}
        <label>
          Email address
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Your password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <button className="button button-primary button-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
          <Icon name="arrow" size={16} />
        </button>
      </form>
      <p className="auth-switch">
        New to Social Flow?{' '}
        <Link href="/register">
          Create your workspace <Icon name="arrow" size={14} />
        </Link>
      </p>
    </AuthFrame>
  );
}
