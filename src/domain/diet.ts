import type { DietFlag, Food } from './types';

/** Hide foods whose exclusion flags overlap the user's diet flags. */
export function isFoodAllowed(food: Food, flags: DietFlag[]): boolean {
  if (food.excluded_by_flags.some((flag) => flags.includes(flag))) {
    return false;
  }
  if (food.tags.includes('egg') && !flags.includes('eggs_ok')) {
    return false;
  }
  if (food.tags.includes('fish') && !flags.includes('fish_ok')) {
    return false;
  }
  return true;
}

export function filterCatalog(foods: Food[], flags: DietFlag[]): Food[] {
  return foods.filter((food) => isFoodAllowed(food, flags));
}

export function searchFoods(foods: Food[], query: string): Food[] {
  const q = query.trim().toLocaleLowerCase('fi-FI');
  if (!q) return foods;
  return foods.filter((food) => {
    const hay = [food.name_fi, food.name_en, food.brand, ...food.tags]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('fi-FI');
    return hay.includes(q);
  });
}
