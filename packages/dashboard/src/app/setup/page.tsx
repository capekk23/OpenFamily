'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setTokens, isLoggedIn } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

type Step = 'admin' | 'provider' | 'done';

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...', defaultModel: 'claude-sonnet-4-6', url: 'https://api.anthropic.com' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...', defaultModel: 'anthropic/claude-sonnet-4-6', url: 'https://openrouter.ai/api/v1' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...', defaultModel: 'gpt-4o', url: 'https://api.openai.com/v1' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', placeholder: 'your-api-key', defaultModel: 'your-model-id', url: '' },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Admin step
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // Provider step
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [baseUrl, setBaseUrl] = useState('https://api.anthropic.com');

  useEffect(() => {
    // If already logged in, skip to provider step or redirect
    if (isLoggedIn()) {
      fetch(`${API_URL}/api/auth/setup-status`)
        .then(r => r.json())
        .then((d: { needsSetup: boolean }) => {
          if (!d.needsSetup) router.replace('/');
        })
        .catch(() => {});
    }
  }, [router]);

  const handleProviderChange = (id: string) => {
    setSelectedProvider(id);
    const p = PROVIDERS.find(p => p.id === id)!;
    setModel(p.defaultModel);
    setBaseUrl(p.url);
  };

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { accessToken?: string; refreshToken?: string; error?: string };
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      setTokens(data.accessToken!, data.refreshToken!);
      setAccessToken(data.accessToken!);
      setStep('provider');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const saveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body: Record<string, unknown> = { apiKey, model, enabled: true };
      if (baseUrl) body.baseUrl = baseUrl;
      const res = await fetch(`${API_URL}/api/settings/providers/${selectedProvider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to save provider');
      }
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const skipProvider = () => setStep('done');

  const finish = () => router.replace('/');

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '0 1rem' }}>
        {/* Logo / title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a2e' }}>OpenFamily</div>
          <div style={{ color: '#6b7280', marginTop: '0.25rem' }}>AI Agent Governance Platform</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
          {(['admin', 'provider', 'done'] as Step[]).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700,
                background: step === s ? '#1a1a2e' : ((['admin', 'provider', 'done'].indexOf(step) > i) ? '#22c55e' : '#e5e7eb'),
                color: step === s || ['admin', 'provider', 'done'].indexOf(step) > i ? 'white' : '#9ca3af',
              }}>
                {['admin', 'provider', 'done'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < 2 && <div style={{ width: 32, height: 2, background: ['admin', 'provider', 'done'].indexOf(step) > i ? '#22c55e' : '#e5e7eb' }} />}
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }}>
          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {step === 'admin' && (
            <form onSubmit={createAdmin}>
              <h2 style={{ margin: '0 0 0.25rem' }}>Create admin account</h2>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 0, marginBottom: '1.5rem' }}>
                This will be the master account for your OpenFamily instance.
              </p>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" style={inputStyle} required />
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" style={inputStyle} required minLength={8} />
              <button type="submit" disabled={loading} style={btnPrimary}>{loading ? 'Creating…' : 'Create account →'}</button>
            </form>
          )}

          {step === 'provider' && (
            <form onSubmit={saveProvider}>
              <h2 style={{ margin: '0 0 0.25rem' }}>Connect an AI provider</h2>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: 0, marginBottom: '1.5rem' }}>
                OpenFamily uses this to power the supervisor AI that reviews borderline agent actions.
              </p>

              <label style={labelStyle}>Provider</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    style={{
                      padding: '0.6rem',
                      borderRadius: 8,
                      border: `2px solid ${selectedProvider === p.id ? '#1a1a2e' : '#e5e7eb'}`,
                      background: selectedProvider === p.id ? '#f0f0ff' : 'white',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: selectedProvider === p.id ? 700 : 400,
                      color: '#374151',
                      textAlign: 'center',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <label style={labelStyle}>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={PROVIDERS.find(p => p.id === selectedProvider)?.placeholder ?? 'your-api-key'}
                style={inputStyle}
                required
              />

              <label style={labelStyle}>Model</label>
              <input value={model} onChange={e => setModel(e.target.value)} style={inputStyle} required />

              {selectedProvider === 'custom' && (
                <>
                  <label style={labelStyle}>Base URL</label>
                  <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://your-api.com/v1" style={inputStyle} />
                </>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="submit" disabled={loading} style={btnPrimary}>{loading ? 'Saving…' : 'Save & continue →'}</button>
                <button type="button" onClick={skipProvider} style={btnSecondary}>Skip for now</button>
              </div>
            </form>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <h2 style={{ margin: '0 0 0.5rem' }}>You&apos;re all set!</h2>
              <p style={{ color: '#6b7280', marginTop: 0, marginBottom: '1.5rem' }}>
                OpenFamily is ready to govern your AI agents. Create a policy, generate an API key, and connect your first agent.
              </p>
              <button onClick={finish} style={btnPrimary}>Go to dashboard →</button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem', marginTop: '1.5rem' }}>
          Already have an account? <a href="/login" style={{ color: '#1a1a2e' }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.65rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', marginBottom: '1rem', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { width: '100%', background: '#1a1a2e', color: 'white', border: 'none', padding: '0.75rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 };
const btnSecondary: React.CSSProperties = { background: 'white', color: '#374151', border: '1px solid #d1d5db', padding: '0.75rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem' };
