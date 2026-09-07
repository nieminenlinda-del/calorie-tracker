import { afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { getDb, resetDbConnection } from '../db/database';
import { QUICK_FOOD_TAG } from '../domain/logging';
import type { Food } from '../domain/types';
import { foodsRepo } from '../repos/foodsRepo';
import { templatesRepo } from '../repos/templatesRepo';
import { bootstrapDb, SEED_VERSION } from './bootstrap';
import { SEED_FOODS } from './foods';

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

describe('bootstrapDb', () => {
  it('prunes leftover non-Kost catalog foods but keeps Quick Add foods', async () => {
    const leftover: Food = {
      id: 'huel-black-chocolate',
      name_fi: 'Huel Black Edition Chocolate',
      name_en: 'Huel Black Edition chocolate',
      brand: 'Huel',
      serving_unit: 'g',
      default_serving: 90,
      kcal: 444,
      protein: 44.4,
      carbs: 26.7,
      fat: 18.9,
      basis: 'per_100g',
      tags: ['staple'],
      excluded_by_flags: [],
    };
    const quick: Food = {
      id: 'quick-test',
      name_fi: 'My shake',
      name_en: 'My shake',
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
    await foodsRepo.putMany([leftover, quick]);
    await templatesRepo.put({
      id: 'seed-iltapala-fazer-aito',
      name: 'Evening snack',
      meal_slot: 'evening_snack',
      items: [{ food_id: 'fazer-aito-raspberry', amount: 200, unit: 'g' }],
    });

    await bootstrapDb();

    expect(await foodsRepo.getById('huel-black-chocolate')).toBeUndefined();
    expect(await foodsRepo.getById('quick-test')).toMatchObject({ name_en: 'My shake' });
    expect(await foodsRepo.getById('kaurahiutaleet')).toMatchObject({ name_en: 'Oats' });
    expect((await foodsRepo.getAll()).filter((food) => !food.tags.includes(QUICK_FOOD_TAG))).toHaveLength(
      SEED_FOODS.length,
    );
    expect(await templatesRepo.getById('seed-iltapala-fazer-aito')).toBeUndefined();
    expect(await templatesRepo.getById('seed-iltapala-omena-suklaa')).toBeDefined();
    const db = await getDb();
    expect((await db.get('meta', 'seed_version'))?.value).toBe(SEED_VERSION);
  });
});
