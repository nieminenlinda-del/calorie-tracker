import { getDb } from '../db/database';
import { foodsRepo } from '../repos/foodsRepo';
import { targetsRepo } from '../repos/targetsRepo';
import { templatesRepo } from '../repos/templatesRepo';
import { SEED_FOODS } from './foods';
import { SEED_TEMPLATES } from './templates';

export const SEED_VERSION = 1;

export async function bootstrapDb(): Promise<void> {
  const db = await getDb();
  const meta = await db.get('meta', 'seed_version');
  const version = typeof meta?.value === 'number' ? meta.value : 0;

  await foodsRepo.putMany(SEED_FOODS);

  if (version < SEED_VERSION) {
    await templatesRepo.putMany(SEED_TEMPLATES);
  } else {
    const existing = await templatesRepo.getAll();
    const existingIds = new Set(existing.map((t) => t.id));
    const missing = SEED_TEMPLATES.filter((t) => !existingIds.has(t.id));
    if (missing.length > 0) {
      await templatesRepo.putMany(missing);
    }
  }

  await targetsRepo.get();
  await db.put('meta', { key: 'seed_version', value: SEED_VERSION });
}
