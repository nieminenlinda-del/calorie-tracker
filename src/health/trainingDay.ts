import { helsinkiWeekday } from '../domain/dates';
import type { TrainingDayCode } from './types';

/** Linda Lift A–D: Mon / Tue / Thu / Fri. Wed + weekend = rest. */
const TRAINING_BY_WEEKDAY: Record<number, TrainingDayCode> = {
  1: 'A',
  2: 'B',
  4: 'C',
  5: 'D',
};

export function getTrainingDayCode(date: string): TrainingDayCode | null {
  return TRAINING_BY_WEEKDAY[helsinkiWeekday(date)] ?? null;
}

export function isTrainingDay(date: string): boolean {
  return getTrainingDayCode(date) !== null;
}

export function trainingDayLabel(date: string): string {
  const code = getTrainingDayCode(date);
  return code ? `treeni ${code}` : 'lepo';
}
