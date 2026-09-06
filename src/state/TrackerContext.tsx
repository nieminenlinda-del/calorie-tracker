import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { computeDailySummary } from '../domain/summary';
import { filterCatalog } from '../domain/diet';
import { helsinkiToday } from '../domain/dates';
import { effectiveTargetsKcal } from '../domain/energyTarget';
import type {
  DailySummary,
  Food,
  FoodLog,
  MealTemplate,
  UserTargets,
} from '../domain/types';
import type { DailyActiveEnergy } from '../health/types';
import { t } from '../i18n/locale';
import { foodsRepo, logsRepo, targetsRepo, templatesRepo } from '../repos';
import { dailyActiveEnergyRepo, getDailyActiveEnergy } from '../repos/healthRepo';

interface TrackerValue {
  date: string;
  setDate: (date: string) => void;
  foods: Food[];
  visibleFoods: Food[];
  logs: FoodLog[];
  templates: MealTemplate[];
  targets: UserTargets;
  displayTargets: UserTargets;
  summary: DailySummary;
  dailyEnergy: DailyActiveEnergy | undefined;
  energyHistory: DailyActiveEnergy[];
  refresh: () => Promise<void>;
}

const TrackerContext = createContext<TrackerValue | null>(null);

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState(helsinkiToday);
  const [foods, setFoods] = useState<Food[]>([]);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [targets, setTargets] = useState<UserTargets | null>(null);
  const [dailyEnergy, setDailyEnergy] = useState<DailyActiveEnergy | undefined>();
  const [energyHistory, setEnergyHistory] = useState<DailyActiveEnergy[]>([]);

  const refresh = useCallback(async () => {
    const [nextFoods, nextLogs, nextTemplates, nextTargets] = await Promise.all([
      foodsRepo.getAll(),
      logsRepo.getByDate(date),
      templatesRepo.getAll(),
      targetsRepo.get(),
    ]);
    setFoods(nextFoods);
    setLogs(nextLogs);
    setTemplates(nextTemplates);
    setTargets(nextTargets);

    try {
      const [energy, history] = await Promise.all([
        getDailyActiveEnergy(date),
        dailyActiveEnergyRepo.listRecent(14),
      ]);
      setDailyEnergy(energy);
      setEnergyHistory(history);
    } catch (err) {
      console.error('health read failed', err);
      setDailyEnergy(undefined);
      setEnergyHistory([]);
    }
  }, [date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<TrackerValue | null>(() => {
    if (!targets) return null;
    const displayTargets = effectiveTargetsKcal(
      targets,
      date,
      targets.adjust_for_training_day,
    );
    return {
      date,
      setDate,
      foods,
      visibleFoods: filterCatalog(foods, targets.diet_flags),
      logs,
      templates,
      targets,
      displayTargets,
      summary: computeDailySummary(date, logs, displayTargets),
      dailyEnergy,
      energyHistory,
      refresh,
    };
  }, [dailyEnergy, date, energyHistory, foods, logs, refresh, targets, templates]);

  if (!value) {
    return (
      <div className="loading">
        <p>{t('app.loading')}</p>
      </div>
    );
  }

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTracker(): TrackerValue {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used within TrackerProvider');
  return ctx;
}
