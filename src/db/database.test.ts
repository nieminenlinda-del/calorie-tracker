import { afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DB_NAME, DB_VERSION, getDb, resetDbConnection } from './database';
import type { FoodLog } from '../domain/types';

const sampleLog: FoodLog = {
  id: 'log-keep-v1',
  date: '2026-09-08',
  meal_slot: 'breakfast',
  custom_name: 'Overnight oats',
  amount: 200,
  unit: 'g',
  kcal: 350,
  protein: 20,
  carbs: 45,
  fat: 8,
  created_at: '2026-09-08T04:10:00.000Z',
};

async function deleteRavinto(): Promise<void> {
  await resetDbConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('delete ravinto failed'));
    req.onblocked = () => resolve();
  });
}

function openNative(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onerror = () => reject(req.error ?? new Error('open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
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
    };
  });
}

function putLog(db: IDBDatabase, log: FoodLog): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('food_logs', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('put log failed'));
    tx.objectStore('food_logs').put(log);
  });
}

afterEach(async () => {
  await deleteRavinto();
});

describe('ravinto IndexedDB upgrades', () => {
  it('keeps food_logs unchanged when upgrading a v1 database to the current version', async () => {
    const v1 = await openNative(1);
    expect(v1.version).toBe(1);
    expect(v1.transaction('foods').objectStore('foods').indexNames.contains('by-barcode')).toBe(
      false,
    );
    await putLog(v1, sampleLog);
    v1.close();
    await resetDbConnection();

    const current = await getDb();
    expect(current.version).toBe(DB_VERSION);
    expect(current.transaction('foods').store.indexNames.contains('by-barcode')).toBe(true);

    const stored = await current.get('food_logs', sampleLog.id);
    expect(stored).toEqual(sampleLog);
    expect(await current.getAll('food_logs')).toEqual([sampleLog]);
  });

  it('does not call deleteDatabase or clear food_logs in app open / migrate / seed', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const files = ['db/database.ts', 'seed/bootstrap.ts', 'main.tsx'];
    for (const file of files) {
      const text = readFileSync(join(root, file), 'utf8');
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/indexedDB\.deleteDatabase/);
      expect(code, file).not.toMatch(/\.clear\(\s*['"]food_logs['"]\s*\)/);
      expect(code, file).not.toMatch(/objectStore\(\s*['"]food_logs['"]\s*\)[\s\S]{0,80}\.clear\(/);
    }
  });
});
