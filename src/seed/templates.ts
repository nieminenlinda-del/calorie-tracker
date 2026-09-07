import sampleDay from '../data/sample-training-day.json';
import type { MealSlot, MealTemplate, MealTemplateItem, ServingUnit } from '../domain/types';

interface SampleMealJson {
  id: string;
  name: string;
  meal_slot: MealSlot;
  training_day: boolean;
  items: Array<{ food_id: string; amount: number; unit: ServingUnit }>;
}

function toTemplate(meal: SampleMealJson): MealTemplate {
  return {
    id: meal.id,
    name: meal.name,
    meal_slot: meal.meal_slot,
    items: meal.items.map(
      (item): MealTemplateItem => ({
        food_id: item.food_id,
        amount: item.amount,
        unit: item.unit,
      }),
    ),
  };
}

const meals = sampleDay.meals as SampleMealJson[];

/** Linda’s 2026-09-07 meals as training-day defaults; Kost Snack 1 A/B as alternates. */
export const SEED_TEMPLATES: MealTemplate[] = meals.map(toTemplate);

export const TRAINING_DAY_TEMPLATES: MealTemplate[] = meals
  .filter((meal) => meal.training_day)
  .map(toTemplate);

export const SAMPLE_DAY_TARGETS = sampleDay.targets;
export const SAMPLE_DAY_SLOT_LABELS = sampleDay.slots.map((slot) => slot.label_en);
