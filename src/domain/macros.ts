import type { Food, Macros, UserTargets } from './types';

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function roundKcal(value: number): number {
  return Math.round(value);
}

export function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

export function scaleFoodMacros(food: Food, amount: number): Macros {
  const factor =
    food.basis === 'per_piece' ? amount : amount / 100;
  return {
    kcal: roundKcal(food.kcal * factor),
    protein: roundMacro(food.protein * factor),
    carbs: roundMacro(food.carbs * factor),
    fat: roundMacro(food.fat * factor),
  };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: roundKcal(a.kcal + b.kcal),
    protein: roundMacro(a.protein + b.protein),
    carbs: roundMacro(a.carbs + b.carbs),
    fat: roundMacro(a.fat + b.fat),
  };
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(addMacros, { ...ZERO_MACROS });
}

export function remainingMacros(consumed: Macros, targets: UserTargets): Macros {
  return {
    kcal: roundKcal(targets.kcal - consumed.kcal),
    protein: roundMacro(targets.protein - consumed.protein),
    carbs: roundMacro(targets.carbs - consumed.carbs),
    fat: roundMacro(targets.fat - consumed.fat),
  };
}

export function macrosFromCustom(input: {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}): Macros {
  return {
    kcal: roundKcal(input.kcal),
    protein: roundMacro(input.protein),
    carbs: roundMacro(input.carbs),
    fat: roundMacro(input.fat),
  };
}

export function formatKcal(value: number): string {
  return String(Math.round(value));
}

export function formatGrams(value: number): string {
  const rounded = roundMacro(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function unitLabel(unit: Food['serving_unit']): string {
  if (unit === 'piece') return 'kpl';
  return unit;
}
