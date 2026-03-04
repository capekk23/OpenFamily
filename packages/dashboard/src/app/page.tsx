import { apiFetch } from '@/lib/api';

interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  totalEvents: number;
  pendingApprovals: number;
  eventsByDecision: Record<string, number>;
}

async function getStats(): Promise<DashboardStats | null> {
  try {
    return await apiFetch<DashboardStats>('/api/dashboard/stats');
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <div>
      <h1>OpenFamily — Activity Overview</h1>

      {!stats ? (
        <p style={{ color: 'red' }}>Failed to load stats. Is the API running?</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <StatCard label="Total Sessions" value={stats.totalSessions} />
          <StatCard label="Active Sessions" value={stats.activeSessions} color="#22c55e" />
          <StatCard label="Total Events" value={stats.totalEvents} />
          <StatCard label="Pending Approvals" value={stats.pendingApprovals} color={stats.pendingApprovals > 0 ? '#f59e0b' : undefined} />
        </div>
      )}

      {stats?.eventsByDecision && (
        <div>
          <h2>Decisions Breakdown</h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {Object.entries(stats.eventsByDecision).map(([decision, count]) => (
              <div key={decision} style={{ background: 'white', padding: '0.75rem 1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{count}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{decision}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: color ?? '#1a1a2e' }}>{value}</div>
      <div style={{ color: '#666', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}
