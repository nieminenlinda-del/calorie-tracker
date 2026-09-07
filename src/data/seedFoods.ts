import type { Food, MacroBasis } from '../domain/types';
import seed from './ravinto-seed-foods.json';

/** Kost paste shape. App ids / servings / tags are filled in here, not invented in the JSON. */
export interface SeedStapleJson {
  name_en: string;
  name_fi: string;
  basis: MacroBasis;
  kcal: number;
  p: number;
  c: number;
  f: number;
  priority: number;
}

interface StapleAppFields {
  id: string;
  default_serving: number;
  tags: string[];
  brand?: string;
  aliases?: string[];
}

const APP_FIELDS: Record<string, StapleAppFields> = {
  Oats: {
    id: 'kaurahiutaleet',
    default_serving: 40,
    tags: ['staple', 'breakfast', 'grain'],
    aliases: ['oatmeal', 'kaurahiutaleet', 'kaurapuuro'],
  },
  'Pea protein powder': {
    id: 'herneproteiini',
    default_serving: 30,
    tags: ['staple', 'protein', 'powder'],
    aliases: ['pea protein', 'herneproteiini'],
  },
  'Soy protein isolate (chocolate)': {
    id: 'soija-isolaatti-suklaa',
    default_serving: 30,
    tags: ['staple', 'protein', 'powder'],
    aliases: ['soy isolate', 'soijaproteiini', 'chocolate protein'],
  },
  'Alpro Go On plain': {
    id: 'alpro-go-on-plain',
    default_serving: 150,
    brand: 'Alpro',
    tags: ['staple', 'yogurt', 'plant'],
    aliases: ['alpro go on', 'alpro'],
  },
  'Oddlygood plain': {
    id: 'oddlygood-plain',
    default_serving: 150,
    brand: 'Oddlygood',
    tags: ['staple', 'yogurt', 'plant', 'finnish'],
    aliases: ['oddlygood', 'oddly good'],
  },
  'Frozen blueberries': {
    id: 'mustikat-pakaste',
    default_serving: 80,
    tags: ['staple', 'fruit', 'frozen'],
    aliases: ['blueberries', 'mustikat'],
  },
  'Peanut butter': {
    id: 'maapähkinävoi',
    default_serving: 12,
    tags: ['staple', 'fat', 'spread'],
    aliases: ['maapähkinävoi'],
  },
  Egg: {
    id: 'muna',
    default_serving: 1,
    tags: ['staple', 'egg'],
    aliases: ['eggs', 'kananmuna', 'muna'],
  },
  'Lentils, cooked': {
    id: 'linssit-keitetty',
    default_serving: 150,
    tags: ['staple', 'legume'],
    aliases: ['lentils', 'linssit'],
  },
  'Rice, cooked': {
    id: 'riisi-keitetty',
    default_serving: 150,
    tags: ['staple', 'grain'],
    aliases: ['rice', 'riisi'],
  },
  'Frozen mixed vegetables': {
    id: 'pakastekasvikset',
    default_serving: 200,
    tags: ['staple', 'veg', 'frozen'],
    aliases: ['mixed vegetables', 'pakastevihannekset'],
  },
  'Olive oil': {
    id: 'oliiviöljy',
    default_serving: 5,
    tags: ['staple', 'fat', 'oil'],
    aliases: ['oliiviöljy'],
  },
  Banana: {
    id: 'banaani',
    default_serving: 120,
    tags: ['staple', 'fruit'],
    aliases: ['banaani'],
  },
  'Härkis Original': {
    id: 'harkis-original',
    default_serving: 100,
    brand: 'Härkis',
    tags: ['staple', 'protein', 'finnish', 'legume'],
    aliases: ['härkis', 'harkis'],
  },
  Beanit: {
    id: 'beanit',
    default_serving: 100,
    brand: 'Beanit',
    tags: ['staple', 'protein', 'finnish', 'legume'],
    aliases: ['beanit'],
  },
  'Nyhtökaura (pulled oats)': {
    id: 'nyhtokaura',
    default_serving: 80,
    tags: ['staple', 'protein', 'finnish', 'oat'],
    aliases: ['nyhtökaura', 'pulled oats'],
  },
  'Chickpeas, cooked': {
    id: 'kikherneet',
    default_serving: 80,
    tags: ['staple', 'legume'],
    aliases: ['chickpeas', 'kikherneet'],
  },
  'Couscous, cooked': {
    id: 'kuskus',
    default_serving: 150,
    tags: ['staple', 'grain'],
    aliases: ['couscous', 'kuskus'],
  },
  'Rainbow trout': {
    id: 'kirjolohi',
    default_serving: 150,
    tags: ['staple', 'fish', 'finnish'],
    aliases: ['trout', 'kirjolohi'],
  },
  Salmon: {
    id: 'lohi',
    default_serving: 150,
    tags: ['staple', 'fish'],
    aliases: ['lohi'],
  },
  'Saithe / pollock': {
    id: 'seiti',
    default_serving: 150,
    tags: ['staple', 'fish'],
    aliases: ['saithe', 'pollock', 'seiti'],
  },
  'Tuna in water (canned)': {
    id: 'tonnikala-vedessa',
    default_serving: 100,
    tags: ['staple', 'fish'],
    aliases: ['tuna', 'tonnikala'],
  },
  'Soy granules (dry)': {
    id: 'soijarouhe',
    default_serving: 30,
    tags: ['staple', 'protein', 'soy'],
    aliases: ['soy granules', 'soijarouhe'],
  },
  'Potato, boiled': {
    id: 'peruna',
    default_serving: 200,
    tags: ['staple', 'veg', 'finnish'],
    aliases: ['potato', 'peruna'],
  },
  Apple: {
    id: 'omena',
    default_serving: 150,
    tags: ['staple', 'fruit'],
    aliases: ['omena'],
  },
  'Dark chocolate': {
    id: 'tumma-suklaa',
    default_serving: 20,
    tags: ['staple', 'treat'],
    aliases: ['tumma suklaa'],
  },
  'Frozen wok vegetables': {
    id: 'pakastewok-kasvikset',
    default_serving: 200,
    tags: ['staple', 'veg', 'frozen'],
    aliases: ['wok vegetables', 'pakastewok'],
  },
};

export const SEED_FOODS_JSON = seed;

export function stapleFromJson(row: SeedStapleJson, index: number): Food {
  const app = APP_FIELDS[row.name_en];
  if (!app) {
    throw new Error(`No app fields for Kost staple "${row.name_en}"`);
  }
  const serving_unit = row.basis === 'per_piece' ? 'piece' : row.basis === 'per_ml' ? 'ml' : 'g';
  const tags = row.priority === 2 && !app.tags.includes('secondary') ? [...app.tags, 'secondary'] : app.tags;
  return {
    id: app.id,
    name_fi: row.name_fi,
    name_en: row.name_en,
    brand: app.brand,
    aliases: app.aliases,
    serving_unit,
    default_serving: app.default_serving,
    kcal: row.kcal,
    protein: row.p,
    carbs: row.c,
    fat: row.f,
    basis: row.basis,
    tags,
    excluded_by_flags: [],
    search_priority: row.priority * 100 + index,
  };
}
