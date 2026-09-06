/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { formatHelsinkiDate } from '../domain/dates';
import { formatAdjustmentHint } from '../domain/energyTarget';
import { unitLabel } from '../domain/macros';
import { trainingDayLabel } from '../health/trainingDay';
import { logLabel } from '../lib/labels';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getLocale,
  initLocale,
  mealSlotLabel,
  readStoredLocale,
  setLocale,
  t,
} from './locale';

afterEach(() => {
  localStorage.removeItem(LOCALE_STORAGE_KEY);
  initLocale(DEFAULT_LOCALE);
});

describe('locale', () => {
  it('defaults to Swedish', () => {
    expect(DEFAULT_LOCALE).toBe('sv');
    expect(getLocale()).toBe('sv');
    expect(t('nav.today')).toBe('Idag');
    expect(mealSlotLabel('breakfast')).toBe('Frukost');
    expect(unitLabel('piece')).toBe('st');
    expect(trainingDayLabel('2026-09-01')).toBe('träning B');
    expect(trainingDayLabel('2026-09-02')).toBe('vila');
  });

  it('switches to English and persists the choice', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(t('nav.today')).toBe('Today');
    expect(mealSlotLabel('dinner')).toBe('Dinner');
    expect(unitLabel('piece')).toBe('pcs');
    expect(trainingDayLabel('2026-09-01')).toBe('training B');
    expect(t('flag.dairy_free')).toBe('Dairy-free');
    expect(document.documentElement.lang).toBe('en');
  });

  it('reads a stored locale on init', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    expect(readStoredLocale()).toBe('en');
    expect(initLocale()).toBe('en');
    expect(t('settings.language')).toBe('Language');
  });

  it('falls back to Swedish for unknown stored values', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fi');
    expect(readStoredLocale()).toBe('sv');
  });

  it('localizes the energy adjustment hint', () => {
    initLocale('sv');
    expect(
      formatAdjustmentHint({
        baselineKcal: 2050,
        date: '2026-09-01',
        activeKcal: 400,
        trainingLabel: trainingDayLabel('2026-09-01'),
        adjusted: true,
      }),
    ).toBe('träning B · aktiv 400 kcal · mål nu 2300 kcal');

    setLocale('en');
    expect(
      formatAdjustmentHint({
        baselineKcal: 2050,
        date: '2026-09-02',
        activeKcal: undefined,
        trainingLabel: trainingDayLabel('2026-09-02'),
        adjusted: false,
      }),
    ).toBe('rest · active not imported · target 2050 kcal');
  });

  it('formats the calendar date in the active language', () => {
    initLocale('sv');
    expect(formatHelsinkiDate('2026-09-01').toLowerCase()).toContain('tis');
    setLocale('en');
    expect(formatHelsinkiDate('2026-09-01')).toMatch(/Tue/i);
  });

  it('uses a localized unknown-food fallback', () => {
    expect(logLabel({ food_id: 'missing' } as never, [])).toBe('Okänd');
    setLocale('en');
    expect(logLabel({ food_id: 'missing' } as never, [])).toBe('Unknown');
  });
});
