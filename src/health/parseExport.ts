import { ACTIVE_ENERGY_TYPE, type HealthSample } from './types';
import { appleDateToIso, parseAttributes, sampleId, stripDoctype } from './xml';

const KEEP_RECORD_TYPES = new Set([ACTIVE_ENERGY_TYPE]);

function isTagBoundary(char: string | undefined): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '/' || char === '>';
}

function nextTag(buffer: string, from: number): { name: 'Record' | 'Workout'; start: number } | null {
  let best: { name: 'Record' | 'Workout'; start: number } | null = null;
  for (const name of ['Record', 'Workout'] as const) {
    const token = `<${name}`;
    let idx = buffer.indexOf(token, from);
    while (idx !== -1) {
      if (isTagBoundary(buffer[idx + token.length])) {
        if (!best || idx < best.start) best = { name, start: idx };
        break;
      }
      idx = buffer.indexOf(token, idx + 1);
    }
  }
  return best;
}

function findTagEnd(buffer: string, start: number, name: string): number {
  let i = start + 1;
  let inQuote = false;
  while (i < buffer.length) {
    const char = buffer[i];
    if (char === '"') inQuote = !inQuote;
    else if (!inQuote && char === '>') {
      if (buffer[i - 1] === '/') return i + 1;
      const close = `</${name}>`;
      const closeIdx = buffer.indexOf(close, i + 1);
      if (closeIdx === -1) return -1;
      return closeIdx + close.length;
    }
    i += 1;
  }
  return -1;
}

function metadataValue(xml: string, key: string): string | undefined {
  const re = /<MetadataEntry\b([^>]*)\/?\s*>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    const attrs = parseAttributes(match[1]);
    if (attrs.key === key && attrs.value) return attrs.value;
  }
  return undefined;
}

function fromRecord(xml: string): HealthSample | null {
  const openEnd = xml.indexOf('>');
  const attrs = parseAttributes(openEnd === -1 ? xml : xml.slice(0, openEnd + 1));
  const type = attrs.type;
  if (!type || !KEEP_RECORD_TYPES.has(type)) return null;
  if (attrs.value === undefined || attrs.startDate === undefined || attrs.endDate === undefined) {
    return null;
  }
  const startDate = appleDateToIso(attrs.startDate);
  const endDate = appleDateToIso(attrs.endDate);
  const value = Number(attrs.value);
  if (!Number.isFinite(value)) return null;
  const unit = attrs.unit ?? 'kcal';
  const sourceName = attrs.sourceName ?? '';
  const workoutId =
    metadataValue(xml, 'HKWorkoutActivityId') ?? metadataValue(xml, 'HKExternalUUID');
  const sample: HealthSample = {
    id: sampleId({ type, sourceName, startDate, endDate, unit, value }),
    type,
    sourceName,
    unit,
    value,
    startDate,
    endDate,
  };
  if (workoutId) sample.workoutId = workoutId;
  return sample;
}

function fromWorkout(xml: string): HealthSample | null {
  const openEnd = xml.indexOf('>');
  const attrs = parseAttributes(openEnd === -1 ? xml : xml.slice(0, openEnd + 1));
  const type = attrs.workoutActivityType;
  if (!type || attrs.startDate === undefined || attrs.endDate === undefined) return null;
  const startDate = appleDateToIso(attrs.startDate);
  const endDate = appleDateToIso(attrs.endDate);
  const value = Number(attrs.totalEnergyBurned ?? 0);
  const unit = attrs.totalEnergyBurnedUnit ?? 'kcal';
  const sourceName = attrs.sourceName ?? '';
  const id = sampleId({ type, sourceName, startDate, endDate, unit, value });
  const workoutId = metadataValue(xml, 'HKExternalUUID') ?? id;
  return {
    id,
    type,
    sourceName,
    unit,
    value: Number.isFinite(value) ? value : 0,
    startDate,
    endDate,
    workoutId,
  };
}

export class HealthExportScanner {
  private buffer = '';
  private skippingDoctype = true;
  private readonly onSample: (sample: HealthSample) => void;

  constructor(onSample: (sample: HealthSample) => void) {
    this.onSample = onSample;
  }

  feed(chunk: string): void {
    this.buffer += chunk;
    if (this.skippingDoctype) {
      const idx = this.buffer.search(/<HealthData[\s>]/);
      if (idx === -1) {
        if (this.buffer.length > 128) this.buffer = this.buffer.slice(-64);
        return;
      }
      this.buffer = this.buffer.slice(idx);
      this.skippingDoctype = false;
    }
    this.drain();
  }

  end(): void {
    if (this.skippingDoctype) {
      this.buffer = stripDoctype(this.buffer);
      this.skippingDoctype = false;
    }
    this.drain();
  }

  private drain(): void {
    while (this.buffer.length > 0) {
      const found = nextTag(this.buffer, 0);
      if (!found) {
        const lastLt = this.buffer.lastIndexOf('<');
        this.buffer = lastLt === -1 ? '' : this.buffer.slice(lastLt);
        return;
      }
      if (found.start > 0) this.buffer = this.buffer.slice(found.start);
      const end = findTagEnd(this.buffer, 0, found.name);
      if (end === -1) return;
      const xml = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end);
      const sample = found.name === 'Record' ? fromRecord(xml) : fromWorkout(xml);
      if (sample) this.onSample(sample);
    }
  }
}

export function parseHealthExportXml(xml: string): HealthSample[] {
  const samples: HealthSample[] = [];
  const scanner = new HealthExportScanner((sample) => samples.push(sample));
  scanner.feed(xml);
  scanner.end();
  return samples;
}

export function parseHealthExportChunks(chunks: string[]): HealthSample[] {
  const samples: HealthSample[] = [];
  const scanner = new HealthExportScanner((sample) => samples.push(sample));
  for (const chunk of chunks) scanner.feed(chunk);
  scanner.end();
  return samples;
}
