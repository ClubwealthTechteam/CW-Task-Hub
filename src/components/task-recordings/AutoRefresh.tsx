'use client';

// Reloads the page's data every few seconds (while Claude is writing a recording up), so the steps appear by themselves.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = window.setInterval(() => router.refresh(), seconds * 1000);
    return () => window.clearInterval(t);
  }, [router, seconds]);
  return null;
}
