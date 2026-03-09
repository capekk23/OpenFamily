'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import AuthGuard from '@/components/AuthGuard';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

interface Policy {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  _count: { sessions: number; events: number };
}

function PoliciesInner() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/policies`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setPolicies(await res.json() as Policy[]);
    else setError('Failed to load policies');
    setLoading(false);
  };

  const deactivate = async (id: string) => {
    await fetch(`${API_URL}/api/policies/${id}`, {
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
        <h1 style={{ margin: 0 }}>Policies</h1>
        <Link href="/policies/new" style={btnPrimary}>+ New Policy</Link>
      </div>

      {policies.length === 0 && (
        <div style={emptyState}>
          <p>No policies yet.</p>
          <Link href="/policies/new" style={btnPrimary}>Create your first policy</Link>
        </div>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {policies.map((p) => (
          <div key={p.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '1.05rem' }}>{p.name}</strong>
                  <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>v{p.version}</span>
                  {!p.isActive && <span style={badge('#6b7280')}>INACTIVE</span>}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                  {p._count.sessions} sessions · {p._count.events} events · Created {new Date(p.createdAt).toLocaleDateString()}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'monospace', marginTop: '0.2rem' }}>{p.id}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Link href={`/policies/${p.id}`} style={btnSecondary}>Edit</Link>
                {p.isActive && (
                  <button onClick={() => deactivate(p.id)} style={btnDanger}>Deactivate</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PoliciesPage() {
  return <AuthGuard><PoliciesInner /></AuthGuard>;
}

const card: React.CSSProperties = { background: 'white', padding: '1.25rem 1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
const emptyState: React.CSSProperties = { textAlign: 'center', padding: '3rem', color: '#6b7280' };
const btnPrimary: React.CSSProperties = { background: '#1a1a2e', color: 'white', padding: '0.5rem 1.25rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.9rem', display: 'inline-block' };
const btnSecondary: React.CSSProperties = { background: '#f3f4f6', color: '#374151', padding: '0.4rem 0.9rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.85rem', border: '1px solid #e5e7eb', display: 'inline-block' };
const btnDanger: React.CSSProperties = { background: 'white', color: '#dc2626', border: '1px solid #fca5a5', padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' };
const badge = (color: string): React.CSSProperties => ({ background: color, color: 'white', padding: '1px 6px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600 });
