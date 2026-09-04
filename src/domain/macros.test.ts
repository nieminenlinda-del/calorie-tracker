import { describe, expect, it } from 'vitest';
import { scaleFoodMacros, remainingMacros, sumMacros, addMacros } from '../domain/macros';
import { computeDailySummary } from '../domain/summary';
import { filterCatalog, searchFoods } from '../domain/diet';
import { addDays } from '../domain/dates';
import { SEED_FOODS } from '../seed/foods';
import { SEED_TEMPLATES } from '../seed/templates';
import { DEFAULT_DIET_FLAGS, DEFAULT_TARGETS, type Food, type UserTargets } from '../domain/types';

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

  it('does not seed dairy, bread, tofu, or land meat', () => {
    const banned = /maito|leipä|tofu|kana\b|nauta|sika|jauheliha|\bdairy\b|\bbread\b|chicken|beef/i;
    for (const food of SEED_FOODS) {
      const label = `${food.name_fi} ${food.name_en ?? ''}`;
      expect(banned.test(label), label).toBe(false);
      expect(food.excluded_by_flags).toEqual([]);
    }
  });

  it('logs a full training day near target macros', () => {
    const byId = new Map(SEED_FOODS.map((f) => [f.id, f]));
    const logs = SEED_TEMPLATES.flatMap((template) =>
      template.items.map((item) => {
        const food = byId.get(item.food_id)!;
        return { ...scaleFoodMacros(food, item.amount) };
      }),
    );
    const summary = computeDailySummary('2026-09-03', logs as never, targets);
    expect(summary.kcal).toBeGreaterThan(1900);
    expect(summary.kcal).toBeLessThan(2300);
    expect(summary.protein).toBeGreaterThan(120);
    expect(summary.fat).toBeGreaterThan(50);
    expect(summary.fat).toBeLessThan(70);
  });
});

describe('diet catalog', () => {
  it('hides eggs without eggs_ok', () => {
    const allowed = filterCatalog(SEED_FOODS, ['dairy_free', 'fish_ok']);
    expect(allowed.some((f) => f.id === 'muna')).toBe(false);
    expect(allowed.some((f) => f.id === 'kirjolohi')).toBe(true);
  });

  it('finds Finnish names and brands', () => {
    const hits = searchFoods(SEED_FOODS, 'härkis');
    expect(hits.map((f) => f.id)).toContain('harkis-original');
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
  it('uses piece basis only for eggs', () => {
    const pieceFoods = SEED_FOODS.filter((f: Food) => f.basis === 'per_piece');
    expect(pieceFoods.map((f) => f.id)).toEqual(['muna']);
  });

  it('includes the locked staple list', () => {
    expect(SEED_FOODS).toHaveLength(24);
  });
});
