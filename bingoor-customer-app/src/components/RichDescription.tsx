import React from 'react';
import { StyleSheet, TextStyle, View } from 'react-native';
import { Txt } from '../ui/Text';

/*
 * Product descriptions can be formatted HTML (pasted from Word or a website in the
 * admin panel). The website renders it directly; here it is turned into plain
 * Text blocks: headings, bold / italic / underline, lists and the font size the
 * admin used. No WebView or extra native library is needed.
 */

type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; size?: number };
type Block = { kind: 'p' | 'h' | 'li'; level?: number; bullet?: string; runs: Run[] };

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'ol', 'tr', 'table', 'tbody', 'thead']);
const HEAD_SIZE: Record<number, number> = { 1: 20, 2: 18, 3: 16, 4: 15, 5: 15, 6: 15 };

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** "font-size: 14pt" / "18px" -> a phone-friendly px size (kept between 12 and 22). */
function sizeFrom(style: string | undefined): number | undefined {
  const m = style?.match(/font-size\s*:\s*([\d.]+)\s*(pt|px)?/i);
  if (!m) return undefined;
  let px = Number(m[1]);
  if (m[2]?.toLowerCase() === 'pt') px *= 1.333;
  return Math.max(12, Math.min(22, Math.round(px)));
}

export function parseRichText(html: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const stack: { tag: string; bold?: boolean; italic?: boolean; underline?: boolean; size?: number }[] = [];
  const lists: { ordered: boolean; n: number }[] = [];

  const flush = () => {
    if (cur && cur.runs.some((r) => r.text.trim())) blocks.push(cur);
    cur = null;
  };
  const ensure = () => {
    if (!cur) cur = { kind: 'p', runs: [] };
    return cur;
  };

  const re = /<!--[\s\S]*?-->|<\s*(\/)?\s*([a-zA-Z0-9:]+)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) {
      const text = decode(m[4]).replace(/\s+/g, ' ');
      if (!text.trim() && !cur) continue;
      const fmt = stack.reduce((a, s) => ({ bold: a.bold || s.bold, italic: a.italic || s.italic, underline: a.underline || s.underline, size: s.size ?? a.size }), {} as Omit<Run, 'text'>);
      ensure().runs.push({ text, ...fmt });
      continue;
    }
    if (!m[2]) continue;
    const closing = !!m[1];
    const tag = m[2].toLowerCase();
    const attrs = m[3] ?? '';
    if (tag === 'br') {
      ensure().runs.push({ text: '\n' });
      continue;
    }
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.splice(i, 1);
          break;
        }
      }
      if (tag === 'ul' || tag === 'ol') lists.pop();
      if (BLOCK_TAGS.has(tag)) flush();
      continue;
    }
    const style = attrs.match(/style\s*=\s*"([^"]*)"|style\s*=\s*'([^']*)'/i);
    const css = style ? style[1] ?? style[2] : undefined;
    const bold = tag === 'b' || tag === 'strong' || /^h[1-6]$/.test(tag) || /font-weight\s*:\s*(bold|[6-9]00)/i.test(css ?? '');
    const italic = tag === 'i' || tag === 'em' || /font-style\s*:\s*italic/i.test(css ?? '');
    const underline = tag === 'u' || /text-decoration\s*:\s*underline/i.test(css ?? '');
    if (BLOCK_TAGS.has(tag)) {
      flush();
      if (tag === 'ul' || tag === 'ol') lists.push({ ordered: tag === 'ol', n: 0 });
      if (/^h[1-6]$/.test(tag)) cur = { kind: 'h', level: Number(tag[1]), runs: [] };
      else if (tag === 'li') {
        const list = lists[lists.length - 1];
        if (list) list.n += 1;
        cur = { kind: 'li', bullet: list?.ordered ? `${list.n}.` : '•', runs: [] };
      }
    }
    if (!/\/\s*$/.test(attrs)) stack.push({ tag, bold, italic, underline, size: sizeFrom(css) });
  }
  flush();
  return blocks;
}

export function RichDescription({ text }: { text: string }) {
  if (!/<\s*(p|br|b|strong|i|em|u|ul|ol|li|h[1-6]|span|div|table)\b/i.test(text)) {
    return (
      <Txt variant="body" tone="body">
        {text}
      </Txt>
    );
  }
  const blocks = parseRichText(text);
  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        const base: TextStyle | undefined = b.kind === 'h' ? { fontSize: HEAD_SIZE[b.level ?? 3], lineHeight: (HEAD_SIZE[b.level ?? 3] ?? 16) * 1.35 } : undefined;
        const body = (
          <Txt variant="body" tone={b.kind === 'h' ? 'ink' : 'body'} weight={b.kind === 'h' ? '700' : undefined} style={[base, b.kind === 'li' && styles.liText]}>
            {b.runs.map((r, j) => (
              <Txt
                key={j}
                variant="body"
                tone={r.bold || b.kind === 'h' ? 'ink' : 'body'}
                weight={r.bold ? '700' : undefined}
                style={[
                  base,
                  r.italic && styles.italic,
                  r.underline && styles.underline,
                  r.size && b.kind !== 'h' ? { fontSize: r.size, lineHeight: Math.round(r.size * 1.45) } : null,
                ]}
              >
                {r.text}
              </Txt>
            ))}
          </Txt>
        );
        return b.kind === 'li' ? (
          <View key={i} style={styles.li}>
            <Txt variant="body" tone="body" style={styles.bullet}>
              {b.bullet}
            </Txt>
            {body}
          </View>
        ) : (
          <View key={i} style={b.kind === 'h' ? styles.head : styles.para}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  para: { marginBottom: 6 },
  head: { marginTop: 8, marginBottom: 2 },
  li: { flexDirection: 'row', marginBottom: 3, paddingLeft: 4 },
  bullet: { width: 20 },
  liText: { flex: 1 },
  italic: { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
});
