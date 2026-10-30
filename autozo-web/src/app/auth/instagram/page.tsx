'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getErrorMessage } from '../../../lib/client';
import { finishInstagramLogin, instagramRedirectUri } from '../../../lib/social';
import { Alert, PageLoader } from '../../../components/ui';

/** Instagram sends the customer back here with a one-time code; the server finishes the sign-in. */
function InstagramReturn() {
  const params = useSearchParams();
  const router = useRouter();
  const { loginWithInstagram } = useAuth();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = params.get('code');
    const { ok, next } = finishInstagramLogin(params.get('state'));
    if (params.get('error') || !code) {
      setError('Instagram sign-in was closed. Please try again, or continue with your phone number.');
      return;
    }
    if (!ok) {
      setError('This Instagram sign-in link has expired. Please tap “Continue with Instagram” again.');
      return;
    }
    loginWithInstagram(code, instagramRedirectUri())
      .then(() => router.replace(next))
      .catch((e) => setError(getErrorMessage(e)));
  }, [params, router, loginWithInstagram]);

  if (!error) return <PageLoader label="Signing you in with Instagram…" />;
  return (
    <div className="page" style={{ paddingTop: 28, maxWidth: 560 }}>
      <Alert tone="bad">{error}</Alert>
      <Link href="/login" className="btn btn-md btn-primary">
        Back to login
      </Link>
    </div>
  );
}

export default function InstagramReturnPage() {
  return (
    <Suspense fallback={<PageLoader label="Signing you in with Instagram…" />}>
      <InstagramReturn />
    </Suspense>
  );
}
