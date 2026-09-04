import { useRef, useState } from 'react';
import { formatKcal } from '../domain/macros';
import { formatAdjustmentHint } from '../domain/energyTarget';
import { importHealthFile } from '../health/importHealth';
import { trainingDayLabel } from '../health/trainingDay';
import type { DailyActiveEnergy, IngestProgress } from '../health/types';
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
  const inputRef = useRef<HTMLInputElement>(null);
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

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress({ scanned: 0, inserted: 0, duplicates: 0 });
    try {
      const result = await importHealthFile(file, setProgress);
      await refresh();
      toast(`Health tuotu: ${result.inserted} uutta, ${result.duplicates} duplikaattia, ${result.days} päivää`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Tuonti epäonnistui';
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
            Aktiivinen kulutus
          </div>
          <div className="health-kcal">
            {dailyEnergy ? `${formatKcal(dailyEnergy.active_kcal)} kcal` : '—'}
          </div>
        </div>
        <span className={label.startsWith('treeni') ? 'health-badge train' : 'health-badge rest'}>
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
        Säädä treenipäivän mukaan
      </button>
      <p className="muted" style={{ margin: '8px 0 0' }}>
        Treenipäivät ma/ti/to/pe = A/B/C/D. Kytkin lisää +250 kcal vain treenipäivänä; 2050
        pysyy tallennettuna.
      </p>

      {showImport ? (
        <div className="stack" style={{ marginTop: 14 }}>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.xml,application/zip,text/xml,application/xml"
            hidden
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Tuodaan Health…' : 'Tuo Apple Health -vienti'}
          </button>
          {progress ? (
            <p className="muted">Luetaan… {progress.scanned} näytettä</p>
          ) : null}
          {error ? <p className="health-error">{error}</p> : null}
          <p className="muted">
            export.zip tai export.xml. Sama <code>linda-health</code>-tietokanta kuin Linda
            Liftissä — tuo kerran jommasta kummasta.
          </p>
        </div>
      ) : null}

      {showHistory ? (
        <HealthHistory rows={history.length > 0 ? history : dailyEnergy ? [dailyEnergy] : []} />
      ) : null}
    </section>
  );
}

function HealthHistory({ rows }: { rows: DailyActiveEnergy[] }) {
  if (rows.length === 0) {
    return <p className="muted" style={{ marginTop: 14 }}>Ei Health-historiaa vielä.</p>;
  }
  return (
    <table className="health-history">
      <thead>
        <tr>
          <th>Päivä</th>
          <th>Aktiivinen</th>
          <th>Tyyppi</th>
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
