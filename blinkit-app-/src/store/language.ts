import { useCallback, useSyncExternalStore } from 'react';
import { localStore } from '../storage/tokens';

/**
 * English or Hindi names for groups, categories and products, like the
 * website's language menu. The admin types both names; a missing Hindi name
 * falls back to English.
 */
export type Lang = 'en' | 'hi';

let lang: Lang = 'en';
const listeners = new Set<() => void>();

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  listeners.forEach((l) => l());
  void localStore.setLang(next).catch(() => undefined);
}

/** Restores the saved choice once at start-up. */
export function loadLang() {
  localStore
    .getLang()
    .then((saved) => {
      if (saved === 'hi') setLang('hi');
    })
    .catch(() => undefined);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, () => lang);
}

/** A name in the chosen language: localName({ name, nameHi }). */
export function useLocalName() {
  const current = useLang();
  return useCallback(
    (entity: { name?: string; nameHi?: string } | null | undefined, fallback = '') =>
      (current === 'hi' && entity?.nameHi ? entity.nameHi : entity?.name) ?? fallback,
    [current],
  );
}
