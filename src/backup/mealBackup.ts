import { getDb, DB_VERSION, type MetaRecord } from '../db/database';
import type { Food, FoodLog, MealTemplate, UserTargets } from '../domain/types';
import { t } from '../i18n/locale';
import { foodsRepo } from '../repos/foodsRepo';
import { logsRepo } from '../repos/logsRepo';
import { targetsRepo } from '../repos/targetsRepo';
import { templatesRepo } from '../repos/templatesRepo';

export const BACKUP_SCHEMA = 'ravinto-backup';
export const BACKUP_SCHEMA_VERSION = 1;

export type ImportMode = 'merge' | 'replace';

export interface MealBackup {
  schema: typeof BACKUP_SCHEMA;
  schema_version: number;
  exported_at: string;
  db_version: number;
  food_logs: FoodLog[];
  foods: Food[];
  user_targets: UserTargets[];
  meal_templates: MealTemplate[];
  meta: MetaRecord[];
}

export interface ParsedMealBackup {
  schema: typeof BACKUP_SCHEMA;
  schema_version: number;
  exported_at?: string;
  db_version?: number;
  food_logs?: FoodLog[];
  foods?: Food[];
  user_targets?: UserTargets[];
  meal_templates?: MealTemplate[];
  meta?: MetaRecord[];
}

export interface ImportResult {
  mode: ImportMode;
  food_logs: number;
  foods: number;
  user_targets: number;
  meal_templates: number;
  meta: number;
}

export class MealBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MealBackupError';
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new MealBackupError(t('error.notObject', { label }));
  }
  return value as Record<string, unknown>;
}

function optionalIdRecords<T extends { id: string }>(value: unknown, label: string): T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new MealBackupError(t('error.backupMissingArray', { label }));
  }
  return value.map((item, index) => {
    const row = asRecord(item, `${label}[${index}]`);
    if (typeof row.id !== 'string' || row.id.length === 0) {
      throw new MealBackupError(t('error.backupMissingId', { label: `${label}[${index}]` }));
    }
    return row as T;
  });
}

function optionalMetaRecords(value: unknown): MetaRecord[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new MealBackupError(t('error.backupMissingArray', { label: 'meta' }));
  }
  return value.map((item, index) => {
    const row = asRecord(item, `meta[${index}]`);
    if (typeof row.key !== 'string' || row.key.length === 0) {
      throw new MealBackupError(t('error.backupMissingId', { label: `meta[${index}]` }));
    }
    return { key: row.key, value: row.value } as MetaRecord;
  });
}

export function parseMealBackupJson(text: string): ParsedMealBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new MealBackupError(t('error.invalidJson'));
  }
  const payload = asRecord(raw, 'backup');
  if (payload.schema !== BACKUP_SCHEMA) {
    throw new MealBackupError(t('error.notRavintoBackup'));
  }
  if (payload.schema_version !== BACKUP_SCHEMA_VERSION) {
    throw new MealBackupError(t('error.unknownBackupVersion'));
  }
  return {
    schema: BACKUP_SCHEMA,
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: typeof payload.exported_at === 'string' ? payload.exported_at : undefined,
    db_version: typeof payload.db_version === 'number' ? payload.db_version : undefined,
    food_logs: optionalIdRecords<FoodLog>(payload.food_logs, 'food_logs'),
    foods: optionalIdRecords<Food>(payload.foods, 'foods'),
    user_targets: optionalIdRecords<UserTargets>(payload.user_targets, 'user_targets'),
    meal_templates: optionalIdRecords<MealTemplate>(payload.meal_templates, 'meal_templates'),
    meta: optionalMetaRecords(payload.meta),
  };
}

async function readMeta(): Promise<MetaRecord[]> {
  const db = await getDb();
  return db.getAll('meta');
}

async function writeMeta(records: MetaRecord[], replace: boolean): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('meta', 'readwrite');
  if (replace) await tx.store.clear();
  await Promise.all(records.map((row) => tx.store.put(row)));
  await tx.done;
}

export async function exportMealBackup(): Promise<MealBackup> {
  const [food_logs, foods, user_targets, meal_templates, meta] = await Promise.all([
    logsRepo.getAll(),
    foodsRepo.getAll(),
    (async () => {
      const db = await getDb();
      return db.getAll('user_targets');
    })(),
    templatesRepo.getAll(),
    readMeta(),
  ]);
  return {
    schema: BACKUP_SCHEMA,
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    db_version: DB_VERSION,
    food_logs,
    foods,
    user_targets,
    meal_templates,
    meta,
  };
}

/**
 * Restore meal data.
 *
 * - `merge` (default): upsert by id/key. Stores omitted from the file are left as-is.
 * - `replace`: clear each store **present** in the file, then put those records.
 *   Omitted stores are never wiped. Never calls `deleteDatabase`.
 */
export async function importMealBackup(
  backup: ParsedMealBackup,
  mode: ImportMode = 'merge',
): Promise<ImportResult> {
  const replace = mode === 'replace';

  if (backup.food_logs !== undefined) {
    if (replace) await logsRepo.clear();
    await logsRepo.putMany(backup.food_logs);
  }
  if (backup.foods !== undefined) {
    if (replace) await foodsRepo.clear();
    await foodsRepo.putMany(backup.foods);
  }
  if (backup.user_targets !== undefined) {
    if (replace) await targetsRepo.clear();
    const db = await getDb();
    const tx = db.transaction('user_targets', 'readwrite');
    await Promise.all(backup.user_targets.map((row) => tx.store.put(row)));
    await tx.done;
  }
  if (backup.meal_templates !== undefined) {
    if (replace) await templatesRepo.clear();
    await templatesRepo.putMany(backup.meal_templates);
  }
  if (backup.meta !== undefined) {
    await writeMeta(backup.meta, replace);
  }

  return {
    mode,
    food_logs: backup.food_logs?.length ?? 0,
    foods: backup.foods?.length ?? 0,
    user_targets: backup.user_targets?.length ?? 0,
    meal_templates: backup.meal_templates?.length ?? 0,
    meta: backup.meta?.length ?? 0,
  };
}

export async function importMealBackupText(
  text: string,
  mode: ImportMode = 'merge',
): Promise<ImportResult> {
  return importMealBackup(parseMealBackupJson(text), mode);
}

export function mealBackupFilename(date: string): string {
  return `ravinto-backup-${date}.json`;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
