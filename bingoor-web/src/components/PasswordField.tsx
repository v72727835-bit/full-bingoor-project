'use client';

import React, { useState } from 'react';
import { Icon } from './Icon';
import s from './PasswordField.module.css';

/* Ambiguous characters are left out on purpose: a generated password is often
   written on paper or read down a phone line, and 0/O, 1/l/I cost more support
   calls than the handful of extra combinations are worth. */
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT = '23456789';
const SYMBOL = '@#$%&*!?';
const LENGTH = 12; // inside the 8-15 character rule

/** A uniform index into `max`, free of the modulo bias a plain `%` would add. */
function pick(max: number): number {
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  let n = 0;
  do {
    crypto.getRandomValues(buf);
    n = buf[0];
  } while (n >= limit);
  return n % max;
}

/**
 * A password the customer does not have to invent. One character from each
 * class guarantees the mix, the rest is filled from the whole alphabet, and
 * the result is shuffled so the guaranteed four do not always sit in front.
 */
export function generatePassword(): string {
  const all = LOWER + UPPER + DIGIT + SYMBOL;
  const chars = [
    LOWER[pick(LOWER.length)],
    UPPER[pick(UPPER.length)],
    DIGIT[pick(DIGIT.length)],
    SYMBOL[pick(SYMBOL.length)],
  ];
  while (chars.length < LENGTH) chars.push(all[pick(all.length)]);

  for (let i = chars.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * The password box on the sign-up form: type your own, or have one made for
 * you. A generated password is revealed straight away and offered for copying
 * - a password the customer never sees is one they cannot save.
 */
export function PasswordField({
  value,
  onChange,
  id = 'password',
  autoComplete = 'new-password',
  minLength = 6,
  maxLength,
  placeholder,
  onGenerate,
  canGenerate = true,
  required,
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  /** Called with the new password, so a confirm box can be filled too. */
  onGenerate?: (password: string) => void;
  /** Only one box on a form needs the Generate button. */
  canGenerate?: boolean;
  required?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const next = generatePassword();
    onChange(next);
    onGenerate?.(next);
    setShown(true);
    setGenerated(true);
    setCopied(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked outside HTTPS and in some in-app browsers; the
      // password is on screen, so it can still be copied by hand.
      setShown(true);
    }
  };

  return (
    <div className={s.wrap}>
      <div className={s.box}>
        <input
          id={id}
          className={`input ${s.input}`}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setGenerated(false);
          }}
          minLength={minLength}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <div className={s.actions}>
          {value ? (
            <button
              type="button"
              className={s.iconBtn}
              onClick={copy}
              aria-label={copied ? 'Password copied' : 'Copy password'}
              title={copied ? 'Copied' : 'Copy'}
            >
              <Icon name={copied ? 'check' : 'copy'} size={17} />
            </button>
          ) : null}
          <button
            type="button"
            className={s.iconBtn}
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            title={shown ? 'Hide' : 'Show'}
          >
            <Icon name={shown ? 'eye-off' : 'eye'} size={17} />
          </button>
        </div>
      </div>

      {canGenerate ? (
      <div className={s.row}>
        <button type="button" className={s.generate} onClick={generate}>
          <Icon name="repeat" size={15} />
          {generated ? 'Generate another' : 'Generate a strong password'}
        </button>
        {generated ? (
          <span className={s.note}>
            {copied ? 'Copied — save it somewhere safe.' : 'Copy it and save it somewhere safe.'}
          </span>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}
