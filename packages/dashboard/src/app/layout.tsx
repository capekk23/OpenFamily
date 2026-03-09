import type { Metadata } from 'next';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'OpenFamily Dashboard',
  description: 'AI Agent Governance Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, -apple-system, sans-serif', margin: 0, background: '#f5f5f5', minHeight: '100vh' }}>
        <NavBar />
        <main style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
