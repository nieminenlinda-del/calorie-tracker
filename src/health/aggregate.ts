import { helsinkiDateFromInstant } from '../domain/dates';
import {
  ACTIVE_ENERGY_TYPE,
  type ActivitySummaryRecord,
  type DailyActiveEnergy,
  type HealthSample,
} from './types';
import { isWatchSource, roundActiveKcal, toKcal } from './units';

export function sampleDay(sample: HealthSample): string {
  return helsinkiDateFromInstant(sample.startDate);
}

export function aggregateDailyActiveEnergy(samples: HealthSample[]): DailyActiveEnergy[] {
  const unique = new Map<string, HealthSample>();
  for (const sample of samples) {
    if (sample.type !== ACTIVE_ENERGY_TYPE) continue;
    unique.set(sample.id, sample);
  }

  const byDate = new Map<string, HealthSample[]>();
  for (const sample of unique.values()) {
    const date = sampleDay(sample);
    const list = byDate.get(date);
    if (list) list.push(sample);
    else byDate.set(date, [sample]);
  }

  const rows: DailyActiveEnergy[] = [];
  for (const [date, list] of byDate) {
    const watch = list.filter((sample) => isWatchSource(sample.sourceName));
    const used = watch.length > 0 ? watch : list;
    const sources = [...new Set(used.map((sample) => sample.sourceName))];
    const active_kcal = roundActiveKcal(
      used.reduce((sum, sample) => sum + toKcal(sample.value, sample.unit), 0),
    );
    rows.push({ date, active_kcal, sources });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function dailyEnergyFromSummary(
  summary: ActivitySummaryRecord,
  sources: string[] = [],
): DailyActiveEnergy {
  const uniqueSources = [...new Set(sources)].sort((a, b) => a.localeCompare(b));
  return {
    date: summary.date,
    active_kcal: roundActiveKcal(toKcal(summary.activeEnergyBurned, summary.unit)),
    sources: uniqueSources.length > 0 ? uniqueSources : ['ActivitySummary'],
  };
}

export function datesCoveredBy(samples: HealthSample[]): string[] {
  const dates = new Set<string>();
  for (const sample of samples) {
    if (sample.type !== ACTIVE_ENERGY_TYPE) continue;
    const start = sampleDay(sample);
    dates.add(start);
    const end = helsinkiDateFromInstant(sample.endDate);
    if (end !== start) dates.add(end);
  }
  return [...dates].sort();
}
