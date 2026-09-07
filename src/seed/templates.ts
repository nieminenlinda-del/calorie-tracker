import type { MealTemplate } from '../domain/types';

/** Sample training-day meals using Kost staples only. Snack 1 = banana + Härkis. */
export const SEED_TEMPLATES: MealTemplate[] = [
  {
    id: 'seed-aamiainen-proteiinipuuro',
    name: 'Protein porridge',
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
    name: 'Lentils + eggs',
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
    name: 'Banana + Härkis',
    meal_slot: 'snack',
    items: [
      { food_id: 'banaani', amount: 120, unit: 'g' },
      { food_id: 'harkis-original', amount: 100, unit: 'g' },
    ],
  },
  {
    id: 'seed-paivallinen-kirjolohi',
    name: 'Rainbow trout + couscous',
    meal_slot: 'dinner',
    items: [
      { food_id: 'kirjolohi', amount: 150, unit: 'g' },
      { food_id: 'kuskus', amount: 150, unit: 'g' },
      { food_id: 'kikherneet', amount: 80, unit: 'g' },
      { food_id: 'pakastekasvikset', amount: 200, unit: 'g' },
      { food_id: 'oliiviöljy', amount: 3, unit: 'g' },
    ],
  },
  {
    id: 'seed-iltapala-omena-suklaa',
    name: 'Apple + dark chocolate',
    meal_slot: 'evening_snack',
    items: [
      { food_id: 'omena', amount: 150, unit: 'g' },
      { food_id: 'tumma-suklaa', amount: 20, unit: 'g' },
    ],
  },
];
