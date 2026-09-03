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
import type {
  DailySummary,
  Food,
  FoodLog,
  MealTemplate,
  UserTargets,
} from '../domain/types';
import { foodsRepo, logsRepo, targetsRepo, templatesRepo } from '../repos';

interface TrackerValue {
  date: string;
  setDate: (date: string) => void;
  foods: Food[];
  visibleFoods: Food[];
  logs: FoodLog[];
  templates: MealTemplate[];
  targets: UserTargets;
  summary: DailySummary;
  refresh: () => Promise<void>;
}

const TrackerContext = createContext<TrackerValue | null>(null);

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState(helsinkiToday);
  const [foods, setFoods] = useState<Food[]>([]);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [targets, setTargets] = useState<UserTargets | null>(null);

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
  }, [date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<TrackerValue | null>(() => {
    if (!targets) return null;
    return {
      date,
      setDate,
      foods,
      visibleFoods: filterCatalog(foods, targets.diet_flags),
      logs,
      templates,
      targets,
      summary: computeDailySummary(date, logs, targets),
      refresh,
    };
  }, [date, foods, logs, refresh, targets, templates]);

  if (!value) {
    return (
      <div className="loading">
        <p>Ladataan…</p>
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
