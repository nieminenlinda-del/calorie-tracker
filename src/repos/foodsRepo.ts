import { getDb } from '../db/database';
import type { Food } from '../domain/types';

function catalogName(food: Food): string {
  return food.name_en?.trim() || food.name_fi;
}

function catalogRank(food: Food): number {
  return food.search_priority ?? 900;
}

export const foodsRepo = {
  async getAll(): Promise<Food[]> {
    const db = await getDb();
    const foods = await db.getAll('foods');
    return foods.sort((a, b) => {
      const rank = catalogRank(a) - catalogRank(b);
      if (rank !== 0) return rank;
      return catalogName(a).localeCompare(catalogName(b), 'en');
    });
  },

  async getById(id: string): Promise<Food | undefined> {
    const db = await getDb();
    return db.get('foods', id);
  },

  async put(food: Food): Promise<void> {
    const db = await getDb();
    await db.put('foods', food);
  },

  async putMany(foods: Food[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('foods', 'readwrite');
    await Promise.all(foods.map((food) => tx.store.put(food)));
    await tx.done;
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('foods', id);
  },

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getDb();
    const tx = db.transaction('foods', 'readwrite');
    await Promise.all(ids.map((id) => tx.store.delete(id)));
    await tx.done;
  },
};
