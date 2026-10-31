import { InvoiceLinks } from '../api/admin';

/** Opens a bill in a new tab. The tab is opened first so the browser's pop-up blocker lets it through. */
export async function openBill(getLinks: () => Promise<InvoiceLinks>, format: 'a4' | 'pos'): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const links = await getLinks();
    const url = links[format];
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (e) {
    tab?.close();
    throw e;
  }
}
