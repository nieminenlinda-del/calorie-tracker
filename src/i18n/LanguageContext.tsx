import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getLocale,
  mealSlotLabel,
  setLocale,
  subscribeLocale,
  t,
  tcount,
  type Locale,
  type MessageKey,
  type MessageVars,
} from './locale';

interface LanguageValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: MessageVars) => string;
  tcount: (count: number, one: MessageKey, other: MessageKey) => string;
  mealSlotLabel: typeof mealSlotLabel;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale);

  useEffect(() => subscribeLocale(setLocaleState), []);

  const value = useMemo<LanguageValue>(
    () => ({
      locale,
      setLocale,
      t,
      tcount,
      mealSlotLabel,
    }),
    [locale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
