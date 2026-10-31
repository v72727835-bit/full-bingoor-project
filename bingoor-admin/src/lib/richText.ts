/*
 * Product descriptions can be pasted from Word or another website, so they may
 * arrive as HTML. Only a small set of tags and styles is kept: headings, bold,
 * italic, underline, lists, line breaks and the font size / weight the admin
 * chose. Everything else (scripts, links, classes, Word's mso-* styles) is dropped.
 * The same file lives in the website (bingoor-web/src/lib/richText.ts) - keep both in step.
 */

const KEEP = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'DIV', 'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH']);
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'HEAD', 'TITLE', 'META', 'LINK', 'XML']);
const STYLES = ['font-size', 'font-weight', 'font-style', 'text-decoration', 'text-align'];

/** True when the text carries markup and should be rendered as rich text. */
export function isRichText(text: string | undefined | null): boolean {
  return !!text && /<\s*(p|br|b|strong|i|em|u|ul|ol|li|h[1-6]|span|div|table)\b/i.test(text);
}

function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((rule) => rule.trim())
    .filter((rule) => {
      const [prop, ...rest] = rule.split(':');
      const value = rest.join(':').trim().toLowerCase();
      if (!STYLES.includes(prop?.trim().toLowerCase() ?? '') || !value) return false;
      // Values are plain words and sizes only - no url(), expression() or similar.
      return /^[a-z0-9.%\s-]+$/.test(value);
    })
    .join('; ');
}

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === 3) return doc.createTextNode(node.textContent ?? '');
  if (node.nodeType !== 1) return null;
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (DROP_WITH_CONTENT.has(tag) || tag.includes(':')) return null;
  const kids = Array.from(el.childNodes)
    .map((c) => cleanNode(c, doc))
    .filter(Boolean) as Node[];
  if (!KEEP.has(tag)) {
    // Unknown wrapper (a, font, o:p...): keep what is inside it.
    const frag = doc.createDocumentFragment();
    kids.forEach((k) => frag.appendChild(k));
    return frag;
  }
  const out = doc.createElement(tag.toLowerCase());
  const style = cleanStyle(el.getAttribute('style') ?? '');
  if (style) out.setAttribute('style', style);
  kids.forEach((k) => out.appendChild(k));
  return out;
}

/** Cleans pasted or stored HTML down to the safe subset. Browser only. */
export function sanitizeRichText(html: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const box = doc.createElement('div');
  Array.from(doc.body.childNodes).forEach((n) => {
    const c = cleanNode(n, doc);
    if (c) box.appendChild(c);
  });
  return box.innerHTML.replace(/(<p>(\s|&nbsp;)*<\/p>)+/g, '<p><br></p>').trim();
}
