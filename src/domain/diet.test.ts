import { describe, expect, it } from 'vitest';
import { filterCatalog, isFoodAllowed, migrateDietFlags } from './diet';
import { DEFAULT_DIET_FLAGS, type Food } from './types';
import { SEED_FOODS } from '../seed/foods';

const roll: Food = {
  id: 'soft-roll',
  name_fi: 'Sämpylä',
  name_en: 'Soft roll',
  serving_unit: 'g',
  default_serving: 50,
  kcal: 260,
  protein: 8,
  carbs: 50,
  fat: 3,
  basis: 'per_100g',
  tags: ['soft_bread'],
  excluded_by_flags: ['no_soft_bread'],
};

describe('diet flags', () => {
  it('migrates legacy no_bread to no_soft_bread', () => {
    expect(migrateDietFlags(['dairy_free', 'no_bread', 'eggs_ok'])).toEqual([
      'dairy_free',
      'no_soft_bread',
      'eggs_ok',
    ]);
    expect(DEFAULT_DIET_FLAGS).toContain('no_soft_bread');
    expect(DEFAULT_DIET_FLAGS).not.toContain('no_bread');
  });

  it('allows small hapankorppu and hides soft bread', () => {
    const hapankorppu = SEED_FOODS.find((food) => food.id === 'oululainen-hapankorppu')!;
    expect(hapankorppu.tags).toEqual(
      expect.arrayContaining(['hapankorppu_exception_small', 'no_soft_bread']),
    );
    expect(hapankorppu.default_serving).toBeGreaterThanOrEqual(10);
    expect(hapankorppu.default_serving).toBeLessThanOrEqual(15);
    expect(isFoodAllowed(hapankorppu, DEFAULT_DIET_FLAGS)).toBe(true);
    expect(isFoodAllowed(roll, DEFAULT_DIET_FLAGS)).toBe(false);
    expect(filterCatalog([...SEED_FOODS, roll], DEFAULT_DIET_FLAGS).some((f) => f.id === 'soft-roll')).toBe(
      false,
    );
  });
});
