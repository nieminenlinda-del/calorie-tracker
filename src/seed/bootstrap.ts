import { getDb } from '../db/database';
import { getHealthDb } from '../db/healthDatabase';
import { QUICK_FOOD_TAG } from '../domain/logging';
import { foodsRepo } from '../repos/foodsRepo';
import { targetsRepo } from '../repos/targetsRepo';
import { templatesRepo } from '../repos/templatesRepo';
import { SEED_FOODS } from './foods';
import { SEED_TEMPLATES } from './templates';

export const SEED_VERSION = 3;

async function pruneNonSeedCatalog(): Promise<void> {
  const seedIds = new Set(SEED_FOODS.map((food) => food.id));
  const existing = await foodsRepo.getAll();
  const stale = existing
    .filter((food) => !seedIds.has(food.id) && !food.tags.includes(QUICK_FOOD_TAG))
    .map((food) => food.id);
  await foodsRepo.deleteMany(stale);
}

async function refreshSeedTemplates(previousVersion: number): Promise<void> {
  if (previousVersion < SEED_VERSION) {
    const existing = await templatesRepo.getAll();
    await Promise.all(
      existing.filter((template) => template.id.startsWith('seed-')).map((template) => templatesRepo.delete(template.id)),
    );
    await templatesRepo.putMany(SEED_TEMPLATES);
    return;
  }
  const existing = await templatesRepo.getAll();
  const existingIds = new Set(existing.map((t) => t.id));
  const missing = SEED_TEMPLATES.filter((t) => !existingIds.has(t.id));
  if (missing.length > 0) {
    await templatesRepo.putMany(missing);
  }
}

export async function bootstrapDb(): Promise<void> {
  const db = await getDb();
  const meta = await db.get('meta', 'seed_version');
  const version = typeof meta?.value === 'number' ? meta.value : 0;

  await foodsRepo.putMany(SEED_FOODS);
  await pruneNonSeedCatalog();
  await refreshSeedTemplates(version);

  await targetsRepo.get();
  await db.put('meta', { key: 'seed_version', value: SEED_VERSION });

  try {
    await getHealthDb();
  } catch (err) {
    console.error('linda-health open failed', err);
  }
}
