'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import PolicyEditor from '@/components/PolicyEditor';
import { getToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

interface Policy {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  rules: unknown;
}

function EditPolicyInner() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/policies/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then((data: Policy) => { setPolicy(data); setLoading(false); })
      .catch(() => { setError('Failed to load policy'); setLoading(false); });
  }, [id]);

  const save = async (name: string, rules: unknown) => {
    const res = await fetch(`${API_URL}/api/policies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ name, rules }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) throw new Error(JSON.stringify(data.error));
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!policy) return null;

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/policies" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}>← Policies</a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <h1 style={{ margin: 0 }}>Edit Policy</h1>
          {!policy.isActive && (
            <span style={{ background: '#6b7280', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
              INACTIVE
            </span>
          )}
          <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>v{policy.version}</span>
        </div>
        <div style={{ color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'monospace', marginTop: '0.25rem' }}>{policy.id}</div>
      </div>
      <div style={{ background: 'white', padding: '1.75rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <PolicyEditor
          initialName={policy.name}
          initialRules={JSON.stringify(policy.rules, null, 2)}
          onSave={save}
          saveLabel="Save Changes"
        />
      </div>
    </div>
  );
}

export default function EditPolicyPage() {
  return <AuthGuard><EditPolicyInner /></AuthGuard>;
}
