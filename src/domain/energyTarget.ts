import { isTrainingDay } from '../health/trainingDay';
import { roundKcal } from './macros';

export const TRAINING_DAY_KCAL_BONUS = 250;

export function effectiveKcalTarget(opts: {
  baselineKcal: number;
  date: string;
  adjustForTrainingDay: boolean;
}): number {
  if (opts.adjustForTrainingDay && isTrainingDay(opts.date)) {
    return opts.baselineKcal + TRAINING_DAY_KCAL_BONUS;
  }
  return opts.baselineKcal;
}

export function suggestedKcalTarget(baselineKcal: number, date: string): number {
  return effectiveKcalTarget({
    baselineKcal,
    date,
    adjustForTrainingDay: true,
  });
}

export function formatAdjustmentHint(opts: {
  baselineKcal: number;
  date: string;
  activeKcal: number | undefined;
  trainingLabel: string;
  adjusted: boolean;
}): string {
  const active =
    opts.activeKcal === undefined ? 'ei tuotu' : `${Math.round(opts.activeKcal)} kcal`;
  const suggested = suggestedKcalTarget(opts.baselineKcal, opts.date);
  if (isTrainingDay(opts.date)) {
    const applied = opts.adjusted
      ? `tavoite nyt ${suggested} kcal`
      : `ehdotus ${suggested} kcal (+${TRAINING_DAY_KCAL_BONUS})`;
    return `${opts.trainingLabel} · aktiivinen ${active} · ${applied}`;
  }
  return `${opts.trainingLabel} · aktiivinen ${active} · tavoite ${opts.baselineKcal} kcal`;
}

export function effectiveTargetsKcal<T extends { kcal: number }>(
  targets: T,
  date: string,
  adjustForTrainingDay: boolean,
): T {
  const kcal = roundKcal(
    effectiveKcalTarget({
      baselineKcal: targets.kcal,
      date,
      adjustForTrainingDay,
    }),
  );
  if (kcal === targets.kcal) return targets;
  return { ...targets, kcal };
}
