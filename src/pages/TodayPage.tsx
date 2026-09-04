import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ActiveEnergyCard } from '../components/ActiveEnergyCard';
import { MealSection } from '../components/MealSection';
import { MacroSummary } from '../components/MacroSummary';
import { addDays, formatHelsinkiDate, isToday, previousDay } from '../domain/dates';
import { applyTemplate, copyLogsToDate } from '../domain/logging';
import { MEAL_SLOTS, MEAL_SLOT_LABELS, type MealSlot } from '../domain/types';
import { logsRepo } from '../repos';
import { useTracker } from '../state/TrackerContext';
import { useToast } from '../state/ToastContext';

export function TodayPage() {
  const { date, setDate, logs, foods, templates, displayTargets, summary, energyHistory, refresh } =
    useTracker();
  const toast = useToast();

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
      toast('Eilinen on tyhjä');
      return;
    }
    await copyLogsToDate(source, date);
    await refresh();
    toast('Eilinen kopioitu');
  }

  async function copyMealFromYesterday(slot: MealSlot) {
    const source = await logsRepo.getByDateAndSlot(previousDay(date), slot);
    if (source.length === 0) {
      toast(`Eilisen ${MEAL_SLOT_LABELS[slot].toLowerCase()} on tyhjä`);
      return;
    }
    await copyLogsToDate(source, date, slot);
    await refresh();
    toast(`${MEAL_SLOT_LABELS[slot]} kopioitu eilisestä`);
  }

  async function applyTrainingDay() {
    const seeded = templates.filter((template) => template.id.startsWith('seed-'));
    for (const template of seeded) {
      await applyTemplate({ template, date });
    }
    await refresh();
    toast('Treenipäivän mallit lisätty');
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <strong>Ravinto</strong>
          <span>Lindan päivän ruoka</span>
        </div>
        <Link className="chip" to={`/add?date=${date}&slot=snack&tab=quick`}>
          Pikalisäys
        </Link>
      </header>

      <div className="date-nav">
        <button
          type="button"
          className="icon-btn"
          aria-label="Edellinen päivä"
          onClick={() => setDate(addDays(date, -1))}
        >
          ‹
        </button>
        <b>
          {formatHelsinkiDate(date)}
          {isToday(date) ? ' · tänään' : ''}
        </b>
        <button
          type="button"
          className="icon-btn"
          aria-label="Seuraava päivä"
          onClick={() => setDate(addDays(date, 1))}
        >
          ›
        </button>
      </div>

      <MacroSummary summary={summary} targets={displayTargets} />

      <ActiveEnergyCard history={energyHistory.slice(0, 7)} showImport showHistory />

      <div className="quick-row">
        <button type="button" className="ghost" onClick={() => void copyYesterday()}>
          Kopioi eilinen
        </button>
        <button type="button" className="primary" onClick={() => void applyTrainingDay()}>
          Treenipäivä
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
            Kopioi eilisen {MEAL_SLOT_LABELS[slot].toLowerCase()}
          </button>
        </div>
      ))}
    </div>
  );
}
