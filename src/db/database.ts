import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Food, FoodLog, MealSlot, MealTemplate, UserTargets } from '../domain/types';

export const DB_NAME = 'ravinto';
export const DB_VERSION = 1;

export interface MetaRecord {
  key: string;
  value: unknown;
}

interface RavintoSchema extends DBSchema {
  foods: {
    key: string;
    value: Food;
    indexes: { 'by-name': string };
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

let dbPromise: Promise<RavintoDB> | null = null;

export function getDb(): Promise<RavintoDB> {
  if (!dbPromise) {
    dbPromise = openDB<RavintoSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
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
      },
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
