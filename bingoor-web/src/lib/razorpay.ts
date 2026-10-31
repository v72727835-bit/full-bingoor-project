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
  /** #36: the way to pay the customer picked; the window shows only that, since its charge is in the amount. */
  method?: string;
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
      ...(opts.method && ONLY[opts.method]
        ? { config: { display: { blocks: { only: { name: ONLY[opts.method].name, instruments: ONLY[opts.method].instruments } }, sequence: ['block.only'], preferences: { show_default_blocks: false } } } }
        : {}),
      handler: (r: RazorpayResponse) => resolve(r),
      modal: { ondismiss: () => reject(new Error('Payment was cancelled. Your cart is safe, you can try again.')) },
    });
    rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'The payment failed. Please try again.')));
    rzp.open();
  });
}

/** Razorpay checkout blocks, one per way to pay at checkout. */
const ONLY: Record<string, { name: string; instruments: Record<string, unknown>[] }> = {
  upi: { name: 'Pay by UPI', instruments: [{ method: 'upi' }] },
  debit: { name: 'Pay by debit card', instruments: [{ method: 'card', types: ['debit'] }] },
  rupay: { name: 'Pay by RuPay debit card', instruments: [{ method: 'card', types: ['debit'], networks: ['RuPay'] }] },
  credit: { name: 'Pay by credit card', instruments: [{ method: 'card', types: ['credit'] }] },
  netbanking: { name: 'Pay by net banking', instruments: [{ method: 'netbanking' }] },
};
