import type { MealTemplate } from '../domain/types';

/** Sample training-day meals using the seeded Finnish staples. */
export const SEED_TEMPLATES: MealTemplate[] = [
  {
    id: 'seed-aamiainen-proteiinipuuro',
    name: 'Proteiinipuuro',
    meal_slot: 'breakfast',
    items: [
      { food_id: 'kaurahiutaleet', amount: 50, unit: 'g' },
      { food_id: 'alpro-go-on-plain', amount: 200, unit: 'g' },
      { food_id: 'herneproteiini', amount: 25, unit: 'g' },
      { food_id: 'mustikat-pakaste', amount: 80, unit: 'g' },
      { food_id: 'maapähkinävoi', amount: 12, unit: 'g' },
    ],
  },
  {
    id: 'seed-lounas-linssi-munat',
    name: 'Linssi + munat',
    meal_slot: 'lunch',
    items: [
      { food_id: 'muna', amount: 2, unit: 'piece' },
      { food_id: 'linssit-keitetty', amount: 150, unit: 'g' },
      { food_id: 'riisi-keitetty', amount: 150, unit: 'g' },
      { food_id: 'pakastekasvikset', amount: 200, unit: 'g' },
      { food_id: 'oliiviöljy', amount: 5, unit: 'g' },
    ],
  },
  {
    id: 'seed-valipala-banaani-harkis',
    name: 'Banaani + Härkis',
    meal_slot: 'snack',
    items: [
      { food_id: 'banaani', amount: 120, unit: 'g' },
      { food_id: 'harkis-original', amount: 120, unit: 'g' },
      { food_id: 'omena', amount: 100, unit: 'g' },
    ],
  },
  {
    id: 'seed-paivallinen-kirjolohi',
    name: 'Kirjolohi + kuskus',
    meal_slot: 'dinner',
    items: [
      { food_id: 'kirjolohi', amount: 150, unit: 'g' },
      { food_id: 'kuskus', amount: 150, unit: 'g' },
      { food_id: 'kikherneet', amount: 80, unit: 'g' },
      { food_id: 'pakastekasvikset', amount: 200, unit: 'g' },
      { food_id: 'oliiviöljy', amount: 3, unit: 'g' },
    ],
  },
];
