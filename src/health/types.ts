/** Shared with Linda Lift. IndexedDB database name must stay exactly `linda-health`. */
export const HEALTH_DB_NAME = 'linda-health';
export const HEALTH_DB_VERSION = 1;

export const ACTIVE_ENERGY_TYPE = 'HKQuantityTypeIdentifierActiveEnergyBurned';

export interface HealthSample {
  id: string;
  type: string;
  sourceName: string;
  unit: string;
  value: number;
  startDate: string;
  endDate: string;
  workoutId?: string;
}

export interface DailyActiveEnergy {
  date: string;
  active_kcal: number;
  sources: string[];
}

export interface IngestProgress {
  scanned: number;
  inserted: number;
  duplicates: number;
}

export interface IngestResult extends IngestProgress {
  days: number;
  dates: string[];
}

export type TrainingDayCode = 'A' | 'B' | 'C' | 'D';
