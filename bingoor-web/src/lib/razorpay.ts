/* Loads Razorpay's checkout window once and opens it for a prepared order. */

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (r: { error?: { description?: string } }) => void) => void };
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const el = document.createElement('script');
    el.src = 'https://checkout.razorpay.com/v1/checkout.js';
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Could not load the payment window. Check your internet connection.'));
    document.body.appendChild(el);
  });
}

/** Resolves with the signed payment details, or rejects if the customer closes the window or the payment fails. */
export async function payWithRazorpay(opts: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  phone?: string;
  email?: string;
}): Promise<RazorpayResponse> {
  await loadScript();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: opts.keyId,
      order_id: opts.orderId,
      amount: opts.amountPaise,
      currency: 'INR',
      name: 'Bingoor',
      description: 'Your Bingoor order',
      prefill: { name: opts.name, contact: opts.phone, email: opts.email },
      theme: { color: '#B8005F' },
      handler: (r: RazorpayResponse) => resolve(r),
      modal: { ondismiss: () => reject(new Error('Payment was cancelled. Your cart is safe, you can try again.')) },
    });
    rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'The payment failed. Please try again.')));
    rzp.open();
  });
}
