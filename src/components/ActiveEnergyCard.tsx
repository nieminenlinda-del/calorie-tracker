import { useRef, useState } from 'react';
import { formatKcal } from '../domain/macros';
import { formatAdjustmentHint } from '../domain/energyTarget';
import { importHealthFile } from '../health/importHealth';
import { ingestShortcutFile, isShortcutJsonFile } from '../health/importShortcutJson';
import { ingestMfpNutritionCsv } from '../health/mfp';
import { isTrainingDay, trainingDayLabel } from '../health/trainingDay';
import type { DailyActiveEnergy, IngestProgress } from '../health/types';
import { useLanguage } from '../i18n';
import { targetsRepo } from '../repos';
import { useTracker } from '../state/TrackerContext';
import { useToast } from '../state/ToastContext';

export function ActiveEnergyCard({
  history,
  showImport = false,
  showHistory = false,
}: {
  history: DailyActiveEnergy[];
  showImport?: boolean;
  showHistory?: boolean;
}) {
  const { date, targets, dailyEnergy, refresh } = useTracker();
  const toast = useToast();
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const mfpInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<IngestProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = trainingDayLabel(date);
  const hint = formatAdjustmentHint({
    baselineKcal: targets.kcal,
    date,
    activeKcal: dailyEnergy?.active_kcal,
    trainingLabel: label,
    adjusted: targets.adjust_for_training_day,
  });

  async function onMfpFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const result = await ingestMfpNutritionCsv(text);
      if (result.meals === 0) {
        throw new Error(t('health.mfpEmpty'));
      }
      await refresh();
      toast(t('health.mfpImported', { meals: result.meals, days: result.days }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('health.importFailed');
      setError(message);
      toast(message);
    } finally {
      setBusy(false);
      if (mfpInputRef.current) mfpInputRef.current.value = '';
    }
  }

  async function onShortcutFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ingestShortcutFile(file);
      await refresh();
      toast(t('health.shortcutsImported', { days: result.days }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('health.importFailed');
      setError(message);
      toast(message);
    } finally {
      setBusy(false);
      if (shortcutInputRef.current) shortcutInputRef.current.value = '';
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (isShortcutJsonFile(file)) {
      await onShortcutFile(file);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ scanned: 0, inserted: 0, duplicates: 0 });
    try {
      const result = await importHealthFile(file, setProgress);
      await refresh();
      toast(
        t('health.healthImported', {
          inserted: result.inserted,
          duplicates: result.duplicates,
          days: result.days,
        }),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('health.importFailed');
      setError(message);
      toast(message);
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section className="health-card">
      <div className="health-head">
        <div>
          <div className="section-label" style={{ margin: 0 }}>
            {t('health.activeBurn')}
          </div>
          <div className="health-kcal">
            {dailyEnergy ? `${formatKcal(dailyEnergy.active_kcal)} kcal` : '—'}
          </div>
        </div>
        <span className={isTrainingDay(date) ? 'health-badge train' : 'health-badge rest'}>
          {label}
        </span>
      </div>
      <p className="health-hint">{hint}</p>

      <button
        type="button"
        className={targets.adjust_for_training_day ? 'flag on' : 'flag'}
        onClick={async () => {
          await targetsRepo.save({
            adjust_for_training_day: !targets.adjust_for_training_day,
          });
          await refresh();
        }}
      >
        {t('health.adjustTraining')}
      </button>
      <p className="muted" style={{ margin: '8px 0 0' }}>
        {t('health.adjustHint')}
      </p>

      {showImport ? (
        <div className="stack" style={{ marginTop: 14 }}>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.xml,.json,application/zip,text/xml,application/xml,application/json"
            hidden
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? t('health.importing') : t('health.importHealth')}
          </button>
          <input
            ref={shortcutInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => void onShortcutFile(event.target.files?.[0])}
          />
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => shortcutInputRef.current?.click()}
          >
            {busy ? t('health.importing') : t('health.importShortcuts')}
          </button>
          <input
            ref={mfpInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => void onMfpFile(event.target.files?.[0])}
          />
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => mfpInputRef.current?.click()}
          >
            {t('health.importMfp')}
          </button>
          {progress ? (
            <p className="muted">{t('health.reading', { count: progress.scanned })}</p>
          ) : null}
          {error ? <p className="health-error">{error}</p> : null}
          <p className="muted">
            {t('health.shortcutsHint', {
              file: 'linda-health-shortcut.json',
              db: 'linda-health',
            })}
          </p>
          <p className="muted">{t('health.mfpHint', { file: 'nutrition.csv' })}</p>
        </div>
      ) : null}

      {showHistory ? (
        <HealthHistory rows={history.length > 0 ? history : dailyEnergy ? [dailyEnergy] : []} />
      ) : null}
    </section>
  );
}

function HealthHistory({ rows }: { rows: DailyActiveEnergy[] }) {
  const { t } = useLanguage();
  if (rows.length === 0) {
    return (
      <p className="muted" style={{ marginTop: 14 }}>
        {t('health.noHistory')}
      </p>
    );
  }
  return (
    <table className="health-history">
      <thead>
        <tr>
          <th>{t('health.colDay')}</th>
          <th>{t('health.colActive')}</th>
          <th>{t('health.colType')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.date}>
            <td>{row.date}</td>
            <td>{formatKcal(row.active_kcal)} kcal</td>
            <td>{trainingDayLabel(row.date)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
