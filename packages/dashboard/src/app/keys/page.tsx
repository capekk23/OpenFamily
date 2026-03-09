'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import AuthGuard from '@/components/AuthGuard';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

interface ApiKey {
  id: string;
  name: string;
  policyId: string;
  policyName?: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

interface Policy {
  id: string;
  name: string;
}

function KeysInner() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPolicy, setNewKeyPolicy] = useState('');
  const [revealedKey, setRevealedKey] = useState<{ id: string; key: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    const [keysRes, policiesRes] = await Promise.all([
      fetch(`${API_URL}/api/keys`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      fetch(`${API_URL}/api/policies`, { headers: { Authorization: `Bearer ${getToken()}` } }),
    ]);
    if (keysRes.ok && policiesRes.ok) {
      const [keysData, policiesData] = await Promise.all([
        keysRes.json() as Promise<ApiKey[]>,
        policiesRes.json() as Promise<Policy[]>,
      ]);
      setPolicies(policiesData);
      // Attach policy name to keys
      const policyMap = new Map(policiesData.map(p => [p.id, p.name]));
      setKeys(keysData.map(k => ({ ...k, policyName: policyMap.get(k.policyId) })));
    } else {
      setError('Failed to load data');
    }
    setLoading(false);
  };

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !newKeyPolicy) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: newKeyName.trim(), policyId: newKeyPolicy }),
      });
      const data = await res.json() as { id: string; key: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to create key');
      setRevealedKey({ id: data.id, key: data.key });
      setNewKeyName('');
      setNewKeyPolicy('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const deactivate = async (id: string) => {
    await fetch(`${API_URL}/api/keys/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    await load();
  };

  useEffect(() => { load(); }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>API Keys</h1>
        <button onClick={() => setShowForm(v => !v)} style={btnPrimary}>
          {showForm ? 'Cancel' : '+ New Key'}
        </button>
      </div>

      {revealedKey && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, color: '#166534', marginBottom: '0.5rem' }}>
            Key created — copy it now, it won&apos;t be shown again
          </div>
          <code style={{ background: '#dcfce7', padding: '0.5rem 0.75rem', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.9rem', display: 'block', wordBreak: 'break-all' }}>
            {revealedKey.key}
          </code>
          <button
            onClick={() => { void navigator.clipboard.writeText(revealedKey.key); }}
            style={{ marginTop: '0.5rem', background: 'none', border: '1px solid #86efac', color: '#166534', padding: '0.3rem 0.75rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Copy
          </button>
          <button
            onClick={() => setRevealedKey(null)}
            style={{ marginTop: '0.5rem', marginLeft: '0.5rem', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {showForm && (
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Create API Key</h3>
          <form onSubmit={createKey}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Key Name</label>
                <input
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production Agent"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Policy</label>
                <select
                  value={newKeyPolicy}
                  onChange={e => setNewKeyPolicy(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  required
                >
                  <option value="">Select a policy…</option>
                  {policies.filter(p => p.name).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              style={{ ...btnPrimary, cursor: creating ? 'wait' : 'pointer' }}
            >
              {creating ? 'Creating…' : 'Create Key'}
            </button>
          </form>
        </div>
      )}

      {keys.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p>No API keys yet.</p>
          <button onClick={() => setShowForm(true)} style={btnPrimary}>Create your first key</button>
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {keys.map(k => (
          <div key={k.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong>{k.name}</strong>
                  {!k.isActive && <span style={inactiveBadge}>INACTIVE</span>}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Policy: <span style={{ color: '#374151' }}>{k.policyName ?? k.policyId}</span>
                  {k.lastUsedAt && <> · Last used {new Date(k.lastUsedAt).toLocaleDateString()}</>}
                  {!k.lastUsedAt && <> · Never used</>}
                  <> · Created {new Date(k.createdAt).toLocaleDateString()}</>
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'monospace', marginTop: '0.15rem' }}>{k.id}</div>
              </div>
              {k.isActive && (
                <button onClick={() => deactivate(k.id)} style={btnDanger}>Revoke</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KeysPage() {
  return <AuthGuard><KeysInner /></AuthGuard>;
}

const card: React.CSSProperties = { background: 'white', padding: '1rem 1.25rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
const btnPrimary: React.CSSProperties = { background: '#1a1a2e', color: 'white', padding: '0.5rem 1.25rem', borderRadius: 6, border: 'none', fontSize: '0.9rem', cursor: 'pointer', display: 'inline-block', textDecoration: 'none' };
const btnDanger: React.CSSProperties = { background: 'white', color: '#dc2626', border: '1px solid #fca5a5', padding: '0.35rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' };
const inactiveBadge: React.CSSProperties = { background: '#6b7280', color: 'white', padding: '1px 6px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box' };
