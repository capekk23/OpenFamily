import { apiFetch } from '@/lib/api';

interface Session {
  id: string;
  agentId: string;
  agentName?: string;
  status: string;
  spentBudget: string;
  startedAt: string;
  policy: { id: string; name: string };
  _count: { events: number; approvals: number };
}

interface SessionsResponse {
  data: Session[];
  pagination: { total: number };
}

async function getSessions(): Promise<SessionsResponse | null> {
  try {
    return await apiFetch<SessionsResponse>('/api/sessions?limit=50');
  } catch {
    return null;
  }
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e',
  TERMINATED: '#6b7280',
  EXPIRED: '#f59e0b',
};

export default async function SessionsPage() {
  const result = await getSessions();

  return (
    <div>
      <h1>Agent Sessions</h1>
      {!result ? (
        <p style={{ color: 'red' }}>Failed to load sessions. Is the API running?</p>
      ) : (
        <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={th}>Agent</th>
                <th style={th}>Policy</th>
                <th style={th}>Status</th>
                <th style={th}>Events</th>
                <th style={th}>Budget Spent</th>
                <th style={th}>Started</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((session) => (
                <tr key={session.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={td}>
                    <div>{session.agentName ?? session.agentId}</div>
                    <div style={{ fontSize: '0.75rem', color: '#999', fontFamily: 'monospace' }}>{session.id.slice(0, 8)}...</div>
                  </td>
                  <td style={td}>{session.policy.name}</td>
                  <td style={td}>
                    <span style={{ background: STATUS_COLORS[session.status] ?? '#6b7280', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem' }}>
                      {session.status}
                    </span>
                  </td>
                  <td style={td}>{session._count.events}</td>
                  <td style={td}>${Number(session.spentBudget).toFixed(4)}</td>
                  <td style={td}>{new Date(session.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#666' };
const td: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.9rem' };
