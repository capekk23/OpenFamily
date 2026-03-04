import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OpenFamily Dashboard',
  description: 'AI Agent Governance Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#f5f5f5' }}>
        <nav style={{ background: '#1a1a2e', color: 'white', padding: '1rem 2rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <strong style={{ fontSize: '1.2rem' }}>OpenFamily</strong>
          <a href="/" style={{ color: 'white', textDecoration: 'none' }}>Overview</a>
          <a href="/approvals" style={{ color: 'white', textDecoration: 'none' }}>Approvals</a>
          <a href="/sessions" style={{ color: 'white', textDecoration: 'none' }}>Sessions</a>
          <a href="/activity" style={{ color: 'white', textDecoration: 'none' }}>Activity</a>
          <a href="/policies" style={{ color: 'white', textDecoration: 'none' }}>Policies</a>
        </nav>
        <main style={{ padding: '2rem' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
