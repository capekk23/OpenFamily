import { apiFetch } from '@/lib/api';

interface Event {
  id: string;
  toolName: string;
  decision: string;
  reason: string;
  timestamp: string;
  sessionId: string;
  supervisorUsed: boolean;
}

interface EventsResponse {
  data: Event[];
  pagination: { total: number; page: number; pages: number };
}

const DECISION_COLORS: Record<string, string> = {
  APPROVED: '#22c55e',
  BLOCKED: '#ef4444',
  APPROVED_BY_SUPERVISOR: '#3b82f6',
  DENIED_BY_SUPERVISOR: '#f97316',
  PENDING_HUMAN: '#f59e0b',
  APPROVED_BY_HUMAN: '#22c55e',
  DENIED_BY_HUMAN: '#ef4444',
  TIMED_OUT: '#6b7280',
};

async function getEvents(): Promise<EventsResponse | null> {
  try {
    return await apiFetch<EventsResponse>('/api/events?limit=50');
  } catch {
    return null;
  }
}

export default async function ActivityPage() {
  const result = await getEvents();

  return (
    <div>
      <h1>Activity Log</h1>
      {!result ? (
        <p style={{ color: 'red' }}>Failed to load events. Is the API running?</p>
      ) : (
        <>
          <p style={{ color: '#666' }}>{result.pagination.total} total events</p>
          <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={th}>Time</th>
                  <th style={th}>Tool</th>
                  <th style={th}>Decision</th>
                  <th style={th}>Reason</th>
                  <th style={th}>Session</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((event) => (
                  <tr key={event.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={td}>{new Date(event.timestamp).toLocaleString()}</td>
                    <td style={td}><code>{event.toolName}</code></td>
                    <td style={td}>
                      <span style={{
                        background: DECISION_COLORS[event.decision] ?? '#6b7280',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.8rem',
                      }}>
                        {event.decision}
                      </span>
                    </td>
                    <td style={{ ...td, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event.reason}
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {event.sessionId.slice(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem 1rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#666',
};

const td: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.9rem',
};
