'use client';

import { useEffect, useState } from 'react';

interface Approval {
  id: string;
  status: string;
  requestedAt: string;
  expiresAt: string;
  event: {
    toolName: string;
    toolInput: unknown;
    supervisorNotes?: string;
    supervisorUsed: boolean;
  };
  session: {
    agentId: string;
    agentName?: string;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApprovals = async () => {
    try {
      const res = await fetch(`${API_URL}/api/approvals/pending`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
      });
      const data = await res.json() as Approval[];
      setApprovals(data);
    } catch (err) {
      setError('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();

    // SSE for real-time updates
    const evtSource = new EventSource(`${API_URL}/api/approvals/stream`);
    evtSource.onmessage = () => fetchApprovals();
    return () => evtSource.close();
  }, []);

  const resolve = async (id: string, action: 'approve' | 'deny', note?: string) => {
    await fetch(`${API_URL}/api/approvals/${id}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
      },
      body: JSON.stringify({ reviewNote: note }),
    });
    await fetchApprovals();
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h1>Pending Approvals ({approvals.length})</h1>
      {approvals.length === 0 && <p style={{ color: '#666' }}>No pending approvals.</p>}
      {approvals.map((approval) => (
        <div key={approval.id} style={{ background: 'white', padding: '1.5rem', borderRadius: 8, marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <strong style={{ fontSize: '1.1rem' }}>{approval.event.toolName}</strong>
              <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Agent: {approval.session.agentName ?? approval.session.agentId}
              </div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>
                Requested: {new Date(approval.requestedAt).toLocaleString()}
              </div>
              {approval.event.supervisorUsed && approval.event.supervisorNotes && (
                <div style={{ background: '#fef3c7', padding: '0.5rem', borderRadius: 4, marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  <strong>Supervisor notes:</strong> {approval.event.supervisorNotes}
                </div>
              )}
              <pre style={{ background: '#f5f5f5', padding: '0.5rem', borderRadius: 4, fontSize: '0.8rem', marginTop: '0.5rem', maxHeight: 100, overflow: 'auto' }}>
                {JSON.stringify(approval.event.toolInput, null, 2)}
              </pre>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => resolve(approval.id, 'approve')}
                style={{ background: '#22c55e', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer' }}
              >
                Approve
              </button>
              <button
                onClick={() => resolve(approval.id, 'deny')}
                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer' }}
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
