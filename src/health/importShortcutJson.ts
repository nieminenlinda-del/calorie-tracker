import { dailyActiveEnergyRepo, healthSamplesRepo } from '../repos/healthRepo';
import { dailyEnergyFromSummary } from './aggregate';
import type { DailyActiveEnergy, HealthSample, IngestResult } from './types';
import { roundActiveKcal, toKcal } from './units';
import { appleDateToIso } from './xml';

export const SHORTCUT_SCHEMA = 'linda-health-shortcut';
export const SHORTCUT_SCHEMA_VERSION = 1;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ShortcutImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShortcutImportError';
  }
}

export function isShortcutJsonFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) return true;
  const type = file.type.toLowerCase();
  return type === 'application/json' || type === 'text/json';
}

export interface ShortcutWorkoutInput {
  id?: string;
  activity_type?: string;
  start?: string;
  end?: string;
  duration_min?: number;
  energy_kcal?: number;
  source?: string;
}

export interface ShortcutDayInput {
  date: string;
  active_kcal?: number;
  sources?: string[];
  activity_summary?: {
    activeEnergyBurned: number;
    unit?: string;
  };
  workouts?: ShortcutWorkoutInput[];
}

export interface ShortcutPayload {
  schema: typeof SHORTCUT_SCHEMA;
  schema_version: number;
  exported_at?: string;
  timezone?: string;
  source?: string;
  days: ShortcutDayInput[];
}

export interface ParsedShortcutDay {
  row: DailyActiveEnergy;
  workouts: HealthSample[];
}

export interface ParsedShortcutJson {
  payload: ShortcutPayload;
  days: ParsedShortcutDay[];
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ShortcutImportError(`${label} puuttuu tai ei ole objekti`);
  }
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim().replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function asStringList(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => asString(item)).filter((item): item is string => Boolean(item)))];
}

function asList(value: unknown): unknown[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && value !== null && 'date' in value) return [value];
  if (typeof value === 'object' && value !== null) return Object.values(value);
  return [];
}

export function workoutActivityTypeFromShortcut(activityType: string): string {
  const trimmed = activityType.trim();
  if (!trimmed) return 'HKWorkoutActivityTypeOther';
  if (trimmed.startsWith('HKWorkoutActivityType')) return trimmed;
  const pascal = trimmed
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return `HKWorkoutActivityType${pascal || 'Other'}`;
}

function workoutToSample(workout: ShortcutWorkoutInput): HealthSample | null {
  const startRaw = asString(workout.start);
  if (!startRaw) return null;
  const startDate = appleDateToIso(startRaw);
  const durationMin = asFiniteNumber(workout.duration_min);
  const endRaw = asString(workout.end);
  let endDate = endRaw ? appleDateToIso(endRaw) : undefined;
  if (!endDate && durationMin != null) {
    endDate = new Date(new Date(startDate).getTime() + durationMin * 60_000).toISOString();
  }
  if (!endDate) endDate = startDate;

  const type = workoutActivityTypeFromShortcut(asString(workout.activity_type) ?? 'Other');
  const sourceName = asString(workout.source) ?? 'iOS Shortcuts';
  const energy = asFiniteNumber(workout.energy_kcal) ?? 0;
  const providedId = asString(workout.id);
  const id = providedId
    ? providedId.startsWith('shortcut:') || providedId.includes('|')
      ? providedId
      : `shortcut:${providedId}`
    : `shortcut:workout|${type}|${sourceName}|${startDate}|${endDate}`;

  return {
    id,
    type,
    sourceName,
    unit: 'kcal',
    value: energy,
    startDate,
    endDate,
    workoutId: providedId ?? id,
  };
}

function dayToRow(raw: Record<string, unknown>, fallbackSource?: string): ParsedShortcutDay {
  const date = asString(raw.date);
  if (!date || !DATE_RE.test(date)) {
    throw new ShortcutImportError('Shortcuts-JSON: virheellinen päivä (odotettu YYYY-MM-DD)');
  }

  const sources = asStringList(raw.sources);
  const summaryRaw = raw.activity_summary;
  let row: DailyActiveEnergy;

  if (summaryRaw != null && typeof summaryRaw === 'object' && !Array.isArray(summaryRaw)) {
    const summary = summaryRaw as Record<string, unknown>;
    const burned =
      asFiniteNumber(summary.activeEnergyBurned) ?? asFiniteNumber(summary.active_kcal);
    if (burned == null) {
      throw new ShortcutImportError(
        `Shortcuts-JSON: päivältä ${date} activity_summary.activeEnergyBurned puuttuu`,
      );
    }
    row = dailyEnergyFromSummary(
      {
        date,
        activeEnergyBurned: burned,
        unit: asString(summary.unit) ?? 'kcal',
      },
      sources,
    );
  } else {
    const active = asFiniteNumber(raw.active_kcal);
    if (active == null) {
      throw new ShortcutImportError(
        `Shortcuts-JSON: päivältä ${date} puuttuu active_kcal tai activity_summary`,
      );
    }
    const fallback = sources.length > 0 ? sources : [fallbackSource ?? 'iOS Shortcuts'];
    row = {
      date,
      active_kcal: roundActiveKcal(toKcal(active, 'kcal')),
      sources: [...new Set(fallback)].sort((a, b) => a.localeCompare(b)),
    };
  }

  const workouts = asList(raw.workouts)
    .map((item) => {
      if (item == null || typeof item !== 'object' || Array.isArray(item)) return null;
      return workoutToSample(item as ShortcutWorkoutInput);
    })
    .filter((sample): sample is HealthSample => sample != null);

  return { row, workouts };
}

export function parseShortcutJson(text: string): ParsedShortcutJson {
  const stripped = text.replace(/^\uFEFF/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new ShortcutImportError('Tiedosto ei ole kelvollinen JSON');
  }

  const root = asRecord(parsed, 'Shortcuts-JSON');
  const schema = asString(root.schema);
  if (schema !== SHORTCUT_SCHEMA) {
    throw new ShortcutImportError(
      'Tiedosto ei ole Shortcuts-vienti (schema: linda-health-shortcut)',
    );
  }

  const version = asFiniteNumber(root.schema_version);
  if (version !== SHORTCUT_SCHEMA_VERSION) {
    throw new ShortcutImportError('Tuntematon schema_version (odotettu 1)');
  }

  if (!('days' in root)) {
    throw new ShortcutImportError('Shortcuts-JSON:sta puuttuu days-taulukko');
  }

  const fileSource = asString(root.source);
  const days = asList(root.days).map((item) => {
    const raw = asRecord(item, 'Shortcuts-päivä');
    return dayToRow(raw, fileSource);
  });

  const payload: ShortcutPayload = {
    schema: SHORTCUT_SCHEMA,
    schema_version: SHORTCUT_SCHEMA_VERSION,
    exported_at: asString(root.exported_at),
    timezone: asString(root.timezone),
    source: fileSource,
    days: days.map((day) => ({
      date: day.row.date,
      active_kcal: day.row.active_kcal,
      sources: day.row.sources,
    })),
  };

  return { payload, days };
}

export async function ingestShortcutJson(text: string): Promise<IngestResult> {
  const { days } = parseShortcutJson(text);
  const workouts = days.flatMap((day) => day.workouts);
  const written = workouts.length > 0 ? await healthSamplesRepo.upsertMany(workouts) : { inserted: 0, updated: 0 };
  await dailyActiveEnergyRepo.putMany(days.map((day) => day.row));
  const dates = [...new Set(days.map((day) => day.row.date))].sort();
  return {
    scanned: days.length + workouts.length,
    inserted: written.inserted,
    duplicates: written.updated,
    days: dates.length,
    dates,
  };
}

export async function ingestShortcutFile(file: File): Promise<IngestResult> {
  return ingestShortcutJson(await file.text());
}
