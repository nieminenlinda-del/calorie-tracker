export function toKcal(value: number, unit: string): number {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'kj') return value / 4.184;
  return value;
}

export function roundActiveKcal(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isWatchSource(sourceName: string): boolean {
  return /watch/i.test(sourceName);
}
