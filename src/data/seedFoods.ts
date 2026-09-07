import type { Food, MacroBasis } from '../domain/types';
import seed from './ravinto-seed-foods.json';

export interface SeedStapleJson {
  id: string;
  name_en: string;
  name_fi: string;
  brand?: string;
  aliases?: string[];
  basis: MacroBasis;
  kcal: number;
  p: number;
  c: number;
  f: number;
  priority: number;
  default_serving: number;
  tags: string[];
}

export const SEED_FOODS_JSON = seed;

export function stapleFromJson(row: SeedStapleJson, index: number): Food {
  const serving_unit = row.basis === 'per_piece' ? 'piece' : row.basis === 'per_ml' ? 'ml' : 'g';
  return {
    id: row.id,
    name_fi: row.name_fi,
    name_en: row.name_en,
    brand: row.brand,
    aliases: row.aliases,
    serving_unit,
    default_serving: row.default_serving,
    kcal: row.kcal,
    protein: row.p,
    carbs: row.c,
    fat: row.f,
    basis: row.basis,
    tags: row.tags,
    excluded_by_flags: [],
    search_priority: row.priority * 100 + index,
  };
}
