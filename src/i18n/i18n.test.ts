/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { formatHelsinkiDate } from '../domain/dates';
import { formatAdjustmentHint } from '../domain/energyTarget';
import { unitLabel } from '../domain/macros';
import { trainingDayLabel } from '../health/trainingDay';
import { logLabel } from '../lib/labels';
import { SAMPLE_DAY_SLOT_LABELS } from '../seed/templates';
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
import { MEAL_SLOTS } from '../domain/types';

afterEach(() => {
  localStorage.removeItem(LOCALE_STORAGE_KEY);
  initLocale(DEFAULT_LOCALE);
});

describe('locale', () => {
  it('defaults to English', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(getLocale()).toBe('en');
    expect(t('nav.today')).toBe('Today');
    expect(mealSlotLabel('breakfast')).toBe('Breakfast');
    expect(MEAL_SLOTS.map((slot) => mealSlotLabel(slot))).toEqual([
      'Breakfast',
      'Lunch',
      'Snack 1',
      'Dinner',
      'Snack 2',
    ]);
    expect(SAMPLE_DAY_SLOT_LABELS).toEqual(['Breakfast', 'Lunch', 'Snack 1', 'Dinner', 'Snack 2']);
    expect(unitLabel('piece')).toBe('pcs');
    expect(trainingDayLabel('2026-09-01')).toBe('training B');
    expect(trainingDayLabel('2026-09-02')).toBe('rest');
  });

  it('can switch to Swedish and persists the choice', () => {
    setLocale('sv');
    expect(getLocale()).toBe('sv');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('sv');
    expect(t('nav.today')).toBe('Idag');
    expect(mealSlotLabel('dinner')).toBe('Middag');
    expect(mealSlotLabel('snack')).toBe('Mellanmål 1');
    expect(mealSlotLabel('evening_snack')).toBe('Mellanmål 2');
    expect(unitLabel('piece')).toBe('st');
    expect(trainingDayLabel('2026-09-01')).toBe('träning B');
    expect(t('flag.dairy_free')).toBe('Mjölkfri');
    expect(t('flag.no_soft_bread')).toBe('Inget mjukt bröd');
    expect(document.documentElement.lang).toBe('sv');
  });

  it('reads a stored locale on init', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'sv');
    expect(readStoredLocale()).toBe('sv');
    expect(initLocale()).toBe('sv');
    expect(t('settings.language')).toBe('Språk');
  });

  it('falls back to English for unknown stored values', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fi');
    expect(readStoredLocale()).toBe('en');
  });

  it('localizes the energy adjustment hint', () => {
    initLocale('en');
    expect(
      formatAdjustmentHint({
        baselineKcal: 2050,
        date: '2026-09-02',
        activeKcal: undefined,
        trainingLabel: trainingDayLabel('2026-09-02'),
        adjusted: false,
      }),
    ).toBe('rest · active not imported · target 2050 kcal');

    setLocale('sv');
    expect(
      formatAdjustmentHint({
        baselineKcal: 2050,
        date: '2026-09-01',
        activeKcal: 400,
        trainingLabel: trainingDayLabel('2026-09-01'),
        adjusted: true,
      }),
    ).toBe('träning B · aktiv 400 kcal · mål nu 2300 kcal');
  });

  it('formats the calendar date in the active language', () => {
    initLocale('en');
    expect(formatHelsinkiDate('2026-09-01')).toMatch(/Tue/i);
    setLocale('sv');
    expect(formatHelsinkiDate('2026-09-01').toLowerCase()).toContain('tis');
  });

  it('keeps scan permission copy distinct from a generic camera failure', () => {
    initLocale('en');
    expect(t('scan.permission')).toMatch(/permission/i);
    expect(t('scan.permission')).toMatch(/Quick Add/i);
    expect(t('scan.cameraError')).toMatch(/Could not start the camera/i);
    expect(t('scan.cameraError')).toMatch(/Quick Add/i);
    expect(t('scan.enterCode')).toMatch(/barcode/i);
    expect(t('scan.permission')).not.toBe(t('scan.cameraError'));
    setLocale('sv');
    expect(t('scan.permission')).toMatch(/tillstånd/i);
    expect(t('scan.cameraError')).toMatch(/gick inte att starta/i);
    expect(t('scan.quickAddInstead')).toMatch(/Snabb/i);
  });

  it('uses a localized unknown-food fallback', () => {
    expect(logLabel({ food_id: 'missing' } as never, [])).toBe('Unknown');
    setLocale('sv');
    expect(logLabel({ food_id: 'missing' } as never, [])).toBe('Okänd');
  });
});
