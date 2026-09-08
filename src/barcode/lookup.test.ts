/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { resetDbConnection } from '../db/database';
import { QUICK_FOOD_TAG, logScannedFood } from '../domain/logging';
import { foodsRepo } from '../repos/foodsRepo';
import { logsRepo } from '../repos/logsRepo';
import finnishTuna from './fixtures/off-finnish-tuna.json';
import notFound from './fixtures/off-not-found.json';
import { lookupBarcode } from './lookup';
import { barcodeCandidates, normalizeBarcode } from './normalize';
import { offProductUrl } from './openFoodFacts';
import { SEED_FOODS } from '../seed/foods';

async function deleteRavinto(): Promise<void> {
  await resetDbConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('ravinto');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('delete ravinto failed'));
    req.onblocked = () => resolve();
  });
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await deleteRavinto();
});

describe('normalizeBarcode', () => {
  it('strips punctuation and expands UPC-A to EAN-13', () => {
    expect(normalizeBarcode(' 3017-6204-22003 ')).toBe('3017620422003');
    expect(barcodeCandidates('012345678905')).toEqual(['012345678905', '0012345678905']);
    expect(barcodeCandidates('0012345678905')).toEqual(['0012345678905', '012345678905']);
  });
});

describe('lookupBarcode', () => {
  it('returns a mapped OFF product when the API hits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        expect(url).toBe(offProductUrl('6408430000000'));
        return new Response(JSON.stringify(finnishTuna), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const result = await lookupBarcode('6408430000000');
    expect(result.status).toBe('found');
    if (result.status !== 'found') return;
    expect(result.source).toBe('off');
    expect(result.food.name_en).toBe('Rainbow tonnikala vedessä');
    expect(result.food.protein).toBe(25);
  });

  it('prefers a local catalog food with the same barcode over OFF', async () => {
    const staple = {
      ...SEED_FOODS.find((food) => food.id === 'muna')!,
      barcode: '6408430000000',
    };
    await foodsRepo.put(staple);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await lookupBarcode('6408430000000');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe('found');
    if (result.status !== 'found') return;
    expect(result.source).toBe('local');
    expect(result.food.id).toBe('muna');
    expect(result.food.basis).toBe('per_piece');
  });

  it('returns not_found for an unknown barcode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify(notFound), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const result = await lookupBarcode('9999999999994');
    expect(result).toEqual({ status: 'not_found', barcode: '9999999999994' });
  });

  it('returns offline when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const result = await lookupBarcode('3017620422003');
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.reason).toBe('offline');
  });
});

describe('logScannedFood', () => {
  it('saves an OFF product to My foods and logs the portion into the meal slot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify(finnishTuna), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    const looked = await lookupBarcode('6408430000000');
    expect(looked.status).toBe('found');
    if (looked.status !== 'found') return;

    const { food, log } = await logScannedFood({
      date: '2026-09-08',
      meal_slot: 'lunch',
      draft: looked.food,
      amount: 80,
      name: looked.food.name_en ?? looked.food.name_fi,
      kcal: 82,
      protein: 20,
      carbs: 0,
      fat: 0.7,
    });

    expect(food.id).toBe('off-6408430000000');
    expect(food.tags).toContain(QUICK_FOOD_TAG);
    expect(food.barcode).toBe('6408430000000');
    expect(log.meal_slot).toBe('lunch');
    expect(log.food_id).toBe(food.id);
    expect(log.amount).toBe(80);
    expect(log.kcal).toBe(82);
    expect(await foodsRepo.getByBarcode('6408430000000')).toMatchObject({ id: food.id });
    expect(await logsRepo.getByDateAndSlot('2026-09-08', 'lunch')).toHaveLength(1);
  });

  it('does not overwrite a seeded staple matched by barcode', async () => {
    const egg = { ...SEED_FOODS.find((food) => food.id === 'muna')!, barcode: '2000000000008' };
    await foodsRepo.put(egg);
    const { food, log } = await logScannedFood({
      date: '2026-09-08',
      meal_slot: 'breakfast',
      draft: egg,
      amount: 2,
      name: 'Edited egg',
      kcal: 999,
      protein: 99,
      carbs: 99,
      fat: 99,
    });
    expect(food.id).toBe('muna');
    expect(food.name_en).toBe(egg.name_en);
    expect((await foodsRepo.getById('muna'))?.kcal).toBe(egg.kcal);
    expect(log.amount).toBe(2);
    expect(log.unit).toBe('piece');
  });
});
