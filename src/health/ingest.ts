import { t } from '../i18n/locale';
import { dailyActiveEnergyRepo, healthSamplesRepo, recomputeDailyActiveEnergy } from '../repos/healthRepo';
import { dailyEnergyFromSummary, sampleDay } from './aggregate';
import { HealthExportScanner } from './parseExport';
import { ACTIVE_ENERGY_TYPE, type ActivitySummaryRecord, type HealthSample, type IngestProgress, type IngestResult } from './types';
import {
  iterateFileChunks,
  looksLikeXml,
  looksLikeZip,
  streamExportXmlFromZip,
  streamExportXmlFromZipChunks,
} from './zip';

export type ProgressFn = (progress: IngestProgress) => void;

const SAMPLE_FLUSH = 250;
const XML_SLICE = 32 * 1024;

function report(onProgress: ProgressFn | undefined, progress: IngestProgress): void {
  onProgress?.(progress);
}

class HealthIngestSession {
  scanned = 0;
  inserted = 0;
  duplicates = 0;
  private pending: HealthSample[] = [];
  private readonly seen = new Set<string>();
  private readonly summaries = new Map<string, ActivitySummaryRecord>();
  private readonly sourcesByDate = new Map<string, Set<string>>();
  private readonly sampleDates = new Set<string>();
  private readonly decoder = new TextDecoder('utf-8');
  private readonly scanner: HealthExportScanner;
  private readonly onProgress: ProgressFn | undefined;

  constructor(onProgress?: ProgressFn) {
    this.onProgress = onProgress;
    this.scanner = new HealthExportScanner({
      onSample: (sample) => this.handleSample(sample),
      onSummary: (summary) => this.summaries.set(summary.date, summary),
    });
  }

  feedText(chunk: string): void {
    this.scanner.feed(chunk);
  }

  feedBytes(chunk: Uint8Array): void {
    this.feedText(this.decoder.decode(chunk, { stream: true }));
  }

  end(): void {
    const tail = this.decoder.decode();
    if (tail) this.scanner.feed(tail);
    this.scanner.end();
  }

  pendingCount(): number {
    return this.pending.length;
  }

  async flush(): Promise<void> {
    if (this.pending.length === 0) return;
    const written = await healthSamplesRepo.putMany(this.pending);
    this.inserted += written.inserted;
    this.duplicates += written.duplicates;
    this.pending = [];
    report(this.onProgress, {
      scanned: this.scanned,
      inserted: this.inserted,
      duplicates: this.duplicates,
    });
  }

  async finish(): Promise<IngestResult> {
    this.end();
    await this.flush();
    const dates = await this.writeDailyEnergy();
    return {
      scanned: this.scanned,
      inserted: this.inserted,
      duplicates: this.duplicates,
      days: dates.length,
      dates,
    };
  }

  private handleSample(sample: HealthSample): void {
    this.scanned += 1;
    if (this.seen.has(sample.id)) {
      this.duplicates += 1;
      return;
    }
    this.seen.add(sample.id);
    this.pending.push(sample);
    if (sample.type === ACTIVE_ENERGY_TYPE) {
      const date = sampleDay(sample);
      this.sampleDates.add(date);
      let sources = this.sourcesByDate.get(date);
      if (!sources) {
        sources = new Set();
        this.sourcesByDate.set(date, sources);
      }
      if (sample.sourceName) sources.add(sample.sourceName);
    }
    if (this.scanned % 250 === 0) {
      report(this.onProgress, {
        scanned: this.scanned,
        inserted: this.inserted,
        duplicates: this.duplicates,
      });
    }
  }

  private async writeDailyEnergy(): Promise<string[]> {
    const dates = new Set<string>([...this.summaries.keys(), ...this.sampleDates]);

    const summaryDates: string[] = [];
    const fallbackDates: string[] = [];
    for (const date of dates) {
      if (this.summaries.has(date)) summaryDates.push(date);
      else fallbackDates.push(date);
    }

    for (const date of summaryDates) {
      const summary = this.summaries.get(date)!;
      const sources = [...(this.sourcesByDate.get(date) ?? [])];
      await dailyActiveEnergyRepo.put(dailyEnergyFromSummary(summary, sources));
    }
    if (fallbackDates.length > 0) {
      await recomputeDailyActiveEnergy(fallbackDates);
    }

    return [...dates].sort();
  }
}

export async function ingestHealthXml(
  xml: string,
  onProgress?: ProgressFn,
): Promise<IngestResult> {
  const session = new HealthIngestSession(onProgress);
  for (let i = 0; i < xml.length; i += XML_SLICE) {
    session.feedText(xml.slice(i, i + XML_SLICE));
    if (session.pendingCount() >= SAMPLE_FLUSH) await session.flush();
  }
  return session.finish();
}

export async function ingestHealthBytes(
  bytes: Uint8Array,
  onProgress?: ProgressFn,
): Promise<IngestResult> {
  if (looksLikeXml(bytes)) {
    const session = new HealthIngestSession(onProgress);
    for (let i = 0; i < bytes.length; i += XML_SLICE) {
      session.feedBytes(bytes.subarray(i, Math.min(i + XML_SLICE, bytes.length)));
      if (session.pendingCount() >= SAMPLE_FLUSH) await session.flush();
    }
    return session.finish();
  }
  if (!looksLikeZip(bytes)) {
    throw new Error(t('error.notHealthExport'));
  }

  const session = new HealthIngestSession(onProgress);
  streamExportXmlFromZip(bytes, (chunk) => {
    session.feedBytes(chunk);
  });
  if (session.pendingCount() >= SAMPLE_FLUSH) await session.flush();
  return session.finish();
}

export async function ingestHealthFile(
  file: File,
  onProgress?: ProgressFn,
): Promise<IngestResult> {
  const head = new Uint8Array(await file.slice(0, 256).arrayBuffer());
  if (looksLikeXml(head)) {
    const session = new HealthIngestSession(onProgress);
    for await (const chunk of iterateFileChunks(file)) {
      session.feedBytes(chunk);
      if (session.pendingCount() >= SAMPLE_FLUSH) await session.flush();
    }
    return session.finish();
  }
  if (!looksLikeZip(head)) {
    throw new Error(t('error.notHealthExport'));
  }

  const session = new HealthIngestSession(onProgress);
  await streamExportXmlFromZipChunks(iterateFileChunks(file), async (chunk) => {
    session.feedBytes(chunk);
    if (session.pendingCount() >= SAMPLE_FLUSH) await session.flush();
  });
  return session.finish();
}
