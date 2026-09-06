import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { helsinkiDateFromInstant, helsinkiDateUtcRange, helsinkiWeekday } from '../domain/dates';
import {
  TRAINING_DAY_KCAL_BONUS,
  effectiveKcalTarget,
  suggestedKcalTarget,
} from '../domain/energyTarget';
import { resetHealthDbConnection } from '../db/healthDatabase';
import { aggregateDailyActiveEnergy } from './aggregate';
import { ingestHealthBytes, ingestHealthXml } from './ingest';
import { parseHealthExport, parseHealthExportChunks, parseHealthExportXml } from './parseExport';
import { getTrainingDayCode, isTrainingDay, trainingDayLabel } from './trainingDay';
import { ACTIVE_ENERGY_TYPE, HEALTH_DB_NAME } from './types';
import { stripDoctype } from './xml';
import { extractExportXml } from './zip';
import { getDailyActiveEnergy, healthSamplesRepo } from '../repos/healthRepo';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const FIXTURE_XML = readFileSync(join(fixtureDir, 'fixtures/export.xml'), 'utf8');
const WATCH = 'Linda\u2019s Apple Watch';

async function deleteHealthDb(): Promise<void> {
  await resetHealthDbConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(HEALTH_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'));
    req.onblocked = () => resolve();
  });
}

afterEach(async () => {
  await deleteHealthDb();
});

describe('Apple Health export parse', () => {
  it('strips the HealthData DOCTYPE so Records inside the DTD are not ingested', () => {
    const stripped = stripDoctype(FIXTURE_XML);
    expect(stripped.startsWith('<?xml') || stripped.startsWith('<HealthData')).toBe(true);
    expect(stripped).not.toMatch(/<!DOCTYPE/i);
    expect(stripped).toContain('<HealthData');
  });

  it('parses Watch+Polar samples, multi-line Polar workouts, and ActivitySummary', () => {
    const { samples, summaries } = parseHealthExport(FIXTURE_XML);
    const energy = samples.filter((sample) => sample.type === ACTIVE_ENERGY_TYPE);
    const workouts = samples.filter((sample) => sample.type.includes('Workout'));
    expect(energy).toHaveLength(6);
    expect(new Set(energy.map((sample) => sample.id)).size).toBe(5);
    expect(energy.some((sample) => sample.value === 1.215 && sample.unit === 'kcal')).toBe(true);
    expect(energy.some((sample) => sample.sourceName === 'Polar Beat')).toBe(true);
    expect(energy.some((sample) => sample.sourceName === WATCH)).toBe(true);
    expect(samples.some((sample) => sample.type.includes('HeartRate'))).toBe(false);
    expect(workouts).toHaveLength(1);
    expect(workouts[0]?.sourceName).toBe('Polar Beat');
    expect(workouts[0]?.workoutId).toBe('polar-workout-abc');
    expect(summaries).toEqual([
      { date: '2026-09-01', activeEnergyBurned: 455.96, unit: 'kcal' },
      { date: '2026-09-02', activeEnergyBurned: 180.5, unit: 'kcal' },
    ]);
  });

  it('matches full-string parse when the xml is streamed in tiny chunks', () => {
    const chunks: string[] = [];
    for (let i = 0; i < FIXTURE_XML.length; i += 11) {
      chunks.push(FIXTURE_XML.slice(i, i + 11));
    }
    expect(parseHealthExportChunks(chunks)).toEqual(parseHealthExport(FIXTURE_XML));
  });
});

describe('daily active energy', () => {
  it('falls back to Watch samples (not Polar+Watch sum) when no ActivitySummary', () => {
    const rows = aggregateDailyActiveEnergy(parseHealthExportXml(FIXTURE_XML));
    expect(rows).toEqual([
      {
        date: '2026-09-01',
        active_kcal: 2.43,
        sources: [WATCH],
      },
      {
        date: '2026-09-02',
        active_kcal: 100,
        sources: [WATCH],
      },
      {
        date: '2026-09-03',
        active_kcal: 220.4,
        sources: [WATCH],
      },
    ]);
  });
});

describe('training calendar', () => {
  it('maps Mon/Tue/Thu/Fri to A/B/C/D and the rest to rest days', () => {
    expect(helsinkiWeekday('2026-08-31')).toBe(1);
    expect(getTrainingDayCode('2026-08-31')).toBe('A');
    expect(getTrainingDayCode('2026-09-01')).toBe('B');
    expect(getTrainingDayCode('2026-09-02')).toBeNull();
    expect(getTrainingDayCode('2026-09-03')).toBe('C');
    expect(getTrainingDayCode('2026-09-04')).toBe('D');
    expect(isTrainingDay('2026-09-05')).toBe(false);
    expect(isTrainingDay('2026-09-06')).toBe(false);
    expect(trainingDayLabel('2026-09-01')).toBe('training B');
    expect(trainingDayLabel('2026-09-02')).toBe('rest');
  });

  it('does not change the 2050 baseline unless the training-day toggle is on', () => {
    expect(
      effectiveKcalTarget({
        baselineKcal: 2050,
        date: '2026-09-01',
        adjustForTrainingDay: false,
      }),
    ).toBe(2050);
    expect(
      effectiveKcalTarget({
        baselineKcal: 2050,
        date: '2026-09-01',
        adjustForTrainingDay: true,
      }),
    ).toBe(2050 + TRAINING_DAY_KCAL_BONUS);
    expect(suggestedKcalTarget(2050, '2026-09-02')).toBe(2050);
  });
});

describe('Helsinki instants', () => {
  it('buckets Active Energy across the EEST midnight boundary', () => {
    expect(helsinkiDateFromInstant('2026-09-01T20:30:00.000Z')).toBe('2026-09-01');
    expect(helsinkiDateFromInstant('2026-09-01T21:30:00.000Z')).toBe('2026-09-02');
    expect(helsinkiDateUtcRange('2026-09-01')).toEqual({
      startIso: '2026-08-31T21:00:00.000Z',
      endIso: '2026-09-01T21:00:00.000Z',
    });
  });
});

describe('ingest into shared linda-health', () => {
  it('uses ActivitySummary for daily_active_energy when present', async () => {
    const first = await ingestHealthXml(FIXTURE_XML);
    expect(first.inserted).toBe(6);
    expect(first.duplicates).toBe(1);
    expect(first.days).toBe(3);

    const tuesday = await getDailyActiveEnergy('2026-09-01');
    expect(tuesday).toEqual({
      date: '2026-09-01',
      active_kcal: 455.96,
      sources: [WATCH, 'Polar Beat'],
    });
    expect(isTrainingDay(tuesday!.date)).toBe(true);
    expect(trainingDayLabel(tuesday!.date)).toBe('training B');

    const rest = await getDailyActiveEnergy('2026-09-02');
    expect(rest?.active_kcal).toBe(180.5);
    expect(isTrainingDay(rest!.date)).toBe(false);
    expect(trainingDayLabel(rest!.date)).toBe('rest');

    const thursday = await getDailyActiveEnergy('2026-09-03');
    expect(thursday).toEqual({
      date: '2026-09-03',
      active_kcal: 220.4,
      sources: [WATCH],
    });
    expect(trainingDayLabel(thursday!.date)).toBe('training C');

    const samples = await healthSamplesRepo.getByType(ACTIVE_ENERGY_TYPE);
    expect(samples).toHaveLength(5);

    const second = await ingestHealthXml(FIXTURE_XML);
    expect(second.inserted).toBe(0);
    expect(second.duplicates).toBeGreaterThan(0);
    expect((await getDailyActiveEnergy('2026-09-01'))?.active_kcal).toBe(455.96);
  });

  it('streams export.xml from a zip and ignores gpx routes + export_cda.xml', async () => {
    const zip = zipSync({
      'apple_health_export/workout-routes/route.gpx': strToU8(
        '<?xml version="1.0"?><gpx>ignored</gpx>',
      ),
      'apple_health_export/export_cda.xml': strToU8('<ClinicalDocument/>'),
      'apple_health_export/export.xml': strToU8(FIXTURE_XML),
    });
    const xml = extractExportXml(zip);
    expect(new TextDecoder().decode(xml)).toContain('<HealthData');
    expect(new TextDecoder().decode(xml)).not.toContain('<gpx>');

    const result = await ingestHealthBytes(zip);
    expect(result.inserted).toBe(6);
    expect((await getDailyActiveEnergy('2026-09-01'))?.active_kcal).toBe(455.96);
    expect((await getDailyActiveEnergy('2026-09-03'))?.active_kcal).toBe(220.4);
  });
});
