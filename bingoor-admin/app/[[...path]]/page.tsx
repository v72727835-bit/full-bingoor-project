import React, { Suspense } from 'react';
import AdminApp from '../../src/AdminApp';
import { CenterSpinner } from '../../src/components/ui';

export default function Page() {
  return (
    <Suspense fallback={<CenterSpinner />}>
      <AdminApp />
    </Suspense>
  );
}