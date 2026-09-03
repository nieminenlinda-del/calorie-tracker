import { getDb } from '../db/database';
import type { MealTemplate } from '../domain/types';

export const templatesRepo = {
  async getAll(): Promise<MealTemplate[]> {
    const db = await getDb();
    const templates = await db.getAll('meal_templates');
    const slotOrder = ['breakfast', 'lunch', 'snack', 'dinner'];
    return templates.sort((a, b) => {
      const slot = slotOrder.indexOf(a.meal_slot) - slotOrder.indexOf(b.meal_slot);
      if (slot !== 0) return slot;
      return a.name.localeCompare(b.name, 'fi');
    });
  },

  async getById(id: string): Promise<MealTemplate | undefined> {
    const db = await getDb();
    return db.get('meal_templates', id);
  },

  async put(template: MealTemplate): Promise<void> {
    const db = await getDb();
    await db.put('meal_templates', template);
  },

  async putMany(templates: MealTemplate[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('meal_templates', 'readwrite');
    await Promise.all(templates.map((t) => tx.store.put(t)));
    await tx.done;
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('meal_templates', id);
  },
};
