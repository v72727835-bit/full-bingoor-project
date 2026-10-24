/** Reads an HTTP Range header ("bytes=0-99", "bytes=500-", "bytes=-100") for a file of `size` bytes. */
export type ByteRange = { start: number; end: number } | 'unsatisfiable' | null;

export function parseRange(header: string | undefined, size: number): ByteRange {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || (!m[1] && !m[2])) return null;
  let start: number;
  let end: number;
  if (!m[1]) {
    // "the last N bytes"
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (size === 0 || start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}
