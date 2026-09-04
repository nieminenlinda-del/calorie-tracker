import { healthSamplesRepo, recomputeDailyActiveEnergy } from '../repos/healthRepo';
import { datesCoveredBy } from './aggregate';
import { HealthExportScanner } from './parseExport';
import type { HealthSample, IngestProgress, IngestResult } from './types';
import { extractExportXml, xmlBytesToString } from './zip';

export type ProgressFn = (progress: IngestProgress) => void;

function report(onProgress: ProgressFn | undefined, progress: IngestProgress): void {
  onProgress?.(progress);
}

export async function ingestHealthXml(
  xml: string,
  onProgress?: ProgressFn,
): Promise<IngestResult> {
  const pending: HealthSample[] = [];
  const seen = new Set<string>();
  let scanned = 0;
  let parseDupes = 0;

  const scanner = new HealthExportScanner((sample) => {
    scanned += 1;
    if (seen.has(sample.id)) {
      parseDupes += 1;
      return;
    }
    seen.add(sample.id);
    pending.push(sample);
    if (scanned % 250 === 0) {
      report(onProgress, { scanned, inserted: 0, duplicates: parseDupes });
    }
  });
  scanner.feed(xml);
  scanner.end();

  const written = await healthSamplesRepo.putMany(pending);
  const duplicates = parseDupes + written.duplicates;
  report(onProgress, { scanned, inserted: written.inserted, duplicates });

  const dates = datesCoveredBy(pending);
  await recomputeDailyActiveEnergy(dates);

  return {
    scanned,
    inserted: written.inserted,
    duplicates,
    days: dates.length,
    dates,
  };
}

export async function ingestHealthBytes(
  bytes: Uint8Array,
  onProgress?: ProgressFn,
): Promise<IngestResult> {
  const xmlBytes = extractExportXml(bytes);
  return ingestHealthXml(xmlBytesToString(xmlBytes), onProgress);
}
