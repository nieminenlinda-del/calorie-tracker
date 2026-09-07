import { getDb } from '../db/database';
import type { Food } from '../domain/types';

function catalogName(food: Food): string {
  return food.name_en?.trim() || food.name_fi;
}

export const foodsRepo = {
  async getAll(): Promise<Food[]> {
    const db = await getDb();
    const foods = await db.getAll('foods');
    return foods.sort((a, b) => catalogName(a).localeCompare(catalogName(b), 'en'));
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
};
