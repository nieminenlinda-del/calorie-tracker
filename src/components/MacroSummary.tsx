import { formatGrams, formatKcal } from '../domain/macros';
import type { DailySummary, UserTargets } from '../domain/types';
import { useLanguage } from '../i18n';

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
  const { t } = useLanguage();
  const over = summary.remaining.kcal < 0;
  return (
    <section className="macro-card" aria-live="polite">
      <div className="kcal-row">
        <div>
          <div className={over ? 'big over' : 'big'}>{formatKcal(summary.kcal)}</div>
          <small>/ {targets.kcal} kcal</small>
        </div>
        <div>
          <small>{t('macros.remaining')}</small>
          <div className="big" style={{ fontSize: 28 }}>
            {formatKcal(summary.remaining.kcal)}
          </div>
        </div>
      </div>
      <div className="bar kcal" aria-hidden>
        <span style={{ width: `${clampPercent(summary.kcal, targets.kcal)}%` }} />
      </div>
      <p className="remain-label">{t('macros.hint')}</p>
      <div className="macro-grid">
        <MacroPill
          kind="protein"
          label={t('macros.p')}
          consumed={summary.protein}
          remaining={summary.remaining.protein}
          target={targets.protein}
        />
        <MacroPill
          kind="carbs"
          label={t('macros.c')}
          consumed={summary.carbs}
          remaining={summary.remaining.carbs}
          target={targets.carbs}
        />
        <MacroPill
          kind="fat"
          label={t('macros.f')}
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
  const { t } = useLanguage();
  return (
    <div className="macro-pill">
      <div className="k">{label}</div>
      <div className="v">{formatGrams(consumed)}</div>
      <div className="r">{t('macros.remainingAbbr', { grams: formatGrams(remaining) })}</div>
      <div className={`bar ${kind}`} aria-hidden>
        <span style={{ width: `${clampPercent(consumed, target)}%` }} />
      </div>
    </div>
  );
}
