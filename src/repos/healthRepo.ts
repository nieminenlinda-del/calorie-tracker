import { getHealthDb } from '../db/healthDatabase';
import { helsinkiDateUtcRange } from '../domain/dates';
import { aggregateDailyActiveEnergy } from '../health/aggregate';
import { ACTIVE_ENERGY_TYPE, type DailyActiveEnergy, type HealthSample } from '../health/types';

const SAMPLE_BATCH = 200;

export async function getDailyActiveEnergy(date: string): Promise<DailyActiveEnergy | undefined> {
  const db = await getHealthDb();
  return db.get('daily_active_energy', date);
}

export const healthSamplesRepo = {
  async get(id: string): Promise<HealthSample | undefined> {
    const db = await getHealthDb();
    return db.get('health_samples', id);
  },

  async putMany(samples: HealthSample[]): Promise<{ inserted: number; duplicates: number }> {
    const db = await getHealthDb();
    let inserted = 0;
    let duplicates = 0;
    for (let i = 0; i < samples.length; i += SAMPLE_BATCH) {
      const chunk = samples.slice(i, i + SAMPLE_BATCH);
      const tx = db.transaction('health_samples', 'readwrite');
      for (const sample of chunk) {
        const existing = await tx.store.get(sample.id);
        if (existing) {
          duplicates += 1;
          continue;
        }
        await tx.store.put(sample);
        inserted += 1;
      }
      await tx.done;
    }
    return { inserted, duplicates };
  },

  async getByType(type: string): Promise<HealthSample[]> {
    const db = await getHealthDb();
    return db.getAllFromIndex('health_samples', 'by-type', type);
  },

  async getActiveEnergyForDate(date: string): Promise<HealthSample[]> {
    const { startIso, endIso } = helsinkiDateUtcRange(date);
    const db = await getHealthDb();
    const range = IDBKeyRange.bound(startIso, endIso, false, true);
    const inWindow = await db.getAllFromIndex('health_samples', 'by-startDate', range);
    return inWindow.filter((sample) => sample.type === ACTIVE_ENERGY_TYPE);
  },
};

export const dailyActiveEnergyRepo = {
  async get(date: string): Promise<DailyActiveEnergy | undefined> {
    return getDailyActiveEnergy(date);
  },

  async put(row: DailyActiveEnergy): Promise<void> {
    const db = await getHealthDb();
    await db.put('daily_active_energy', row);
  },

  async putMany(rows: DailyActiveEnergy[]): Promise<void> {
    const db = await getHealthDb();
    const tx = db.transaction('daily_active_energy', 'readwrite');
    await Promise.all(rows.map((row) => tx.store.put(row)));
    await tx.done;
  },

  async listRecent(limit = 14): Promise<DailyActiveEnergy[]> {
    const db = await getHealthDb();
    const all = await db.getAll('daily_active_energy');
    return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  },
};

export async function recomputeDailyActiveEnergy(dates: string[]): Promise<DailyActiveEnergy[]> {
  const rows: DailyActiveEnergy[] = [];
  for (const date of dates) {
    const samples = await healthSamplesRepo.getActiveEnergyForDate(date);
    const [row] = aggregateDailyActiveEnergy(samples);
    if (row) {
      await dailyActiveEnergyRepo.put(row);
      rows.push(row);
    } else {
      const empty: DailyActiveEnergy = { date, active_kcal: 0, sources: [] };
      await dailyActiveEnergyRepo.put(empty);
      rows.push(empty);
    }
  }
  return rows;
}
