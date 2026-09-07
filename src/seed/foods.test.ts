import { describe, expect, it } from 'vitest';
import {
  SEED_FOODS_JSON,
  LINDA_MFP_FOODS_JSON,
  stapleFromJson,
  type SeedStapleJson,
  type LindaMfpFoodJson,
} from '../data/seedFoods';
import { SEED_FOODS } from './foods';

describe('Kost seed JSON', () => {
  it('keeps unreplaced Kost macros and overlays Linda MFP brands', () => {
    const rows = SEED_FOODS_JSON.staples as SeedStapleJson[];
    const linda = LINDA_MFP_FOODS_JSON.foods as LindaMfpFoodJson[];
    expect(rows).toHaveLength(27);
    expect(linda).toHaveLength(17);
    const replacedIds = new Set(linda.map((row) => row.replaces_id).filter(Boolean));
    for (const row of rows) {
      const mapped = stapleFromJson(row, 0);
      if (replacedIds.has(mapped.id)) continue;
      const food = SEED_FOODS.find((item) => item.id === mapped.id);
      expect(food, row.name_en).toBeDefined();
      expect(food?.kcal).toBe(row.kcal);
      expect(food?.protein).toBe(row.p);
      expect(food?.carbs).toBe(row.c);
      expect(food?.fat).toBe(row.f);
      expect(food?.name_en).toBe(row.name_en);
    }
    expect(SEED_FOODS.find((f) => f.id === 'kaurahiutaleet')?.brand).toBe('Elovena');
    expect(SEED_FOODS.find((f) => f.id === 'kaurahiutaleet')?.name_fi).toBe('Täysjyvä Kaurahiutale');
    expect(SEED_FOODS.find((f) => f.id === 'herneproteiini')?.brand).toBe('SAFKAsuikale');
    expect(SEED_FOODS.find((f) => f.id === 'soija-isolaatti-suklaa')?.brand).toBe('Star Nutrition');
  });

  it('marks Nyhtökaura and soy granules as secondary', () => {
    expect(SEED_FOODS.find((f) => f.id === 'nyhtokaura')?.tags).toContain('secondary');
    expect(SEED_FOODS.find((f) => f.id === 'soijarouhe')?.tags).toContain('secondary');
  });
});
