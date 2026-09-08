import { afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { resetDbConnection } from '../db/database';
import type { Food, FoodLog, MealTemplate, UserTargets } from '../domain/types';
import { QUICK_FOOD_TAG } from '../domain/logging';
import { foodsRepo } from '../repos/foodsRepo';
import { logsRepo } from '../repos/logsRepo';
import { targetsRepo } from '../repos/targetsRepo';
import { templatesRepo } from '../repos/templatesRepo';
import {
  BACKUP_SCHEMA,
  BACKUP_SCHEMA_VERSION,
  exportMealBackup,
  importMealBackup,
  importMealBackupText,
  mealBackupFilename,
  parseMealBackupJson,
} from './mealBackup';

const logA: FoodLog = {
  id: 'log-a',
  date: '2026-09-08',
  meal_slot: 'lunch',
  custom_name: 'Härkis bowl',
  amount: 150,
  unit: 'g',
  kcal: 220,
  protein: 22,
  carbs: 12,
  fat: 8,
  created_at: '2026-09-08T11:00:00.000Z',
};

const logB: FoodLog = {
  id: 'log-b',
  date: '2026-09-07',
  meal_slot: 'dinner',
  custom_name: 'Kirjolohi',
  amount: 120,
  unit: 'g',
  kcal: 250,
  protein: 26,
  carbs: 0,
  fat: 16,
  created_at: '2026-09-07T16:00:00.000Z',
};

const quickFood: Food = {
  id: 'quick-huel',
  name_fi: 'Huel',
  name_en: 'Huel',
  serving_unit: 'g',
  default_serving: 90,
  kcal: 400,
  protein: 40,
  carbs: 24,
  fat: 17,
  basis: 'per_100g',
  tags: [QUICK_FOOD_TAG],
  excluded_by_flags: [],
};

const offFood: Food = {
  id: 'off-3017620422003',
  name_fi: 'Nutella',
  name_en: 'Nutella',
  barcode: '3017620422003',
  serving_unit: 'g',
  default_serving: 15,
  kcal: 539,
  protein: 6.3,
  carbs: 57.5,
  fat: 30.9,
  basis: 'per_100g',
  tags: [QUICK_FOOD_TAG, 'off'],
  excluded_by_flags: [],
};

const template: MealTemplate = {
  id: 'tmpl-user',
  name: 'My lunch',
  meal_slot: 'lunch',
  items: [{ food_id: 'quick-huel', amount: 90, unit: 'g' }],
};

const targets: UserTargets = {
  id: 'default',
  kcal: 2100,
  protein: 130,
  carbs: 250,
  fat: 70,
  diet_flags: ['dairy_free', 'eggs_ok'],
  timezone: 'Europe/Helsinki',
  updated_at: '2026-09-08T00:00:00.000Z',
  adjust_for_training_day: true,
};

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

describe('meal backup', () => {
  it('exports food_logs, foods, targets, templates, and meta', async () => {
    await logsRepo.put(logA);
    await foodsRepo.putMany([quickFood, offFood]);
    await templatesRepo.put(template);
    await targetsRepo.save(targets);

    const backup = await exportMealBackup();
    expect(backup.schema).toBe(BACKUP_SCHEMA);
    expect(backup.schema_version).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.food_logs).toEqual([logA]);
    expect(backup.foods.map((food) => food.id).sort()).toEqual(['off-3017620422003', 'quick-huel']);
    expect(backup.meal_templates).toEqual([template]);
    expect(backup.user_targets[0]).toMatchObject({ kcal: 2100, adjust_for_training_day: true });
    expect(Array.isArray(backup.meta)).toBe(true);
  });

  it('merge upserts by id and never wipes stores omitted from the file', async () => {
    await logsRepo.putMany([logA, logB]);
    await foodsRepo.put(quickFood);
    await templatesRepo.put(template);

    const updatedA: FoodLog = { ...logA, kcal: 999 };
    await importMealBackup(
      {
        schema: BACKUP_SCHEMA,
        schema_version: BACKUP_SCHEMA_VERSION,
        food_logs: [updatedA],
        foods: [offFood],
      },
      'merge',
    );

    const logs = await logsRepo.getAll();
    expect(logs).toHaveLength(2);
    expect(logs.find((row) => row.id === 'log-a')).toMatchObject({ kcal: 999 });
    expect(logs.find((row) => row.id === 'log-b')).toEqual(logB);
    expect(await foodsRepo.getById('quick-huel')).toMatchObject({ name_en: 'Huel' });
    expect(await foodsRepo.getById('off-3017620422003')).toMatchObject({ barcode: '3017620422003' });
    expect(await templatesRepo.getById('tmpl-user')).toEqual(template);
  });

  it('replace clears only stores present in the file', async () => {
    await logsRepo.putMany([logA, logB]);
    await foodsRepo.put(quickFood);
    await templatesRepo.put(template);

    await importMealBackup(
      {
        schema: BACKUP_SCHEMA,
        schema_version: BACKUP_SCHEMA_VERSION,
        food_logs: [logB],
      },
      'replace',
    );

    expect(await logsRepo.getAll()).toEqual([logB]);
    expect(await foodsRepo.getById('quick-huel')).toBeDefined();
    expect(await templatesRepo.getById('tmpl-user')).toEqual(template);
  });

  it('replace of foods + logs restores a day including Quick/OFF foods', async () => {
    await logsRepo.put(logA);
    await foodsRepo.put(quickFood);

    await importMealBackup(
      {
        schema: BACKUP_SCHEMA,
        schema_version: BACKUP_SCHEMA_VERSION,
        food_logs: [logB],
        foods: [offFood],
      },
      'replace',
    );

    expect(await logsRepo.getAll()).toEqual([logB]);
    expect(await foodsRepo.getById('quick-huel')).toBeUndefined();
    expect(await foodsRepo.getById('off-3017620422003')).toMatchObject({ name_en: 'Nutella' });
  });

  it('round-trips export JSON through parse + merge', async () => {
    await logsRepo.put(logA);
    await foodsRepo.put(offFood);
    const json = JSON.stringify(await exportMealBackup());
    await logsRepo.clear();
    await foodsRepo.clear();

    const result = await importMealBackupText(json, 'merge');
    expect(result.food_logs).toBe(1);
    expect(result.foods).toBe(1);
    expect(await logsRepo.getAll()).toEqual([logA]);
    expect(await foodsRepo.getById('off-3017620422003')).toMatchObject({ barcode: '3017620422003' });
  });

  it('rejects files that are not ravinto-backup JSON', () => {
    expect(() => parseMealBackupJson('{')).toThrow(/not valid JSON/i);
    expect(() => parseMealBackupJson(JSON.stringify({ schema: 'linda-health-shortcut' }))).toThrow(
      /ravinto-backup/,
    );
    expect(() =>
      parseMealBackupJson(JSON.stringify({ schema: BACKUP_SCHEMA, schema_version: 99 })),
    ).toThrow(/schema_version/);
    expect(() =>
      parseMealBackupJson(
        JSON.stringify({ schema: BACKUP_SCHEMA, schema_version: 1, food_logs: 'nope' }),
      ),
    ).toThrow(/array/i);
  });

  it('names the download with the Helsinki date', () => {
    expect(mealBackupFilename('2026-09-08')).toBe('ravinto-backup-2026-09-08.json');
  });
});
