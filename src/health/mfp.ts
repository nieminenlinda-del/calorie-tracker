import { macrosFromCustom } from '../domain/macros';
import type { FoodLog, MealSlot } from '../domain/types';
import { mealSlotLabel } from '../i18n/locale';
import { logsRepo } from '../repos/logsRepo';

export const MFP_ID_PREFIX = 'mfp:';

const SLOT_BY_MEAL: Record<string, MealSlot> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
  snacks: 'snack',
};

export function parseCsvRecords(text: string): Record<string, string>[] {
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = splitCsvLines(raw);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map((cell) => cell.trim());
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = (cells[i] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

export function mapMfpMeal(meal: string): MealSlot | null {
  return SLOT_BY_MEAL[meal.trim().toLowerCase()] ?? null;
}

function num(row: Record<string, string>, key: string): number {
  const raw = row[key]?.replace(',', '.') ?? '';
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function mfpLogId(date: string, slot: MealSlot): string {
  return `${MFP_ID_PREFIX}${date}:${slot}`;
}

export function isMfpLog(log: Pick<FoodLog, 'id'>): boolean {
  return log.id.startsWith(MFP_ID_PREFIX);
}

export function foodLogsFromMfpRows(rows: Record<string, string>[]): FoodLog[] {
  const merged = new Map<string, FoodLog>();
  for (const row of rows) {
    const date = row.Date?.trim();
    const slot = mapMfpMeal(row.Meal ?? '');
    if (!date || !slot) continue;
    const macros = macrosFromCustom({
      kcal: num(row, 'Calories'),
      protein: num(row, 'Protein (g)'),
      carbs: num(row, 'Carbohydrates (g)'),
      fat: num(row, 'Fat (g)'),
    });
    const note = row.Note?.trim();
    const time = row.Time?.trim();
    const label = note
      ? `MFP: ${mealSlotLabel(slot)} · ${note}`
      : `MFP: ${mealSlotLabel(slot)}`;
    const id = mfpLogId(date, slot);
    const existing = merged.get(id);
    if (existing) {
      merged.set(id, {
        ...existing,
        kcal: existing.kcal + macros.kcal,
        protein: Math.round((existing.protein + macros.protein) * 10) / 10,
        carbs: Math.round((existing.carbs + macros.carbs) * 10) / 10,
        fat: Math.round((existing.fat + macros.fat) * 10) / 10,
      });
      continue;
    }
    merged.set(id, {
      id,
      date,
      meal_slot: slot,
      custom_name: time ? `${label} (${time})` : label,
      amount: 1,
      unit: 'g',
      ...macros,
      created_at: new Date().toISOString(),
    });
  }
  return [...merged.values()];
}

export interface MfpIngestResult {
  days: number;
  meals: number;
  replaced: number;
}

export async function ingestMfpNutritionCsv(text: string): Promise<MfpIngestResult> {
  const logs = foodLogsFromMfpRows(parseCsvRecords(text));
  const dates = [...new Set(logs.map((log) => log.date))];
  let replaced = 0;
  for (const date of dates) {
    const existing = await logsRepo.getByDate(date);
    const stale = existing.filter(isMfpLog);
    replaced += stale.length;
    await Promise.all(stale.map((log) => logsRepo.delete(log.id)));
  }
  await logsRepo.putMany(logs);
  return { days: dates.length, meals: logs.length, replaced };
}
