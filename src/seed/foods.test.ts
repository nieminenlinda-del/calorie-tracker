import { describe, expect, it } from 'vitest';
import { SEED_FOODS_JSON, type SeedStapleJson } from '../data/seedFoods';
import { SEED_FOODS } from './foods';

describe('Kost seed JSON', () => {
  it('maps every staple from the final Kost JSON', () => {
    const rows = SEED_FOODS_JSON.staples as SeedStapleJson[];
    expect(rows).toHaveLength(SEED_FOODS.length);
    expect(SEED_FOODS_JSON.hapankorppu_status).toBe('approved_small_exception_10_15g');
    for (const row of rows) {
      const food = SEED_FOODS.find((item) => item.id === row.id);
      expect(food, row.name_en).toBeDefined();
      expect(food?.name_en).toBe(row.name_en);
      expect(food?.kcal).toBe(row.kcal);
      expect(food?.protein).toBe(row.p);
      expect(food?.carbs).toBe(row.c);
      expect(food?.fat).toBe(row.f);
      if (row.priority >= 2) {
        expect(food?.tags).toContain('secondary');
      } else {
        expect(food?.tags).not.toContain('secondary');
      }
    }
  });

  it('puts Kost’s branded list first and keeps prior staples secondary', () => {
    const priority = SEED_FOODS.filter((food) => !food.tags.includes('secondary'));
    expect(priority.map((food) => food.id)).toEqual([
      'soija-isolaatti-suklaa',
      'kaurahiutaleet',
      'elovena-kaurajuoma',
      'elovena-kaurajuoma-kahvi',
      'espresso',
      'pirkka-puolukka',
      'mustikat-pakaste',
      'pakastekasvikset',
      'sweet-potato',
      'avocado',
      'herneproteiini',
      'banaani',
      'huel-black-chocolate',
      'huel-daily-greens',
      'fazer-aito-raspberry',
      'sallinen-walnuts',
      'oululainen-hapankorppu',
    ]);
    expect(SEED_FOODS.find((f) => f.id === 'harkis-original')?.tags).toContain('secondary');
    expect(SEED_FOODS.find((f) => f.id === 'nyhtokaura')?.tags).toContain('secondary');
    expect(SEED_FOODS.find((f) => f.id === 'soijarouhe')?.tags).toContain('secondary');
    expect(SEED_FOODS.find((f) => f.id === 'oululainen-hapankorppu')?.tags).toEqual(
      expect.arrayContaining(['hapankorppu_exception_small', 'no_soft_bread']),
    );
  });
});
