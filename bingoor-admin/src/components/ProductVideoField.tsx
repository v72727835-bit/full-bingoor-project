"use client";

import React, { useRef, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { Button, Field } from './ui';

const isFile = (url: string) => /\.(mp4|webm)(\?.*)?$/i.test(url) || /\/uploads\/products\/[^/]+\.(mp4|webm)$/i.test(url);
const isYoutube = (url: string) => /(youtube\.com|youtu\.be)\//i.test(url);

/**
 * A product's optional video: upload an .mp4 / .webm file, or paste a YouTube /
 * Vimeo link. The same field is used by the super admin and the warehouse panel;
 * they differ only in the upload call and the size limit.
 */
export default function ProductVideoField({
  value,
  onChange,
  upload,
  maxMb,
}: {
  value: string;
  onChange: (url: string) => void;
  upload: (file: File) => Promise<string>;
  maxMb: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (file.size > maxMb * 1024 * 1024) {
      setError(`This video is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${maxMb} MB: shorten or compress it, or paste a YouTube link instead.`);
      return;
    }
    setBusy(true);
    try {
      onChange(await upload(file));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label="Product video (optional)">
      {value ? (
        <div style={{ marginBottom: 8 }}>
          {isFile(value) ? (
            <video src={value} controls preload="metadata" style={{ width: '100%', maxWidth: 360, borderRadius: 10, background: '#000' }} />
          ) : (
            <div className="cell-muted" style={{ fontSize: 13 }}>
              {isYoutube(value) ? 'YouTube video' : 'Video link'}: {value}
            </div>
          )}
        </div>
      ) : null}
      <div className="row-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Uploading…' : value ? 'Replace video' : 'Upload video'}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange('')}>
            Remove video
          </Button>
        ) : null}
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Or paste a YouTube link" style={{ fontSize: 12.5, flex: 1, minWidth: 180 }} />
      </div>
      <input ref={fileRef} type="file" accept="video/mp4,video/webm" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="page-subtitle">MP4 or WebM up to {maxMb} MB, or a YouTube link. Customers see it on the product page.</div>
      {error ? <div className="error-banner" style={{ marginTop: 8 }}>{error}</div> : null}
    </Field>
  );
}
