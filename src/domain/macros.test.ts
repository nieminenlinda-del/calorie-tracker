import { describe, expect, it } from 'vitest';
import { scaleFoodMacros, remainingMacros, sumMacros, addMacros, macrosPer100g } from '../domain/macros';
import { computeDailySummary } from '../domain/summary';
import { filterCatalog, searchFoods } from '../domain/diet';
import { addDays } from '../domain/dates';
import { SEED_FOODS } from '../seed/foods';
import { SEED_TEMPLATES, TRAINING_DAY_TEMPLATES, SAMPLE_DAY_TARGETS } from '../seed/templates';
import { DEFAULT_DIET_FLAGS, DEFAULT_TARGETS, MEAL_SLOTS, type Food, type UserTargets } from '../domain/types';

const oats = SEED_FOODS.find((f) => f.id === 'kaurahiutaleet')!;
const egg = SEED_FOODS.find((f) => f.id === 'muna')!;
const oil = SEED_FOODS.find((f) => f.id === 'oliiviöljy')!;

const targets: UserTargets = {
  id: 'default',
  ...DEFAULT_TARGETS,
  diet_flags: [...DEFAULT_DIET_FLAGS],
  timezone: 'Europe/Helsinki',
  updated_at: '2026-09-03T00:00:00.000Z',
  adjust_for_training_day: false,
};

describe('meal slots', () => {
  it('puts a mid-afternoon snack between lunch and dinner', () => {
    expect(MEAL_SLOTS).toEqual(['breakfast', 'lunch', 'snack', 'dinner', 'evening_snack']);
    expect(MEAL_SLOTS.indexOf('snack')).toBeGreaterThan(MEAL_SLOTS.indexOf('lunch'));
    expect(MEAL_SLOTS.indexOf('snack')).toBeLessThan(MEAL_SLOTS.indexOf('dinner'));
  });

  it('keeps Kost daily targets', () => {
    expect(DEFAULT_TARGETS).toEqual({ kcal: 2050, protein: 125, carbs: 265, fat: 60 });
    expect(SAMPLE_DAY_TARGETS).toEqual(DEFAULT_TARGETS);
  });
});

describe('macrosPer100g', () => {
  it('scales a portion back to per-100 g', () => {
    expect(macrosPer100g(50, { kcal: 185, protein: 6.5, carbs: 30, fat: 3.5 })).toEqual({
      kcal: 370,
      protein: 13,
      carbs: 60,
      fat: 7,
    });
  });
});

describe('scaleFoodMacros', () => {
  it('scales per-100g foods by grams', () => {
    expect(scaleFoodMacros(oats, 50)).toEqual({
      kcal: 185,
      protein: 6.5,
      carbs: 30,
      fat: 3.5,
    });
  });

  it('scales eggs per piece, not per 100g', () => {
    expect(scaleFoodMacros(egg, 2)).toEqual({
      kcal: 140,
      protein: 12,
      carbs: 1,
      fat: 10,
    });
  });

  it('handles small oil portions', () => {
    expect(scaleFoodMacros(oil, 5)).toEqual({
      kcal: 45,
      protein: 0,
      carbs: 0,
      fat: 5,
    });
  });
});

describe('remaining macros', () => {
  it('subtracts consumed from locked defaults', () => {
    const remaining = remainingMacros(
      { kcal: 500, protein: 40, carbs: 60, fat: 15 },
      targets,
    );
    expect(remaining).toEqual({
      kcal: 1550,
      protein: 85,
      carbs: 205,
      fat: 45,
    });
  });
});

describe('training-day templates', () => {
  it('reference only seeded catalog ids', () => {
    const ids = new Set(SEED_FOODS.map((f) => f.id));
    for (const template of SEED_TEMPLATES) {
      for (const item of template.items) {
        expect(ids.has(item.food_id), item.food_id).toBe(true);
      }
    }
  });

  it('does not seed dairy, soft bread, tofu, or land meat', () => {
    const banned = /maito|näkkileipä|tofu|kana\b|nauta|sika|jauheliha|\bdairy\b|chicken|beef|\bsoft bread\b/i;
    for (const food of SEED_FOODS) {
      const label = `${food.name_fi} ${food.name_en ?? ''} ${food.brand ?? ''}`;
      if (food.tags.includes('hapankorppu_exception_small')) {
        expect(food.default_serving).toBeGreaterThanOrEqual(10);
        expect(food.default_serving).toBeLessThanOrEqual(15);
        continue;
      }
      expect(banned.test(label), label).toBe(false);
      expect(/\bleipä\b/i.test(label), label).toBe(false);
      expect(food.excluded_by_flags).toEqual([]);
    }
  });

  it('logs a full training day near target macros', () => {
    const byId = new Map(SEED_FOODS.map((f) => [f.id, f]));
    const logs = TRAINING_DAY_TEMPLATES.flatMap((template) =>
      template.items.map((item) => {
        const food = byId.get(item.food_id)!;
        return { ...scaleFoodMacros(food, item.amount) };
      }),
    );
    const summary = computeDailySummary('2026-09-07', logs as never, targets);
    expect(summary.kcal).toBeGreaterThan(2000);
    expect(summary.kcal).toBeLessThan(2300);
    expect(summary.protein).toBeGreaterThan(150);
    expect(summary.fat).toBeGreaterThan(55);
    expect(summary.fat).toBeLessThan(75);
  });

  it('uses Linda’s MFP today log as the training-day default', () => {
    expect(TRAINING_DAY_TEMPLATES.map((template) => template.meal_slot)).toEqual([
      'breakfast',
      'lunch',
      'snack',
      'dinner',
      'evening_snack',
    ]);
    expect(TRAINING_DAY_TEMPLATES.find((template) => template.meal_slot === 'snack')?.items).toEqual([
      { food_id: 'banaani', amount: 150, unit: 'g' },
      { food_id: 'soija-isolaatti-suklaa', amount: 40, unit: 'g' },
      { food_id: 'huel-black-chocolate', amount: 90, unit: 'g' },
    ]);
    expect(TRAINING_DAY_TEMPLATES.find((template) => template.meal_slot === 'evening_snack')?.items.map((item) => item.food_id)).toEqual([
      'fazer-aito-raspberry',
      'pirkka-puolukka',
      'sallinen-walnuts',
    ]);
    expect(SEED_TEMPLATES.filter((template) => template.meal_slot === 'snack').map((template) => template.id)).toEqual([
      'seed-snack-linda-mfp',
      'seed-valipala-banaani-harkis',
      'seed-valipala-proteiini-omena',
    ]);
  });
});

describe('diet catalog', () => {
  it('keeps hapankorppu visible under no_soft_bread and hides soft bread', () => {
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
    const allowed = filterCatalog([...SEED_FOODS, roll], [...DEFAULT_DIET_FLAGS]);
    expect(allowed.some((f) => f.id === 'oululainen-hapankorppu')).toBe(true);
    expect(allowed.some((f) => f.id === 'soft-roll')).toBe(false);
  });

  it('finds Finnish names, English UI names, and aliases', () => {
    expect(searchFoods(SEED_FOODS, 'härkis').map((f) => f.id)).toContain('harkis-original');
    expect(searchFoods(SEED_FOODS, 'oats').map((f) => f.id)).toContain('kaurahiutaleet');
    expect(searchFoods(SEED_FOODS, 'star nutrition').map((f) => f.id)).toContain('soija-isolaatti-suklaa');
    expect(searchFoods(SEED_FOODS, 'hapankorppu').map((f) => f.id)).toContain('oululainen-hapankorppu');
    expect(searchFoods(SEED_FOODS, 'pulled oats').map((f) => f.id)).toContain('nyhtokaura');
  });
});

describe('Helsinki dates', () => {
  it('adds calendar days without UTC shift', () => {
    expect(addDays('2026-09-03', -1)).toBe('2026-09-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('macro helpers', () => {
  it('sums logs', () => {
    const total = sumMacros([
      { kcal: 100, protein: 10, carbs: 5, fat: 2 },
      { kcal: 50, protein: 2.25, carbs: 1.25, fat: 0.4 },
    ]);
    expect(total.kcal).toBe(150);
    expect(total.protein).toBe(12.3);
  });

  it('adds without mutating', () => {
    const a = { kcal: 1, protein: 1, carbs: 1, fat: 1 };
    const b = addMacros(a, a);
    expect(b.kcal).toBe(2);
    expect(a.kcal).toBe(1);
  });
});

describe('seed catalog shape', () => {
  it('uses piece basis only for eggs and espresso', () => {
    const pieceFoods = SEED_FOODS.filter((f: Food) => f.basis === 'per_piece');
    expect(pieceFoods.map((f) => f.id).sort()).toEqual(['espresso', 'muna']);
  });

  it('gives every staple an English phone label', () => {
    for (const food of SEED_FOODS) {
      expect(food.name_en?.trim().length, food.id).toBeGreaterThan(0);
    }
  });

  it('prefers Linda MFP brands over Kost generics and keeps remaining staples', () => {
    const ids = SEED_FOODS.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining([
      'kaurahiutaleet',
      'soija-isolaatti-suklaa',
      'herneproteiini',
      'elovena-kaurajuoma',
      'elovena-kaurajuoma-kahvi',
      'espresso',
      'pirkka-puolukka',
      'mustikat-pakaste',
      'pakastekasvikset',
      'sweet-potato',
      'avocado',
      'huel-black-chocolate',
      'huel-daily-greens',
      'oululainen-hapankorppu',
      'fazer-aito-raspberry',
      'sallinen-walnuts',
      'banaani',
      'alpro-go-on-plain',
      'muna',
      'harkis-original',
      'kirjolohi',
      'nyhtokaura',
    ]));
    expect(SEED_FOODS.find((f) => f.id === 'kaurahiutaleet')?.name_en).toBe('Elovena wholegrain oats');
    expect(SEED_FOODS.find((f) => f.id === 'soija-isolaatti-suklaa')?.name_en).toContain('Star Nutrition');
    expect(SEED_FOODS.find((f) => f.id === 'fazer-aito-raspberry')?.brand).toBe('Fazer Aito');
    expect(SEED_FOODS.find((f) => f.id === 'huel-black-chocolate')?.brand).toBe('Huel');
    expect(SEED_FOODS.find((f) => f.id === 'tumma-suklaa')?.tags).toContain('secondary');
    expect(SEED_FOODS.find((f) => f.id === 'alpro-go-on-plain')?.tags).toContain('secondary');
    expect(SEED_FOODS.find((f) => f.id === 'mustikat-pakaste')?.brand).toBe('Pirkka');
    expect(SEED_FOODS.find((f) => f.id === 'pakastekasvikset')?.brand).toBe('Apetit Kesäpöytä');
    expect(ids).not.toContain('star-nutrition-soy-isolate');
  });
});
