import { describe, expect, it } from 'vitest';
import { SEED_FOODS_JSON, type SeedStapleJson } from '../data/seedFoods';
import { SEED_FOODS } from './foods';

describe('Kost seed JSON', () => {
  it('maps macros from the JSON artifact without inventing values', () => {
    const rows = SEED_FOODS_JSON.staples as SeedStapleJson[];
    expect(rows).toHaveLength(27);
    expect(rows).toHaveLength(SEED_FOODS.length);
    expect(SEED_FOODS_JSON.need_from_linda).toContain('MFP');
    for (const row of rows) {
      const food = SEED_FOODS.find((item) => item.name_en === row.name_en);
      expect(food, row.name_en).toBeDefined();
      expect(food?.kcal).toBe(row.kcal);
      expect(food?.protein).toBe(row.p);
      expect(food?.carbs).toBe(row.c);
      expect(food?.fat).toBe(row.f);
      expect(food?.basis).toBe(row.basis);
      expect(food?.name_fi).toBe(row.name_fi);
    }
  });

  it('marks Nyhtökaura and soy granules as secondary', () => {
    expect(SEED_FOODS.find((f) => f.id === 'nyhtokaura')?.tags).toContain('secondary');
    expect(SEED_FOODS.find((f) => f.id === 'soijarouhe')?.tags).toContain('secondary');
  });
});
