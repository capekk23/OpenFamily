'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // First check if setup is needed (no admin yet)
    fetch(`${API_URL}/api/auth/setup-status`)
      .then(r => r.json())
      .then((d: { needsSetup: boolean }) => {
        if (d.needsSetup) {
          router.replace('/setup');
        } else if (!isLoggedIn()) {
          router.replace('/login');
        } else {
          setChecked(true);
        }
      })
      .catch(() => {
        // API unreachable — fall back to normal auth check
        if (!isLoggedIn()) {
          router.replace('/login');
        } else {
          setChecked(true);
        }
      });
  }, [router]);

  if (!checked) return null;
  return <>{children}</>;
}
