import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DailyActiveEnergy, HealthSample } from '../health/types';
import { HEALTH_DB_NAME, HEALTH_DB_VERSION } from '../health/types';

interface HealthSchema extends DBSchema {
  health_samples: {
    key: string;
    value: HealthSample;
    indexes: { 'by-type': string; 'by-startDate': string };
  };
  daily_active_energy: {
    key: string;
    value: DailyActiveEnergy;
  };
}

export type HealthDB = IDBPDatabase<HealthSchema>;

let dbPromise: Promise<HealthDB> | null = null;

export function getHealthDb(): Promise<HealthDB> {
  if (!dbPromise) {
    dbPromise = openDB<HealthSchema>(HEALTH_DB_NAME, HEALTH_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('health_samples')) {
          const samples = db.createObjectStore('health_samples', { keyPath: 'id' });
          samples.createIndex('by-type', 'type');
          samples.createIndex('by-startDate', 'startDate');
        }
        if (!db.objectStoreNames.contains('daily_active_energy')) {
          db.createObjectStore('daily_active_energy', { keyPath: 'date' });
        }
      },
    });
  }
  return dbPromise;
}

export async function resetHealthDbConnection(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}
