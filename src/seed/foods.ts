import { stapleFromJson, SEED_FOODS_JSON, type SeedStapleJson } from '../data/seedFoods';
import type { Food } from '../domain/types';

/**
 * Kost's phase-1 staples. English `name_en` is the phone UI label;
 * Finnish is for grocery search. Macros come from
 * `src/data/ravinto-seed-foods.json` (Kost JSON; the shared-box copy was
 * not on this VM). No dairy, bread, näkkileipä, tofu, or land meat.
 * Do not invent extra brands beyond this list.
 */
export const SEED_FOODS: Food[] = (SEED_FOODS_JSON.staples as SeedStapleJson[]).map(
  (row, index) => stapleFromJson(row, index),
);
