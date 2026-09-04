import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { resetHealthDbConnection } from '../db/healthDatabase';
import { getDailyActiveEnergy, healthSamplesRepo } from '../repos/healthRepo';
import {
  ingestShortcutJson,
  isShortcutJsonFile,
  parseShortcutJson,
  SHORTCUT_SCHEMA,
  workoutActivityTypeFromShortcut,
} from './importShortcutJson';
import { HEALTH_DB_NAME } from './types';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const FIXTURE_JSON = readFileSync(join(fixtureDir, 'fixtures/linda-health-shortcut.json'), 'utf8');

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

describe('Shortcuts JSON parse', () => {
  it('routes .json files to the Shortcuts importer', () => {
    expect(isShortcutJsonFile({ name: 'linda-health-shortcut.json', type: '' })).toBe(true);
    expect(isShortcutJsonFile({ name: 'export.xml', type: 'text/xml' })).toBe(false);
    expect(isShortcutJsonFile({ name: 'export.zip', type: 'application/zip' })).toBe(false);
    expect(isShortcutJsonFile({ name: 'drop', type: 'application/json' })).toBe(true);
  });

  it('maps human workout names to HKWorkoutActivityType*', () => {
    expect(workoutActivityTypeFromShortcut('Traditional Strength Training')).toBe(
      'HKWorkoutActivityTypeTraditionalStrengthTraining',
    );
    expect(
      workoutActivityTypeFromShortcut('HKWorkoutActivityTypeTraditionalStrengthTraining'),
    ).toBe('HKWorkoutActivityTypeTraditionalStrengthTraining');
  });

  it('prefers activity_summary over top-level active_kcal', () => {
    const { days } = parseShortcutJson(FIXTURE_JSON);
    expect(days).toHaveLength(2);
    expect(days[0]?.row).toEqual({
      date: '2026-09-03',
      active_kcal: 487,
      sources: ['ActivitySummary', 'Apple Watch'],
    });
    expect(days[1]?.row).toEqual({
      date: '2026-09-02',
      active_kcal: 180.5,
      sources: ['iOS Shortcuts'],
    });
    expect(days[0]?.workouts).toHaveLength(1);
    expect(days[0]?.workouts[0]).toMatchObject({
      id: 'shortcut:optional-stable-id',
      type: 'HKWorkoutActivityTypeTraditionalStrengthTraining',
      sourceName: 'Apple Watch',
      value: 320,
      unit: 'kcal',
      workoutId: 'optional-stable-id',
    });
  });

  it('rejects files that are not schema linda-health-shortcut', () => {
    expect(() => parseShortcutJson('{"schema":"nope","schema_version":1,"days":[]}')).toThrow(
      /schema: linda-health-shortcut/,
    );
    expect(() => parseShortcutJson('not json')).toThrow(/kelvollinen JSON/);
    expect(() =>
      parseShortcutJson(JSON.stringify({ schema: SHORTCUT_SCHEMA, schema_version: 2, days: [] })),
    ).toThrow(/schema_version/);
  });

  it('accepts stringy Shortcut dictionary values', () => {
    const { days } = parseShortcutJson(
      JSON.stringify({
        schema: SHORTCUT_SCHEMA,
        schema_version: '1',
        days: [
          {
            date: '2026-09-01',
            active_kcal: '220.4',
            sources: 'Apple Watch',
          },
        ],
      }),
    );
    expect(days[0]?.row).toEqual({
      date: '2026-09-01',
      active_kcal: 220.4,
      sources: ['Apple Watch'],
    });
  });
});

describe('Shortcuts JSON ingest into linda-health', () => {
  it('upserts daily_active_energy and optional workout samples from the fixture', async () => {
    const first = await ingestShortcutJson(FIXTURE_JSON);
    expect(first.days).toBe(2);
    expect(first.dates).toEqual(['2026-09-02', '2026-09-03']);
    expect(first.inserted).toBe(1);

    expect(await getDailyActiveEnergy('2026-09-03')).toEqual({
      date: '2026-09-03',
      active_kcal: 487,
      sources: ['ActivitySummary', 'Apple Watch'],
    });
    expect(await getDailyActiveEnergy('2026-09-02')).toEqual({
      date: '2026-09-02',
      active_kcal: 180.5,
      sources: ['iOS Shortcuts'],
    });

    const workouts = await healthSamplesRepo.getByType(
      'HKWorkoutActivityTypeTraditionalStrengthTraining',
    );
    expect(workouts).toHaveLength(1);
    expect(workouts[0]?.value).toBe(320);
    expect(workouts[0]?.startDate).toBe('2026-09-03T14:00:00.000Z');
    expect(workouts[0]?.endDate).toBe('2026-09-03T15:00:00.000Z');
  });

  it('overwrites the day row on re-import (latest wins)', async () => {
    await ingestShortcutJson(FIXTURE_JSON);
    const second = await ingestShortcutJson(
      JSON.stringify({
        schema: SHORTCUT_SCHEMA,
        schema_version: 1,
        days: [
          {
            date: '2026-09-03',
            active_kcal: 512,
            sources: ['ActivitySummary'],
            workouts: [
              {
                id: 'optional-stable-id',
                activity_type: 'Traditional Strength Training',
                start: '2026-09-03T17:00:00+03:00',
                end: '2026-09-03T18:00:00+03:00',
                energy_kcal: 340,
                source: 'Apple Watch',
              },
            ],
          },
        ],
      }),
    );
    expect(second.days).toBe(1);
    expect(second.duplicates).toBe(1);
    expect((await getDailyActiveEnergy('2026-09-03'))?.active_kcal).toBe(512);
    const workouts = await healthSamplesRepo.getByType(
      'HKWorkoutActivityTypeTraditionalStrengthTraining',
    );
    expect(workouts).toHaveLength(1);
    expect(workouts[0]?.value).toBe(340);
  });
});
