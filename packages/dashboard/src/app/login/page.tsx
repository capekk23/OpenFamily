'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setTokens } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json() as { accessToken?: string; refreshToken?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Login failed');
        return;
      }

      setTokens(data.accessToken!, data.refreshToken!);
      router.replace('/');
    } catch {
      setError('Network error — is the API running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ background: 'white', padding: '2.5rem', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.1)', width: 360 }}>
        <h1 style={{ marginTop: 0, color: '#1a1a2e', fontSize: '1.5rem' }}>OpenFamily</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem', marginTop: '0.25rem' }}>Sign in to your dashboard</p>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
            placeholder="admin@example.com"
          />
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={inputStyle}
            placeholder="••••••••"
          />
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: '#1a1a2e', color: 'white', border: 'none', padding: '0.75rem', borderRadius: 6, fontSize: '1rem', cursor: loading ? 'wait' : 'pointer', marginTop: '0.5rem' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.95rem', marginBottom: '1rem', boxSizing: 'border-box' };
