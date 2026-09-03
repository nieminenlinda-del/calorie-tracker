import { formatGrams, formatKcal } from '../domain/macros';
import type { DailySummary, UserTargets } from '../domain/types';

function clampPercent(consumed: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((consumed / target) * 100));
}

export function MacroSummary({
  summary,
  targets,
}: {
  summary: DailySummary;
  targets: UserTargets;
}) {
  const over = summary.remaining.kcal < 0;
  return (
    <section className="macro-card" aria-live="polite">
      <div className="kcal-row">
        <div>
          <div className={over ? 'big over' : 'big'}>{formatKcal(summary.kcal)}</div>
          <small>/ {targets.kcal} kcal</small>
        </div>
        <div>
          <small>Jäljellä</small>
          <div className="big" style={{ fontSize: 28 }}>
            {formatKcal(summary.remaining.kcal)}
          </div>
        </div>
      </div>
      <div className="bar kcal" aria-hidden>
        <span style={{ width: `${clampPercent(summary.kcal, targets.kcal)}%` }} />
      </div>
      <p className="remain-label">
        Proteiini, hiilari ja rasva päivittyvät heti kun lisäät ruoan.
      </p>
      <div className="macro-grid">
        <MacroPill
          kind="protein"
          label="P"
          consumed={summary.protein}
          remaining={summary.remaining.protein}
          target={targets.protein}
        />
        <MacroPill
          kind="carbs"
          label="H"
          consumed={summary.carbs}
          remaining={summary.remaining.carbs}
          target={targets.carbs}
        />
        <MacroPill
          kind="fat"
          label="R"
          consumed={summary.fat}
          remaining={summary.remaining.fat}
          target={targets.fat}
        />
      </div>
    </section>
  );
}

function MacroPill({
  kind,
  label,
  consumed,
  remaining,
  target,
}: {
  kind: 'protein' | 'carbs' | 'fat';
  label: string;
  consumed: number;
  remaining: number;
  target: number;
}) {
  return (
    <div className="macro-pill">
      <div className="k">{label}</div>
      <div className="v">{formatGrams(consumed)}</div>
      <div className="r">{formatGrams(remaining)} jälj.</div>
      <div className={`bar ${kind}`} aria-hidden>
        <span style={{ width: `${clampPercent(consumed, target)}%` }} />
      </div>
    </div>
  );
}
