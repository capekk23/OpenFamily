'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearTokens } from '@/lib/auth';

export default function NavBar() {
  const router = useRouter();

  const logout = () => {
    clearTokens();
    router.replace('/login');
  };

  return (
    <nav style={{
      background: '#1a1a2e',
      color: 'white',
      padding: '0 2rem',
      display: 'flex',
      gap: '2rem',
      alignItems: 'center',
      height: 56,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link href="/" style={{ color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem', marginRight: '1rem' }}>
        OpenFamily
      </Link>
      {[
        { href: '/', label: 'Overview' },
        { href: '/approvals', label: 'Approvals' },
        { href: '/sessions', label: 'Sessions' },
        { href: '/activity', label: 'Activity' },
        { href: '/policies', label: 'Policies' },
        { href: '/keys', label: 'API Keys' },
        { href: '/settings', label: 'Settings' },
      ].map(({ href, label }) => (
        <Link key={href} href={href} style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: '0.9rem' }}>
          {label}
        </Link>
      ))}
      <div style={{ flex: 1 }} />
      <button onClick={logout} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
        Sign out
      </button>
    </nav>
  );
}
