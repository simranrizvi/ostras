'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthFrame from '../../components/AuthFrame';
import { api } from '../../lib/api';
import Icon from '../../components/Icon';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', brandName: '', niche: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/auth/register', { method: 'POST', body: JSON.stringify(form) });
      router.replace('/');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      eyebrow="LET'S GET STARTED"
      title="Build your brand rhythm."
      description="Set the foundation. Social Flow will help you keep showing up."
    >
      <form onSubmit={submit} className="auth-form">
        {error && <div className="form-alert">{error}</div>}
        <div className="form-two">
          <label>
            Your name
            <input
              required
              minLength={2}
              autoComplete="name"
              placeholder="Imran Rizvi"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Brand name
            <input
              required
              minLength={2}
              placeholder="Studio North"
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            />
          </label>
        </div>
        <label>
          Work email
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
          What does your brand do?
          <input
            required
            minLength={2}
            placeholder="e.g. skincare, marketing, coffee"
            value={form.niche}
            onChange={(e) => setForm({ ...form, niche: e.target.value })}
          />
        </label>
        <label>
          Password <span className="label-hint">10+ characters</span>
          <input
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            placeholder="Create a secure password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <button className="button button-primary button-full" disabled={busy}>
          {busy ? 'Creating workspace…' : 'Create my workspace'}
          <Icon name="arrow" size={16} />
        </button>
      </form>
      <p className="auth-switch">
        Already have a workspace?{' '}
        <Link href="/login">
          Sign in <Icon name="arrow" size={14} />
        </Link>
      </p>
    </AuthFrame>
  );
}
