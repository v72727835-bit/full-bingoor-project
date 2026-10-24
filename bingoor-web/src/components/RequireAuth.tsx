'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui';

function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const params = useSearchParams();

  useEffect(() => {
    if (loading || user) return;
    const query = params.toString();
    const next = query ? `${pathname}?${query}` : pathname;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [loading, user, router, pathname, params]);

  if (loading || !user) return <PageLoader />;
  return <>{children}</>;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
