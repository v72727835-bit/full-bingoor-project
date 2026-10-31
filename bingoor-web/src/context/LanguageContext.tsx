'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Lang, localName, translate } from '../lib/i18n';

const KEY = 'bingoor_lang';

interface LanguageApi {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** An interface word in the chosen language. */
  t: (key: string) => string;
  /** A product/category name in the chosen language (English when no Hindi name is set). */
  name: (entity: { name: string; nameHi?: string }) => string;
}

const LanguageContext = createContext<LanguageApi>({
  lang: 'en',
  setLang: () => undefined,
  t: (k) => translate(k, 'en'),
  name: (e) => e.name,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'hi' || saved === 'en') setLangState(saved);
    } catch {
      /* storage can be blocked; English is fine */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback((key: string) => translate(key, lang), [lang]);
  const name = useCallback((e: { name: string; nameHi?: string }) => localName(e, lang), [lang]);

  return <LanguageContext.Provider value={{ lang, setLang, t, name }}>{children}</LanguageContext.Provider>;
}

export const useLanguage = (): LanguageApi => useContext(LanguageContext);
