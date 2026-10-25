import React, { useEffect, useRef } from 'react';
import { isRichText, sanitizeRichText } from '../lib/richText';

/**
 * Description box that keeps formatting. Text pasted from Word or a website keeps
 * its headings, bold and font sizes; the toolbar adds them by hand. The value is
 * cleaned HTML (see lib/richText.ts), which the website and app show as-is.
 */
export default function RichTextField({ value, onChange, minHeight = 160 }: { value: string; onChange: (html: string) => void; minHeight?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<string>('');

  // Load the stored text when the form opens (plain old descriptions keep their line breaks).
  useEffect(() => {
    const el = box.current;
    if (!el || value === last.current) return;
    el.innerHTML = isRichText(value) ? sanitizeRichText(value) : escapeLines(value);
    last.current = value;
  }, [value]);

  const emit = () => {
    const el = box.current;
    if (!el) return;
    const text = el.innerText.trim();
    const html = text ? sanitizeRichText(el.innerHTML) : '';
    last.current = html;
    onChange(html);
  };

  const cmd = (name: string, arg?: string) => {
    box.current?.focus();
    document.execCommand(name, false, arg);
    emit();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    e.preventDefault();
    document.execCommand('insertHTML', false, html ? sanitizeRichText(html) : escapeLines(text));
    emit();
  };

  const btn = (label: React.ReactNode, title: string, run: () => void) => (
    <button type="button" className="btn btn-ghost btn-sm" title={title} onMouseDown={(e) => e.preventDefault()} onClick={run} style={{ minWidth: 34 }}>
      {label}
    </button>
  );

  return (
    <div style={{ border: '1px solid var(--line, #E2E8F0)', borderRadius: 10, background: 'var(--surface, #fff)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 4, borderBottom: '1px solid var(--line, #E2E8F0)' }}>
        {btn(<b>B</b>, 'Bold', () => cmd('bold'))}
        {btn(<i>I</i>, 'Italic', () => cmd('italic'))}
        {btn(<u>U</u>, 'Underline', () => cmd('underline'))}
        {btn('Title', 'Big title', () => cmd('formatBlock', 'h2'))}
        {btn('Sub title', 'Small title', () => cmd('formatBlock', 'h3'))}
        {btn('Text', 'Normal text', () => cmd('formatBlock', 'p'))}
        {btn('• List', 'Bullet list', () => cmd('insertUnorderedList'))}
        {btn('1. List', 'Numbered list', () => cmd('insertOrderedList'))}
      </div>
      <div
        ref={box}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        style={{ minHeight, padding: '10px 12px', outline: 'none', lineHeight: 1.6, overflowWrap: 'anywhere' }}
      />
      <div className="cell-muted" style={{ fontSize: 12, padding: '0 12px 8px' }}>
        Tip: copy from Word or any website and paste here - bold, titles and font size stay the same on the website and app.
      </div>
    </div>
  );
}

function escapeLines(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split(/\n/)
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('');
}
