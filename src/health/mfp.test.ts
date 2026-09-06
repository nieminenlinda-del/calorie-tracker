import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { resetDbConnection } from '../db/database';
import { logsRepo } from '../repos/logsRepo';
import { logCustomFood } from '../domain/logging';
import {
  foodLogsFromMfpRows,
  ingestMfpNutritionCsv,
  isMfpLog,
  mapMfpMeal,
  parseCsvRecords,
} from './mfp';

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'fixtures/mfp/nutrition.csv'),
  'utf8',
);

async function deleteRavinto(): Promise<void> {
  await resetDbConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('ravinto');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('delete ravinto failed'));
    req.onblocked = () => resolve();
  });
}

afterEach(async () => {
  await deleteRavinto();
});

describe('MyFitnessPal nutrition.csv', () => {
  it('maps meals case-insensitively, including Snacks → snack', () => {
    expect(mapMfpMeal('Breakfast')).toBe('breakfast');
    expect(mapMfpMeal('LUNCH')).toBe('lunch');
    expect(mapMfpMeal('Dinner')).toBe('dinner');
    expect(mapMfpMeal('Snacks')).toBe('snack');
    expect(mapMfpMeal('Walk')).toBeNull();
  });

  it('builds one custom snapshot per date+slot from the fixture', () => {
    const logs = foodLogsFromMfpRows(parseCsvRecords(fixture));
    expect(logs).toHaveLength(4);
    const breakfast = logs.find((log) => log.id === 'mfp:2026-08-27:breakfast');
    expect(breakfast).toMatchObject({
      date: '2026-08-27',
      meal_slot: 'breakfast',
      kcal: 421,
      protein: 38.1,
      carbs: 47.5,
      fat: 8.4,
    });
    expect(breakfast?.custom_name).toContain('Breakfast');
    expect(logs.find((log) => log.meal_slot === 'snack')?.custom_name).toContain('banaani');
  });

  it('replaces MFP rows on re-import and leaves manual logs alone', async () => {
    await logCustomFood({
      date: '2026-08-27',
      meal_slot: 'breakfast',
      name: 'Omat kaurahiutaleet',
      amount: 50,
      unit: 'g',
      kcal: 185,
      protein: 6.5,
      carbs: 30,
      fat: 3.5,
    });

    const first = await ingestMfpNutritionCsv(fixture);
    expect(first.meals).toBe(4);
    expect(first.days).toBe(2);
    expect(first.replaced).toBe(0);

    const day = await logsRepo.getByDate('2026-08-27');
    expect(day.filter((log) => log.custom_name === 'Omat kaurahiutaleet')).toHaveLength(1);
    expect(day.filter(isMfpLog)).toHaveLength(3);

    const second = await ingestMfpNutritionCsv(fixture);
    expect(second.replaced).toBe(4);
    expect(second.meals).toBe(4);
    const again = await logsRepo.getByDate('2026-08-27');
    expect(again.filter((log) => log.custom_name === 'Omat kaurahiutaleet')).toHaveLength(1);
    expect(again.filter(isMfpLog)).toHaveLength(3);
  });
});
