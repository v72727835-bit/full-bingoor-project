'use client';

import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { API_URL } from '../../lib/config';
import { payWithRazorpay } from '../../lib/razorpay';
import { Alert, Button, PageLoader } from '../../components/ui';

/**
 * Where the Bingoor phone app sends a customer to pay online. The app passes the prepared
 * Razorpay order in the link's #fragment (never sent to any server); the order itself is only
 * created once the server has verified the payment.
 */
export default function PayPage() {
  const [state, setState] = useState<'starting' | 'paying' | 'done' | 'error'>('starting');
  const [message, setMessage] = useState('');

  const run = async () => {
    setState('starting');
    const p = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const orderId = p.get('o');
    const keyId = p.get('k');
    const amount = Number(p.get('a'));
    const token = p.get('t');
    if (!orderId || !keyId || !amount || !token) {
      setMessage('This payment link is not valid. Please go back to the app and try again.');
      setState('error');
      return;
    }
    try {
      setState('paying');
      const paid = await payWithRazorpay({ keyId, orderId, amountPaise: amount, name: '', method: p.get('m') || undefined });
      await axios.post(`${API_URL}/orders/online/confirm`, paid, { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
      setState('done');
    } catch (e) {
      const apiMessage = axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message : undefined;
      setMessage(apiMessage ?? (e instanceof Error ? e.message : 'The payment did not complete.'));
      setState('error');
    }
  };

  useEffect(() => {
    void run();
  }, []);

  return (
    <div className="page" style={{ paddingTop: 40, maxWidth: 520 }}>
      {state === 'starting' || state === 'paying' ? <PageLoader label="Opening the payment window…" /> : null}
      {state === 'done' ? (
        <>
          <h1 className="h1">Payment received</h1>
          <p className="body-sm" style={{ margin: '8px 0 20px' }}>
            Thank you! Your order is placed. Go back to the Bingoor app to see it.
          </p>
        </>
      ) : null}
      {state === 'error' ? (
        <>
          <Alert tone="bad">{message}</Alert>
          <p className="body-sm" style={{ margin: '12px 0 16px' }}>
            If money was deducted it is refunded automatically. Your cart in the app is safe.
          </p>
          <Button onClick={run}>Try again</Button>
        </>
      ) : null}
    </div>
  );
}
