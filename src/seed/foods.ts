import { stapleFromJson, SEED_FOODS_JSON, type SeedStapleJson } from '../data/seedFoods';
import type { Food } from '../domain/types';

/**
 * Kost’s final seed: branded priority foods first, remaining staples secondary.
 * Hapankorppu is included pending Linda’s no-bread exception confirm.
 */
export const SEED_FOODS: Food[] = (SEED_FOODS_JSON.staples as SeedStapleJson[]).map(
  (row, index) => stapleFromJson(row, index),
);
