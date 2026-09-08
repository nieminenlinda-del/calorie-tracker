import { barcodeCandidates, normalizeBarcode } from './normalize';
import type { OffApiResponse, OffProduct } from './types';

const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_fi',
  'product_name_sv',
  'product_name_en',
  'generic_name',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
  'quantity',
  'nutrition_data_per',
].join(',');

export type OffFetchResult =
  | { status: 'found'; product: OffProduct }
  | { status: 'not_found' }
  | { status: 'error'; reason: 'offline' | 'error' };

export function offProductUrl(barcode: string): string {
  const code = encodeURIComponent(normalizeBarcode(barcode));
  return `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`;
}

async function fetchOne(barcode: string): Promise<OffFetchResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 'error', reason: 'offline' };
  }
  try {
    const response = await fetch(offProductUrl(barcode), {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'fi,sv,en',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok) return { status: 'error', reason: 'error' };
    const data = (await response.json()) as OffApiResponse;
    if (data.status === 1 && data.product) {
      return {
        status: 'found',
        product: { ...data.product, code: data.product.code ?? barcode },
      };
    }
    return { status: 'not_found' };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    const offline =
      name === 'AbortError' ||
      name === 'TimeoutError' ||
      err instanceof TypeError ||
      (typeof navigator !== 'undefined' && navigator.onLine === false);
    return { status: 'error', reason: offline ? 'offline' : 'error' };
  }
}

export async function fetchOpenFoodFactsProduct(barcode: string): Promise<OffFetchResult> {
  const codes = barcodeCandidates(barcode);
  if (codes.length === 0) return { status: 'not_found' };
  let lastError: OffFetchResult | null = null;
  for (const code of codes) {
    const result = await fetchOne(code);
    if (result.status === 'found' || result.status === 'not_found') {
      if (result.status === 'found') return result;
      continue;
    }
    lastError = result;
  }
  return lastError ?? { status: 'not_found' };
}
