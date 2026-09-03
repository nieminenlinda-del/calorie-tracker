import { HELSINKI_TZ } from './types';

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: HELSINKI_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const displayFmt = new Intl.DateTimeFormat('fi-FI', {
  timeZone: HELSINKI_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export function helsinkiToday(): string {
  return dateFmt.format(new Date());
}

export function formatHelsinkiDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12));
  return displayFmt.format(utcNoon);
}

export function addDays(isoDate: string, delta: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day + delta);
  return dateFmt.format(new Date(utc));
}

export function isToday(isoDate: string): boolean {
  return isoDate === helsinkiToday();
}

export function previousDay(isoDate: string): string {
  return addDays(isoDate, -1);
}
