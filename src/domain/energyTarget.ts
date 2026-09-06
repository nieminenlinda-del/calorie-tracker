import { t } from '../i18n/locale';
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
    opts.activeKcal === undefined
      ? t('health.notImported')
      : `${Math.round(opts.activeKcal)} kcal`;
  const suggested = suggestedKcalTarget(opts.baselineKcal, opts.date);
  if (isTrainingDay(opts.date)) {
    const applied = opts.adjusted
      ? t('health.targetNow', { kcal: suggested })
      : t('health.suggestion', { kcal: suggested, bonus: TRAINING_DAY_KCAL_BONUS });
    return t('health.hint', { label: opts.trainingLabel, active, applied });
  }
  return t('health.hint', {
    label: opts.trainingLabel,
    active,
    applied: t('health.target', { kcal: opts.baselineKcal }),
  });
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
