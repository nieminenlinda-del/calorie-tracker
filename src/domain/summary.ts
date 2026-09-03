import { remainingMacros, sumMacros } from './macros';
import type { DailySummary, FoodLog, UserTargets } from './types';

export function computeDailySummary(
  date: string,
  logs: FoodLog[],
  targets: UserTargets,
): DailySummary {
  const consumed = sumMacros(logs);
  return {
    date,
    ...consumed,
    remaining: remainingMacros(consumed, targets),
  };
}
