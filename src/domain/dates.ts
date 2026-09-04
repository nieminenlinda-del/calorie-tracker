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

export function helsinkiDateFromInstant(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** 0 = Sunday … 6 = Saturday, using the Helsinki calendar date. */
export function helsinkiWeekday(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asIfUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );
  return asIfUtc - instant.getTime();
}

/** Interpret `YYYY-MM-DDTHH:mm:ss` as a wall clock in `timeZone`. */
export function zonedLocalToUtc(isoDate: string, time: string, timeZone: string): Date {
  const naive = new Date(`${isoDate}T${time}Z`);
  const first = new Date(naive.getTime() - tzOffsetMs(naive, timeZone));
  const secondOffset = tzOffsetMs(first, timeZone);
  const firstOffset = tzOffsetMs(naive, timeZone);
  if (secondOffset === firstOffset) return first;
  return new Date(naive.getTime() - secondOffset);
}

export function helsinkiDateUtcRange(isoDate: string): { startIso: string; endIso: string } {
  const start = zonedLocalToUtc(isoDate, '00:00:00', HELSINKI_TZ);
  const end = zonedLocalToUtc(addDays(isoDate, 1), '00:00:00', HELSINKI_TZ);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
