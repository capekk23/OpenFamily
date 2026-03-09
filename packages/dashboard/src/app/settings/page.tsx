'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import AuthGuard from '@/components/AuthGuard';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

interface ProviderConfig {
  apiKey?: string;   // always '••••••••' from API
  model?: string;
  baseUrl?: string;
  enabled?: boolean;
}

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...', defaultModel: 'claude-sonnet-4-6', defaultUrl: 'https://api.anthropic.com', docs: 'https://docs.anthropic.com/en/api/getting-started' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...', defaultModel: 'anthropic/claude-sonnet-4-6', defaultUrl: 'https://openrouter.ai/api/v1', docs: 'https://openrouter.ai/docs/quick-start' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...', defaultModel: 'gpt-4o', defaultUrl: 'https://api.openai.com/v1', docs: 'https://platform.openai.com/docs/api-reference' },
  { id: 'custom', label: 'Custom', placeholder: 'your-api-key', defaultModel: '', defaultUrl: '', docs: '' },
];

function ProviderCard({ id, label, placeholder, defaultUrl, docs, existing, onSave, onRemove }: {
  id: string; label: string; placeholder: string; defaultUrl: string; docs: string;
  existing?: ProviderConfig;
  onSave: (id: string, data: { apiKey: string; model: string; baseUrl?: string; enabled: boolean }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(existing?.model ?? '');
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? defaultUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const isConfigured = !!existing?.apiKey;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave(id, { apiKey, model, baseUrl: baseUrl || undefined, enabled: true });
      setSaved(true);
      setApiKey('');
      setTimeout(() => setSaved(false), 2000);
      setExpanded(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: isConfigured ? '#22c55e' : '#d1d5db',
          }} />
          <strong>{label}</strong>
          {isConfigured && <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>Configured · model: {existing?.model ?? '—'}</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isConfigured && (
            <button
              onClick={async (e) => { e.stopPropagation(); await onRemove(id); }}
              style={{ background: 'none', border: '1px solid #fca5a5', color: '#dc2626', padding: '0.25rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Remove
            </button>
          )}
          <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '1.25rem' }}>
          {docs && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#6b7280' }}>
              Get your API key from{' '}
              <a href={docs} target="_blank" rel="noreferrer" style={{ color: '#1a1a2e' }}>{label} docs ↗</a>
            </p>
          )}
          <form onSubmit={handleSave}>
            {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.6rem', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.85rem' }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: id === 'custom' ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>API Key {isConfigured && <span style={{ color: '#6b7280', fontWeight: 400 }}>(leave blank to keep current)</span>}</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={isConfigured ? '••••••••' : placeholder}
                  style={inputStyle}
                  required={!isConfigured}
                />
              </div>
              <div>
                <label style={labelStyle}>Model</label>
                <input value={model} onChange={e => setModel(e.target.value)} placeholder="model-id" style={inputStyle} required />
              </div>
              {(id === 'custom' || id === 'openrouter') && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Base URL</label>
                  <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
                </div>
              )}
            </div>
            <button type="submit" disabled={saving} style={{ background: saved ? '#22c55e' : '#1a1a2e', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem' }}>
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SettingsInner() {
  const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await fetch(`${API_URL}/api/settings/providers`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setProviders(await res.json() as Record<string, ProviderConfig>);
    setLoading(false);
  };

  const saveProvider = async (id: string, data: { apiKey: string; model: string; baseUrl?: string; enabled: boolean }) => {
    const res = await fetch(`${API_URL}/api/settings/providers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      throw new Error(d.error ?? 'Failed to save');
    }
    await load();
  };

  const removeProvider = async (id: string) => {
    await fetch(`${API_URL}/api/settings/providers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    await load();
  };

  useEffect(() => { load(); }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ margin: '0 0 0.35rem' }}>Settings</h1>
      <p style={{ color: '#6b7280', marginTop: 0, marginBottom: '2rem' }}>Configure AI providers used by the supervisor agent.</p>

      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#374151' }}>AI Providers</h2>
      <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '2rem' }}>
        {PROVIDERS.map(p => (
          <ProviderCard
            key={p.id}
            {...p}
            existing={providers[p.id]}
            onSave={saveProvider}
            onRemove={removeProvider}
          />
        ))}
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem 1.25rem', fontSize: '0.85rem', color: '#475569' }}>
        <strong>How it works:</strong> The supervisor AI reviews borderline agent actions (e.g. tool calls that match <code>useSupervisor: true</code> in your policy).
        The first configured and enabled provider is used. API keys are encrypted at rest.
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <AuthGuard><SettingsInner /></AuthGuard>;
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.1rem' };
