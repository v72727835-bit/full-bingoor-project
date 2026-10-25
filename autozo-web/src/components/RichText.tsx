'use client';

import React, { useEffect, useState } from 'react';
import { isRichText, sanitizeRichText } from '../lib/richText';
import s from './RichText.module.css';

/** A product description: formatted text from Word / a website, or plain text with its line breaks kept. */
export function RichText({ text }: { text: string }) {
  const rich = isRichText(text);
  // DOMParser only exists in the browser, so the cleaned HTML is made after mount.
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    setHtml(rich ? sanitizeRichText(text) : null);
  }, [text, rich]);

  if (rich && html !== null) return <div className={s.rich} dangerouslySetInnerHTML={{ __html: html }} />;
  return <p className={s.plain}>{rich ? text.replace(/<[^>]*>/g, ' ') : text}</p>;
}
