/** Keep digits only so scanner punctuation / spaces still look up. */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * UPC-A is 12 digits; Open Food Facts often stores the same product as EAN-13
 * with a leading zero (and vice versa).
 */
export function barcodeCandidates(raw: string): string[] {
  const code = normalizeBarcode(raw);
  if (!code) return [];
  const out = [code];
  if (code.length === 12) out.push(`0${code}`);
  if (code.length === 13 && code.startsWith('0')) out.push(code.slice(1));
  return [...new Set(out)];
}

export function offFoodId(barcode: string): string {
  return `off-${normalizeBarcode(barcode)}`;
}
