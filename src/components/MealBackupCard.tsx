import { useEffect, useRef, useState } from 'react';
import {
  downloadJson,
  exportMealBackup,
  importMealBackup,
  mealBackupFilename,
  parseMealBackupJson,
  type ImportMode,
} from '../backup/mealBackup';
import { helsinkiToday } from '../domain/dates';
import { useLanguage } from '../i18n';
import { logsRepo } from '../repos';
import { useTracker } from '../state/TrackerContext';
import { useToast } from '../state/ToastContext';

export function MealBackupCard() {
  const { date, logs, refresh } = useTracker();
  const toast = useToast();
  const { t } = useLanguage();
  const mergeRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalLogs, setTotalLogs] = useState(0);

  useEffect(() => {
    void logsRepo.count().then(setTotalLogs);
  }, [logs]);

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      const backup = await exportMealBackup();
      downloadJson(mealBackupFilename(helsinkiToday()), backup);
      toast(t('toast.backupExported'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('health.importFailed');
      setError(message);
      toast(message);
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(file: File | undefined, mode: ImportMode) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const backup = parseMealBackupJson(await file.text());
      if (mode === 'replace') {
        const ok = window.confirm(t('settings.importReplaceConfirm'));
        if (!ok) return;
      }
      const result = await importMealBackup(backup, mode);
      await refresh();
      setTotalLogs(await logsRepo.count());
      toast(
        t(mode === 'replace' ? 'toast.backupReplaced' : 'toast.backupImported', {
          logs: result.food_logs,
          foods: result.foods,
        }),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('health.importFailed');
      setError(message);
      toast(message);
    } finally {
      setBusy(false);
      if (mergeRef.current) mergeRef.current.value = '';
      if (replaceRef.current) replaceRef.current.value = '';
    }
  }

  return (
    <section className="health-card">
      <div className="stack">
        <button type="button" className="primary" disabled={busy} onClick={() => void onExport()}>
          {t('settings.exportBackup')}
        </button>
        <input
          ref={mergeRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => void onImportFile(event.target.files?.[0], 'merge')}
        />
        <button
          type="button"
          className="ghost"
          disabled={busy}
          onClick={() => mergeRef.current?.click()}
        >
          {busy ? t('health.importing') : t('settings.importMerge')}
        </button>
        <input
          ref={replaceRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => void onImportFile(event.target.files?.[0], 'replace')}
        />
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={() => replaceRef.current?.click()}
        >
          {t('settings.importReplace')}
        </button>
      </div>

      {error ? <p className="health-error">{error}</p> : null}

      <p className="notice">{t('settings.backupSafariTip')}</p>
      <p className="notice">{t('settings.backupIosPwaTip')}</p>
      <p className="debug-meta">
        {t('settings.backupDebug', {
          dateCount: logs.length,
          date,
          total: totalLogs,
        })}
      </p>
      <p className="muted" style={{ margin: '4px 0 0' }}>
        {t('settings.backupDebugHint')}
      </p>
    </section>
  );
}
