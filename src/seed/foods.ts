import {
  mergeSeedFoods,
  SEED_FOODS_JSON,
  LINDA_MFP_FOODS_JSON,
  type SeedStapleJson,
  type LindaMfpFoodJson,
} from '../data/seedFoods';
import type { Food } from '../domain/types';

/**
 * Kost staples plus Linda's named MFP brands from the 2026-09-07 today log.
 * Branded items replace overlapping Kost generics (same id). Remaining Kost
 * foods stay in the catalog. No dairy, soft bread, tofu, or land meat.
 * Small hapankorppu is included because Linda logged it.
 */
export const SEED_FOODS: Food[] = mergeSeedFoods(
  SEED_FOODS_JSON.staples as SeedStapleJson[],
  LINDA_MFP_FOODS_JSON.foods as LindaMfpFoodJson[],
);
