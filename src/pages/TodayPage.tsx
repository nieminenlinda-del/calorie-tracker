import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ActiveEnergyCard } from '../components/ActiveEnergyCard';
import { MealSection } from '../components/MealSection';
import { MacroSummary } from '../components/MacroSummary';
import { addDays, formatHelsinkiDate, isToday, previousDay } from '../domain/dates';
import { applyTemplate, copyLogsToDate } from '../domain/logging';
import { MEAL_SLOTS, type MealSlot } from '../domain/types';
import { mealSlotLabel, useLanguage } from '../i18n';
import { logsRepo } from '../repos';
import { useTracker } from '../state/TrackerContext';
import { useToast } from '../state/ToastContext';

export function TodayPage() {
  const { date, setDate, logs, foods, templates, displayTargets, summary, energyHistory, refresh } =
    useTracker();
  const toast = useToast();
  const { t } = useLanguage();

  const bySlot = useMemo(() => {
    const grouped: Record<MealSlot, typeof logs> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const log of logs) grouped[log.meal_slot].push(log);
    return grouped;
  }, [logs]);

  async function copyYesterday() {
    const sourceDate = previousDay(date);
    const source = await logsRepo.getByDate(sourceDate);
    if (source.length === 0) {
      toast(t('toast.yesterdayEmpty'));
      return;
    }
    await copyLogsToDate(source, date);
    await refresh();
    toast(t('toast.yesterdayCopied'));
  }

  async function copyMealFromYesterday(slot: MealSlot) {
    const source = await logsRepo.getByDateAndSlot(previousDay(date), slot);
    if (source.length === 0) {
      toast(t('toast.yesterdayMealEmpty', { meal: mealSlotLabel(slot).toLowerCase() }));
      return;
    }
    await copyLogsToDate(source, date, slot);
    await refresh();
    toast(t('toast.mealCopiedFromYesterday', { meal: mealSlotLabel(slot) }));
  }

  async function applyTrainingDay() {
    const seeded = templates.filter((template) => template.id.startsWith('seed-'));
    for (const template of seeded) {
      await applyTemplate({ template, date });
    }
    await refresh();
    toast(t('toast.trainingTemplatesAdded'));
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <strong>Ravinto</strong>
          <span>{t('app.tagline')}</span>
        </div>
        <Link className="chip" to={`/add?date=${date}&slot=snack&tab=quick`}>
          {t('app.quickAdd')}
        </Link>
      </header>

      <div className="date-nav">
        <button
          type="button"
          className="icon-btn"
          aria-label={t('date.prev')}
          onClick={() => setDate(addDays(date, -1))}
        >
          ‹
        </button>
        <b>
          {formatHelsinkiDate(date)}
          {isToday(date) ? t('date.todaySuffix') : ''}
        </b>
        <button
          type="button"
          className="icon-btn"
          aria-label={t('date.next')}
          onClick={() => setDate(addDays(date, 1))}
        >
          ›
        </button>
      </div>

      <MacroSummary summary={summary} targets={displayTargets} />

      <ActiveEnergyCard history={energyHistory.slice(0, 7)} showImport showHistory />

      <div className="quick-row">
        <button type="button" className="ghost" onClick={() => void copyYesterday()}>
          {t('today.copyYesterday')}
        </button>
        <button type="button" className="primary" onClick={() => void applyTrainingDay()}>
          {t('today.trainingDay')}
        </button>
      </div>

      {MEAL_SLOTS.map((slot) => (
        <div key={slot}>
          <MealSection
            slot={slot}
            date={date}
            logs={bySlot[slot]}
            foods={foods}
            onChange={refresh}
          />
          <button
            type="button"
            className="chip"
            style={{ margin: '-4px 0 12px' }}
            onClick={() => void copyMealFromYesterday(slot)}
          >
            {t('today.copyYesterdayMeal', { meal: mealSlotLabel(slot).toLowerCase() })}
          </button>
        </div>
      ))}
    </div>
  );
}
