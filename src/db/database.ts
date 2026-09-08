import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';
import type { Food, FoodLog, MealSlot, MealTemplate, UserTargets } from '../domain/types';

export const DB_NAME = 'ravinto';
export const DB_VERSION = 2;

export interface MetaRecord {
  key: string;
  value: unknown;
}

interface RavintoSchema extends DBSchema {
  foods: {
    key: string;
    value: Food;
    indexes: { 'by-name': string; 'by-barcode': string };
  };
  food_logs: {
    key: string;
    value: FoodLog;
    indexes: { 'by-date': string; 'by-date-slot': [string, MealSlot] };
  };
  meal_templates: {
    key: string;
    value: MealTemplate;
  };
  user_targets: {
    key: string;
    value: UserTargets;
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
}

export type RavintoDB = IDBPDatabase<RavintoSchema>;

type UpgradeTx = IDBPTransaction<
  RavintoSchema,
  ArrayLike<
    'foods' | 'food_logs' | 'meal_templates' | 'user_targets' | 'meta'
  >,
  'versionchange'
>;

/**
 * Additive schema upgrades only.
 *
 * Never delete object stores, never clear `food_logs`, and never call
 * `indexedDB.deleteDatabase` from app startup / migrate / seed.
 * `deleteDatabase` is test-only (see `*.test.ts` helpers).
 *
 * v1 → v2 (barcode PR) only adds `foods.by-barcode`. Meal history is untouched.
 */
export function upgradeRavintoDb(
  db: IDBPDatabase<RavintoSchema>,
  oldVersion: number,
  _newVersion: number | null,
  transaction: UpgradeTx,
): void {
  if (!db.objectStoreNames.contains('foods')) {
    const foods = db.createObjectStore('foods', { keyPath: 'id' });
    foods.createIndex('by-name', 'name_fi');
  }
  if (!db.objectStoreNames.contains('food_logs')) {
    const logs = db.createObjectStore('food_logs', { keyPath: 'id' });
    logs.createIndex('by-date', 'date');
    logs.createIndex('by-date-slot', ['date', 'meal_slot']);
  }
  if (!db.objectStoreNames.contains('meal_templates')) {
    db.createObjectStore('meal_templates', { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains('user_targets')) {
    db.createObjectStore('user_targets', { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains('meta')) {
    db.createObjectStore('meta', { keyPath: 'key' });
  }
  // v2: index only. Do not recreate foods or touch food_logs.
  if (oldVersion < 2) {
    const foods = transaction.objectStore('foods');
    if (!foods.indexNames.contains('by-barcode')) {
      foods.createIndex('by-barcode', 'barcode');
    }
  }
}

let dbPromise: Promise<RavintoDB> | null = null;

export function getDb(): Promise<RavintoDB> {
  if (!dbPromise) {
    dbPromise = openDB<RavintoSchema>(DB_NAME, DB_VERSION, {
      upgrade: upgradeRavintoDb,
    });
  }
  return dbPromise;
}

export async function resetDbConnection(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}
