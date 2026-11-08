import { env } from '../config/env';

/**
 * Point 31: a WhatsApp message to the customer the moment an order is placed
 * (from the app or the website). Uses the Meta WhatsApp Cloud API when the
 * server has WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID set; otherwise this is
 * a no-op, so orders work exactly as before until the credentials are added.
 *
 * It never throws and never blocks checkout: a failed message is logged and
 * swallowed.
 */

const GRAPH_VERSION = 'v21.0';

export function whatsappEnabled(): boolean {
  return !!(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Meta needs E.164 digits with the country code and no "+". Defaults to India (91). */
function toWhatsAppNumber(phone?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

export interface OrderAlert {
  phone?: string;
  name?: string;
  orderNumber?: string | number;
  total?: number;
  itemCount?: number;
  paymentMethod?: 'cod' | 'online';
}

export async function sendOrderWhatsApp(order: OrderAlert): Promise<void> {
  if (!whatsappEnabled()) return;
  const to = toWhatsAppNumber(order.phone);
  if (!to) return;

  const pay = order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online';
  const body =
    `Hi ${order.name || 'there'}, your Bingoor order #${order.orderNumber ?? ''} is confirmed.\n` +
    `${order.itemCount ?? 0} item(s) · Total ₹${order.total ?? 0} · ${pay}.\n` +
    `We will let you know as it is packed and on the way. Thank you for shopping with Bingoor!`;

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn('[whatsapp] order alert failed', res.status, detail.slice(0, 300));
    }
  } catch (err) {
    console.warn('[whatsapp] order alert error', (err as Error).message);
  }
}
