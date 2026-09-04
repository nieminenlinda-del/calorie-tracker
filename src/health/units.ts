export function toKcal(value: number, unit: string): number {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'kj') return value / 4.184;
  return value;
}

export function roundKcal1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isWatchSource(sourceName: string): boolean {
  return /watch/i.test(sourceName);
}
