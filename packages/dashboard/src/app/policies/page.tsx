import { apiFetch } from '@/lib/api';

interface Policy {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  _count: { sessions: number; events: number };
}

async function getPolicies(): Promise<Policy[] | null> {
  try {
    return await apiFetch<Policy[]>('/api/policies');
  } catch {
    return null;
  }
}

export default async function PoliciesPage() {
  const policies = await getPolicies();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Policies</h1>
      </div>
      {!policies ? (
        <p style={{ color: 'red' }}>Failed to load policies. Is the API running?</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {policies.map((policy) => (
            <div key={policy.id} style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>{policy.name}</strong>
                  <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.85rem' }}>v{policy.version}</span>
                  {!policy.isActive && (
                    <span style={{ marginLeft: '0.5rem', background: '#6b7280', color: 'white', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>
                      INACTIVE
                    </span>
                  )}
                </div>
                <div style={{ color: '#666', fontSize: '0.9rem' }}>
                  {policy._count.sessions} sessions · {policy._count.events} events
                </div>
              </div>
              <div style={{ color: '#999', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                ID: {policy.id} · Created {new Date(policy.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
          {policies.length === 0 && <p style={{ color: '#666' }}>No policies yet. Create one via the API.</p>}
        </div>
      )}
    </div>
  );
}
