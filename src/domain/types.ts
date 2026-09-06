export type ServingUnit = 'g' | 'piece' | 'ml';
export type MacroBasis = 'per_100g' | 'per_piece' | 'per_ml';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type DietFlag =
  | 'dairy_free'
  | 'no_bread'
  | 'no_tofu'
  | 'eggs_ok'
  | 'fish_ok'
  | 'no_other_meat'
  | 'finnish_groceries';

export const DEFAULT_DIET_FLAGS: DietFlag[] = [
  'dairy_free',
  'no_bread',
  'no_tofu',
  'eggs_ok',
  'fish_ok',
  'no_other_meat',
  'finnish_groceries',
];

export const DEFAULT_TARGETS = {
  kcal: 2050,
  protein: 125,
  carbs: 265,
  fat: 60,
} as const;

export const HELSINKI_TZ = 'Europe/Helsinki';

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Food {
  id: string;
  name_fi: string;
  name_en?: string;
  brand?: string;
  serving_unit: ServingUnit;
  default_serving: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  basis: MacroBasis;
  tags: string[];
  excluded_by_flags: DietFlag[];
}

export interface FoodLog {
  id: string;
  date: string;
  meal_slot: MealSlot;
  food_id?: string;
  custom_name?: string;
  amount: number;
  unit: ServingUnit;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
}

export interface MealTemplateItem {
  food_id: string;
  amount: number;
  unit: ServingUnit;
}

export interface MealTemplate {
  id: string;
  name: string;
  meal_slot: MealSlot;
  items: MealTemplateItem[];
}

export interface UserTargets {
  id: 'default';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  diet_flags: DietFlag[];
  timezone: typeof HELSINKI_TZ;
  updated_at: string;
  /** When true, remaining kcal uses 2050+250 on Mon/Tue/Thu/Fri. Off by default. */
  adjust_for_training_day: boolean;
}

export interface DailySummary extends Macros {
  date: string;
  remaining: Macros;
}
