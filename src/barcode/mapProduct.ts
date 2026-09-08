import { OFF_FOOD_TAG, QUICK_FOOD_TAG } from '../domain/logging';
import { roundKcal, roundMacro } from '../domain/macros';
import type { Food, Macros } from '../domain/types';
import { normalizeBarcode, offFoodId } from './normalize';
import type { OffNutriments, OffProduct } from './types';

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function firstNumber(record: OffNutriments | undefined, keys: string[]): number | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = num(record[key]);
    if (value != null) return value;
  }
  return undefined;
}

/** Prefer Finnish, then Swedish, then the generic OFF names. */
export function pickProductName(
  product: OffProduct,
  barcode: string,
): { name_fi: string; name_en: string } {
  const fi = clean(product.product_name_fi);
  const sv = clean(product.product_name_sv);
  const main = clean(product.product_name);
  const en = clean(product.product_name_en);
  const generic = clean(product.generic_name);
  const preferred = fi ?? sv ?? main ?? en ?? generic ?? `Product ${barcode}`;
  return {
    name_fi: fi ?? preferred,
    name_en: preferred,
  };
}

export function readNutrimentsPer100g(product: OffProduct): { macros: Macros; missing: boolean } {
  const n = product.nutriments;
  const protein = firstNumber(n, ['proteins_100g', 'proteins']);
  const fat = firstNumber(n, ['fat_100g', 'fat']);
  const carbs = firstNumber(n, ['carbohydrates_100g', 'carbohydrates']);
  let kcal = firstNumber(n, ['energy-kcal_100g', 'energy-kcal', 'energy-kcal_value']);
  if (kcal == null) {
    const kj = firstNumber(n, ['energy-kj_100g', 'energy-kj', 'energy_100g', 'energy']);
    if (kj != null) kcal = kj / 4.184;
  }
  const missing = kcal == null && protein == null && fat == null && carbs == null;
  return {
    macros: {
      kcal: roundKcal(kcal ?? 0),
      protein: roundMacro(protein ?? 0),
      carbs: roundMacro(carbs ?? 0),
      fat: roundMacro(fat ?? 0),
    },
    missing,
  };
}

function defaultServingG(product: OffProduct): number {
  const qty = num(product.serving_quantity);
  if (qty != null && qty >= 1 && qty <= 1000) return Math.round(qty);
  return 100;
}

export function mapOffProductToFood(
  product: OffProduct,
  barcode: string,
): { food: Food; missingNutrition: boolean } {
  const code = normalizeBarcode(product.code ?? barcode) || barcode;
  const names = pickProductName(product, code);
  const { macros, missing } = readNutrimentsPer100g(product);
  const brand = clean(product.brands)?.split(',')[0]?.trim();
  return {
    food: {
      id: offFoodId(code),
      name_fi: names.name_fi,
      name_en: names.name_en,
      brand,
      barcode: code,
      serving_unit: 'g',
      default_serving: defaultServingG(product),
      ...macros,
      basis: 'per_100g',
      tags: [QUICK_FOOD_TAG, OFF_FOOD_TAG],
      excluded_by_flags: [],
    },
    missingNutrition: missing,
  };
}
