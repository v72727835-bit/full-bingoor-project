import Link from 'next/link';
import React from 'react';

export default function NotFound() {
  return (
    <div className="page" style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ maxWidth: 420 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          404
        </p>
        <h1 className="h1" style={{ marginBottom: 10 }}>
          Page not found
        </h1>
        <p className="body-sm" style={{ marginBottom: 24 }}>
          The link may be out of date, or the product may no longer be available.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" className="btn btn-md btn-primary">
            Go to home
          </Link>
          <Link href="/categories" className="btn btn-md btn-outline">
            Browse categories
          </Link>
        </div>
      </div>
    </div>
  );
}
