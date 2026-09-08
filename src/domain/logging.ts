import { macrosFromCustom, macrosPer100g, scaleFoodMacros } from '../domain/macros';
import { isMealSlot, MEAL_SLOTS, type Food, type FoodLog, type MealSlot, type MealTemplate } from '../domain/types';
import { logsRepo } from '../repos/logsRepo';
import { foodsRepo } from '../repos/foodsRepo';
import { templatesRepo } from '../repos/templatesRepo';

/** Groups logs into known meal slots. Unknown or missing slots are skipped so Today cannot crash. */
export function groupLogsByMealSlot<T extends { meal_slot?: unknown }>(logs: T[]): Record<MealSlot, T[]> {
  const grouped = Object.fromEntries(MEAL_SLOTS.map((slot) => [slot, [] as T[]])) as Record<MealSlot, T[]>;
  for (const log of logs) {
    if (!isMealSlot(log.meal_slot)) continue;
    grouped[log.meal_slot].push(log);
  }
  return grouped;
}

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

export const QUICK_FOOD_TAG = 'quick';
export const OFF_FOOD_TAG = 'off';

export function isQuickFood(food: Food): boolean {
  return food.tags.includes(QUICK_FOOD_TAG);
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags)];
}

function sameFoodName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('fi-FI') === b.trim().toLocaleLowerCase('fi-FI');
}

/**
 * Log a Quick Add entry and persist it to the foods library so it can be
 * reused from Recents / My foods without retyping macros.
 */
export async function logQuickAddFood(input: {
  date: string;
  meal_slot: MealSlot;
  name: string;
  amount: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}): Promise<{ food: Food; log: FoodLog }> {
  const name = input.name.trim();
  const amount = input.amount > 0 ? input.amount : 100;
  const entered = macrosFromCustom(input);
  const per100 = macrosPer100g(amount, entered);

  const existing = (await foodsRepo.getAll()).find(
    (food) => isQuickFood(food) && sameFoodName(food.name_fi, name),
  );

  const food: Food = {
    id: existing?.id ?? `quick-${newId()}`,
    name_fi: name,
    name_en: name,
    serving_unit: 'g',
    default_serving: amount,
    ...per100,
    basis: 'per_100g',
    tags: [QUICK_FOOD_TAG],
    excluded_by_flags: [],
  };
  await foodsRepo.put(food);

  const log: FoodLog = {
    id: newId(),
    date: input.date,
    meal_slot: input.meal_slot,
    food_id: food.id,
    amount,
    unit: 'g',
    ...entered,
    created_at: nowIso(),
  };
  await logsRepo.put(log);
  return { food, log };
}

/**
 * Persist a scanned Open Food Facts product like Quick Add (My foods + barcode)
 * and log the chosen portion into the current meal slot.
 * Seed staples matched by barcode are logged as-is and not overwritten.
 */
export async function logScannedFood(input: {
  date: string;
  meal_slot: MealSlot;
  draft: Food;
  amount: number;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}): Promise<{ food: Food; log: FoodLog }> {
  const existing = input.draft.barcode
    ? ((await foodsRepo.getByBarcode(input.draft.barcode)) ??
      (await foodsRepo.getById(input.draft.id)))
    : await foodsRepo.getById(input.draft.id);

  if (existing && !isQuickFood(existing)) {
    const log = await logCatalogFood({
      date: input.date,
      meal_slot: input.meal_slot,
      food: existing,
      amount: input.amount > 0 ? input.amount : existing.default_serving,
    });
    return { food: existing, log };
  }

  const name = input.name.trim() || input.draft.name_en || input.draft.name_fi;
  const amount = input.amount > 0 ? input.amount : input.draft.default_serving || 100;
  const entered = macrosFromCustom(input);
  const per100 =
    input.draft.basis === 'per_piece' ? entered : macrosPer100g(amount, entered);

  const food: Food = {
    ...input.draft,
    id: existing?.id ?? input.draft.id,
    name_fi: name,
    name_en: name,
    barcode: input.draft.barcode ?? existing?.barcode,
    serving_unit: input.draft.serving_unit === 'piece' ? 'piece' : 'g',
    default_serving: amount,
    ...per100,
    basis: input.draft.basis === 'per_piece' ? 'per_piece' : 'per_100g',
    tags: uniqueTags([...(existing?.tags ?? input.draft.tags), QUICK_FOOD_TAG]),
    excluded_by_flags: existing?.excluded_by_flags ?? input.draft.excluded_by_flags ?? [],
  };
  await foodsRepo.put(food);
  const log = await logCatalogFood({
    date: input.date,
    meal_slot: input.meal_slot,
    food,
    amount,
  });
  return { food, log };
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
