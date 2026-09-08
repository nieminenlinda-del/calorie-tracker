import type { Food } from '../domain/types';
import { foodsRepo } from '../repos/foodsRepo';
import { mapOffProductToFood } from './mapProduct';
import { normalizeBarcode } from './normalize';
import { fetchOpenFoodFactsProduct } from './openFoodFacts';

export type BarcodeLookupResult =
  | {
      status: 'found';
      source: 'local' | 'off';
      food: Food;
      missingNutrition: boolean;
      barcode: string;
    }
  | { status: 'not_found'; barcode: string }
  | { status: 'error'; barcode: string; reason: 'offline' | 'error' };

export async function lookupBarcode(raw: string): Promise<BarcodeLookupResult> {
  const barcode = normalizeBarcode(raw);
  if (!barcode) {
    return { status: 'not_found', barcode: raw.trim() };
  }

  const local = await foodsRepo.getByBarcode(barcode);
  if (local) {
    return {
      status: 'found',
      source: 'local',
      food: local,
      missingNutrition: false,
      barcode: local.barcode ?? barcode,
    };
  }

  const remote = await fetchOpenFoodFactsProduct(barcode);
  if (remote.status === 'found') {
    const mapped = mapOffProductToFood(remote.product, barcode);
    return {
      status: 'found',
      source: 'off',
      food: mapped.food,
      missingNutrition: mapped.missingNutrition,
      barcode: mapped.food.barcode ?? barcode,
    };
  }
  if (remote.status === 'not_found') {
    return { status: 'not_found', barcode };
  }
  return { status: 'error', barcode, reason: remote.reason };
}
