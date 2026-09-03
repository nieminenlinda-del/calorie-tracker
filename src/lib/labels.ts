import type { Food, FoodLog } from '../domain/types';
import { formatGrams, unitLabel } from '../domain/macros';

export function foodLabel(food: Food): string {
  return food.brand ? `${food.name_fi} · ${food.brand}` : food.name_fi;
}

export function logLabel(log: FoodLog, foods: Food[]): string {
  if (log.custom_name) return log.custom_name;
  const food = foods.find((item) => item.id === log.food_id);
  return food?.name_fi ?? 'Tuntematon';
}

export function amountLabel(amount: number, unit: FoodLog['unit']): string {
  return `${formatGrams(amount)} ${unitLabel(unit)}`;
}
