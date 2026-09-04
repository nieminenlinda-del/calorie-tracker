import { getDb } from '../db/database';
import { DEFAULT_DIET_FLAGS, DEFAULT_TARGETS, HELSINKI_TZ, type UserTargets } from '../domain/types';

export function defaultTargets(): UserTargets {
  return {
    id: 'default',
    ...DEFAULT_TARGETS,
    diet_flags: [...DEFAULT_DIET_FLAGS],
    timezone: HELSINKI_TZ,
    updated_at: new Date().toISOString(),
    adjust_for_training_day: false,
  };
}

export const targetsRepo = {
  async get(): Promise<UserTargets> {
    const db = await getDb();
    const existing = await db.get('user_targets', 'default');
    if (existing) {
      return {
        ...existing,
        adjust_for_training_day: existing.adjust_for_training_day ?? false,
      };
    }
    const created = defaultTargets();
    await db.put('user_targets', created);
    return created;
  },

  async save(patch: Partial<Omit<UserTargets, 'id' | 'timezone'>>): Promise<UserTargets> {
    const current = await this.get();
    const next: UserTargets = {
      ...current,
      ...patch,
      id: 'default',
      timezone: HELSINKI_TZ,
      updated_at: new Date().toISOString(),
    };
    const db = await getDb();
    await db.put('user_targets', next);
    return next;
  },
};
