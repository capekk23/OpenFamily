'use client';

import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import PolicyEditor from '@/components/PolicyEditor';
import { getToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

function NewPolicyInner() {
  const router = useRouter();

  const save = async (name: string, rules: unknown) => {
    const res = await fetch(`${API_URL}/api/policies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ name, rules }),
    });
    const data = await res.json() as { error?: string; id?: string };
    if (!res.ok) throw new Error(JSON.stringify(data.error));
    router.push('/policies');
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/policies" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.9rem' }}>← Policies</a>
        <h1 style={{ margin: '0.5rem 0 0' }}>New Policy</h1>
      </div>
      <div style={{ background: 'white', padding: '1.75rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <PolicyEditor onSave={save} saveLabel="Create Policy" />
      </div>
    </div>
  );
}

export default function NewPolicyPage() {
  return <AuthGuard><NewPolicyInner /></AuthGuard>;
}
