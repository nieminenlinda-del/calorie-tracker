import { getDb } from '../db/database';
import type { FoodLog, MealSlot } from '../domain/types';

export const logsRepo = {
  async getByDate(date: string): Promise<FoodLog[]> {
    const db = await getDb();
    const logs = await db.getAllFromIndex('food_logs', 'by-date', date);
    return logs.sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async getByDateAndSlot(date: string, meal_slot: MealSlot): Promise<FoodLog[]> {
    const db = await getDb();
    const logs = await db.getAllFromIndex('food_logs', 'by-date-slot', [date, meal_slot]);
    return logs.sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async getAll(): Promise<FoodLog[]> {
    const db = await getDb();
    const logs = await db.getAll('food_logs');
    return logs.sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async getRecent(limit = 40): Promise<FoodLog[]> {
    const all = await this.getAll();
    return all.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  },

  async count(): Promise<number> {
    const db = await getDb();
    return db.count('food_logs');
  },

  async countByDate(date: string): Promise<number> {
    const db = await getDb();
    return db.countFromIndex('food_logs', 'by-date', date);
  },

  async put(log: FoodLog): Promise<void> {
    const db = await getDb();
    await db.put('food_logs', log);
  },

  async putMany(logs: FoodLog[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('food_logs', 'readwrite');
    await Promise.all(logs.map((log) => tx.store.put(log)));
    await tx.done;
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('food_logs', id);
  },

  async clear(): Promise<void> {
    const db = await getDb();
    await db.clear('food_logs');
  },
};
