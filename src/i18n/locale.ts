import type { MealSlot } from '../domain/types';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  STRINGS,
  type Locale,
  type MessageKey,
} from './strings';

export type { Locale, MessageKey };
export { DEFAULT_LOCALE, LOCALES, LOCALE_STORAGE_KEY } from './strings';

export type MessageVars = Record<string, string | number>;

let currentLocale: Locale = DEFAULT_LOCALE;
const listeners = new Set<(locale: Locale) => void>();

function isLocale(value: string | null | undefined): value is Locale {
  return value === 'sv' || value === 'en';
}

export function readStoredLocale(): Locale {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_LOCALE;
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // private mode / workers without storage
  }
  return DEFAULT_LOCALE;
}

function persistLocale(locale: Locale): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore quota / access errors
  }
}

export function applyDocumentLang(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale, options?: { persist?: boolean }): void {
  currentLocale = locale;
  if (options?.persist !== false) persistLocale(locale);
  applyDocumentLang(locale);
  listeners.forEach((listener) => listener(locale));
}

/** Apply a stored or explicit locale without notifying (startup / worker). */
export function initLocale(locale: Locale = readStoredLocale()): Locale {
  currentLocale = locale;
  applyDocumentLang(locale);
  return locale;
}

export function subscribeLocale(listener: (locale: Locale) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? `{${key}}` : String(vars[key]),
  );
}

export function t(key: MessageKey, vars?: MessageVars, locale: Locale = currentLocale): string {
  const dict = STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
  return interpolate(dict[key] ?? STRINGS[DEFAULT_LOCALE][key], vars);
}

export function tcount(
  count: number,
  one: MessageKey,
  other: MessageKey,
  locale?: Locale,
): string {
  return t(count === 1 ? one : other, { count }, locale);
}

const MEAL_KEYS: Record<MealSlot, MessageKey> = {
  breakfast: 'meal.breakfast',
  lunch: 'meal.lunch',
  dinner: 'meal.dinner',
  snack: 'meal.snack',
};

export function mealSlotLabel(slot: MealSlot, locale?: Locale): string {
  return t(MEAL_KEYS[slot], undefined, locale);
}

export function flagLabel(
  flag:
    | 'dairy_free'
    | 'no_bread'
    | 'no_tofu'
    | 'eggs_ok'
    | 'fish_ok'
    | 'no_other_meat'
    | 'finnish_groceries',
  locale?: Locale,
): string {
  return t(`flag.${flag}`, undefined, locale);
}
