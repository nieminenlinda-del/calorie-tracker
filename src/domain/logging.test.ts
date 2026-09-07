import { afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { resetDbConnection } from '../db/database';
import { foodsRepo } from '../repos/foodsRepo';
import { logsRepo } from '../repos/logsRepo';
import { macrosPer100g } from './macros';
import { isQuickFood, logCustomFood, logQuickAddFood, QUICK_FOOD_TAG } from './logging';
import { SEED_FOODS } from '../seed/foods';

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

describe('logQuickAddFood', () => {
  it('writes a catalog food and a log with food_id so it can be reused', async () => {
    const { food, log } = await logQuickAddFood({
      date: '2026-09-07',
      meal_slot: 'snack',
      name: '  Huel shake  ',
      amount: 90,
      kcal: 400,
      protein: 40,
      carbs: 24,
      fat: 17,
    });

    expect(food.id).toMatch(/^quick-/);
    expect(food.name_fi).toBe('Huel shake');
    expect(food.name_en).toBe('Huel shake');
    expect(food.tags).toContain(QUICK_FOOD_TAG);
    expect(isQuickFood(food)).toBe(true);
    expect(food.basis).toBe('per_100g');
    expect(food.default_serving).toBe(90);
    expect(food.kcal).toBe(macrosPer100g(90, { kcal: 400, protein: 40, carbs: 24, fat: 17 }).kcal);

    expect(log.food_id).toBe(food.id);
    expect(log.custom_name).toBeUndefined();
    expect(log.kcal).toBe(400);
    expect(log.protein).toBe(40);
    expect(log.amount).toBe(90);

    const stored = await foodsRepo.getById(food.id);
    expect(stored?.name_fi).toBe('Huel shake');
    const day = await logsRepo.getByDate('2026-09-07');
    expect(day).toHaveLength(1);
    expect(day[0].food_id).toBe(food.id);
  });

  it('reuses the same My foods entry when the name matches', async () => {
    const first = await logQuickAddFood({
      date: '2026-09-07',
      meal_slot: 'lunch',
      name: 'Avocado',
      amount: 45,
      kcal: 72,
      protein: 1,
      carbs: 4,
      fat: 7,
    });
    const second = await logQuickAddFood({
      date: '2026-09-08',
      meal_slot: 'lunch',
      name: 'avocado',
      amount: 90,
      kcal: 160,
      protein: 2,
      carbs: 8,
      fat: 15,
    });

    expect(second.food.id).toBe(first.food.id);
    expect(second.food.default_serving).toBe(90);
    const all = await foodsRepo.getAll();
    expect(all.filter((food) => isQuickFood(food))).toHaveLength(1);
  });

  it('does not overwrite seeded staples with the same name', async () => {
    await foodsRepo.putMany(SEED_FOODS);
    const banana = SEED_FOODS.find((food) => food.id === 'banaani')!;
    await foodsRepo.put(banana);

    const { food, log } = await logQuickAddFood({
      date: '2026-09-07',
      meal_slot: 'snack',
      name: banana.name_fi,
      amount: 150,
      kcal: 134,
      protein: 1.7,
      carbs: 34,
      fat: 0.5,
    });

    expect(food.id).not.toBe('banaani');
    expect(isQuickFood(food)).toBe(true);
    expect((await foodsRepo.getById('banaani'))?.kcal).toBe(banana.kcal);
    expect(log.food_id).toBe(food.id);
  });

  it('leaves one-shot custom logs (MFP-style) out of the foods library', async () => {
    await logCustomFood({
      date: '2026-09-07',
      meal_slot: 'breakfast',
      name: 'Omat kaurahiutaleet',
      amount: 50,
      unit: 'g',
      kcal: 185,
      protein: 6.5,
      carbs: 30,
      fat: 3.5,
    });
    expect(await foodsRepo.getAll()).toEqual([]);
    const day = await logsRepo.getByDate('2026-09-07');
    expect(day[0].food_id).toBeUndefined();
    expect(day[0].custom_name).toBe('Omat kaurahiutaleet');
  });
});
