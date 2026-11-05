'use client';

import React, { useEffect, useState } from 'react';

/** HTTPS callback registered with Meta. The app validates its own random OAuth state. */
export default function MobileLoginReturn() {
  const [link, setLink] = useState('');
  useEffect(() => {
    const provider = window.location.pathname.split('/').pop();
    if (provider !== 'facebook' && provider !== 'instagram') return;
    const input = new URLSearchParams(window.location.search);
    const output = new URLSearchParams();
    for (const key of ['code', 'state', 'error']) {
      const value = input.get(key);
      if (value) output.set(key, value);
    }
    const target = `bingoor://auth/${provider}?${output.toString()}`;
    setLink(target);
    window.location.replace(target);
  }, []);
  return <div className="page" style={{ padding: 32 }}><h1>Return to Bingoor</h1>
    <p>Complete sign-in in the Bingoor app.</p>{link ? <a href={link}>Open Bingoor app</a> : null}</div>;
}
