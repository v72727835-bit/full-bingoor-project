import { Share } from 'react-native';
import { WEB_URL } from '../config';

/**
 * Hands a product or an aisle to the phone's own share sheet, which is where
 * WhatsApp, Instagram and the rest already live - a hand-built row of brand
 * buttons would only be a worse copy of it.
 */
export async function shareLink(title: string, path: string): Promise<void> {
  const url = `${WEB_URL}${path}`;
  try {
    await Share.share({ title, message: `${title} on Bingoor\n${url}`, url }, { dialogTitle: `Share ${title}` });
  } catch {
    /* the customer closed the sheet */
  }
}
