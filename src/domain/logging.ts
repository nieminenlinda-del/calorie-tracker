import { scaleFoodMacros } from '../domain/macros';
import type { Food, FoodLog, MealSlot, MealTemplate } from '../domain/types';
import { logsRepo } from '../repos/logsRepo';
import { foodsRepo } from '../repos/foodsRepo';
import { templatesRepo } from '../repos/templatesRepo';

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function logCatalogFood(input: {
  date: string;
  meal_slot: MealSlot;
  food: Food;
  amount: number;
}): Promise<FoodLog> {
  const macros = scaleFoodMacros(input.food, input.amount);
  const log: FoodLog = {
    id: newId(),
    date: input.date,
    meal_slot: input.meal_slot,
    food_id: input.food.id,
    amount: input.amount,
    unit: input.food.serving_unit,
    ...macros,
    created_at: nowIso(),
  };
  await logsRepo.put(log);
  return log;
}

export async function logCustomFood(input: {
  date: string;
  meal_slot: MealSlot;
  name: string;
  amount: number;
  unit: FoodLog['unit'];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}): Promise<FoodLog> {
  const log: FoodLog = {
    id: newId(),
    date: input.date,
    meal_slot: input.meal_slot,
    custom_name: input.name.trim(),
    amount: input.amount,
    unit: input.unit,
    kcal: input.kcal,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    created_at: nowIso(),
  };
  await logsRepo.put(log);
  return log;
}

export async function updateLogAmount(
  log: FoodLog,
  amount: number,
  food?: Food,
): Promise<FoodLog> {
  let next: FoodLog;
  if (food) {
    next = { ...log, amount, unit: food.serving_unit, ...scaleFoodMacros(food, amount) };
  } else {
    if (log.amount === 0) return log;
    const factor = amount / log.amount;
    next = {
      ...log,
      amount,
      kcal: Math.round(log.kcal * factor),
      protein: Math.round(log.protein * factor * 10) / 10,
      carbs: Math.round(log.carbs * factor * 10) / 10,
      fat: Math.round(log.fat * factor * 10) / 10,
    };
  }
  await logsRepo.put(next);
  return next;
}

export async function applyTemplate(input: {
  template: MealTemplate;
  date: string;
  meal_slot?: MealSlot;
}): Promise<FoodLog[]> {
  const foods = await foodsRepo.getAll();
  const byId = new Map(foods.map((f) => [f.id, f]));
  const slot = input.meal_slot ?? input.template.meal_slot;
  const created: FoodLog[] = [];
  for (const item of input.template.items) {
    const food = byId.get(item.food_id);
    if (!food) continue;
    created.push(
      await logCatalogFood({
        date: input.date,
        meal_slot: slot,
        food,
        amount: item.amount,
      }),
    );
  }
  return created;
}

export async function copyLogsToDate(
  sourceLogs: FoodLog[],
  date: string,
  meal_slot?: MealSlot,
): Promise<FoodLog[]> {
  const copies: FoodLog[] = sourceLogs.map((log) => ({
    ...log,
    id: newId(),
    date,
    meal_slot: meal_slot ?? log.meal_slot,
    created_at: nowIso(),
  }));
  await logsRepo.putMany(copies);
  return copies;
}

export async function saveMealAsTemplate(input: {
  name: string;
  meal_slot: MealSlot;
  logs: FoodLog[];
}): Promise<MealTemplate> {
  const items = input.logs
    .filter((log) => log.food_id)
    .map((log) => ({
      food_id: log.food_id as string,
      amount: log.amount,
      unit: log.unit,
    }));
  const template: MealTemplate = {
    id: newId(),
    name: input.name.trim(),
    meal_slot: input.meal_slot,
    items,
  };
  await templatesRepo.put(template);
  return template;
}
