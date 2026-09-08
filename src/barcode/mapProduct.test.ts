import { describe, expect, it } from 'vitest';
import { OFF_FOOD_TAG, QUICK_FOOD_TAG } from '../domain/logging';
import finnishTuna from './fixtures/off-finnish-tuna.json';
import kjOnly from './fixtures/off-kj-only.json';
import missingNutrition from './fixtures/off-missing-nutrition.json';
import nutella from './fixtures/off-nutella.json';
import notFound from './fixtures/off-not-found.json';
import { mapOffProductToFood, pickProductName, readNutrimentsPer100g } from './mapProduct';
import type { OffApiResponse } from './types';

describe('pickProductName', () => {
  it('prefers Finnish, then Swedish, then product_name / generic_name', () => {
    expect(
      pickProductName(
        {
          product_name_fi: 'Rainbow tonnikala vedessä',
          product_name_sv: 'Rainbow tonfisk i vatten',
          product_name: 'Rainbow tuna in water',
        },
        '123',
      ).name_en,
    ).toBe('Rainbow tonnikala vedessä');

    expect(
      pickProductName(
        {
          product_name_sv: 'Knäckebröd',
          product_name: 'Crispbread',
        },
        '123',
      ).name_en,
    ).toBe('Knäckebröd');

    expect(
      pickProductName(
        {
          product_name: '',
          generic_name: 'Rolled oats',
        },
        '123',
      ).name_en,
    ).toBe('Rolled oats');
  });
});

describe('mapOffProductToFood', () => {
  it('maps a real Nutella v2 payload onto the catalog Food shape', () => {
    const payload = nutella as OffApiResponse;
    const { food, missingNutrition } = mapOffProductToFood(payload.product!, '3017620422003');
    expect(missingNutrition).toBe(false);
    expect(food.id).toBe('off-3017620422003');
    expect(food.barcode).toBe('3017620422003');
    expect(food.name_en).toBe('Nutella');
    expect(food.brand).toBe('Nutella');
    expect(food.basis).toBe('per_100g');
    expect(food.serving_unit).toBe('g');
    expect(food.default_serving).toBe(15);
    expect(food.kcal).toBe(539);
    expect(food.protein).toBe(6.3);
    expect(food.carbs).toBe(57.5);
    expect(food.fat).toBe(30.9);
    expect(food.tags).toEqual([QUICK_FOOD_TAG, OFF_FOOD_TAG]);
  });

  it('uses the Finnish product name when Open Food Facts has one', () => {
    const payload = finnishTuna as OffApiResponse;
    const { food } = mapOffProductToFood(payload.product!, '6408430000000');
    expect(food.name_en).toBe('Rainbow tonnikala vedessä');
    expect(food.name_fi).toBe('Rainbow tonnikala vedessä');
    expect(food.brand).toBe('Rainbow');
    expect(food.kcal).toBe(103);
    expect(food.protein).toBe(25);
    expect(food.fat).toBe(0.9);
    expect(food.carbs).toBe(0);
    expect(food.default_serving).toBe(80);
  });

  it('converts kJ-only energy to kcal per 100 g', () => {
    const payload = kjOnly as OffApiResponse;
    const { food, missingNutrition } = mapOffProductToFood(payload.product!, '4000000000000');
    expect(missingNutrition).toBe(false);
    expect(food.kcal).toBe(400);
    expect(food.protein).toBe(20);
    expect(food.carbs).toBe(60);
    expect(food.fat).toBe(5);
  });

  it('handles missing nutriments without throwing', () => {
    const payload = missingNutrition as OffApiResponse;
    const { food, missingNutrition: missing } = mapOffProductToFood(
      payload.product!,
      '5000000000000',
    );
    expect(missing).toBe(true);
    expect(food.name_en).toBe('Product 5000000000000');
    expect(food.kcal).toBe(0);
    expect(food.protein).toBe(0);
    expect(food.carbs).toBe(0);
    expect(food.fat).toBe(0);
    expect(readNutrimentsPer100g(payload.product!).missing).toBe(true);
  });

  it('does not map a not-found payload as a food', () => {
    const payload = notFound as OffApiResponse;
    expect(payload.status).toBe(0);
    expect(payload.product).toBeUndefined();
  });
});
