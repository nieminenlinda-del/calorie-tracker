import { unitLabel } from '../domain/macros';
import { useLanguage } from '../i18n';

export function AmountStepper({
  value,
  unit,
  onChange,
}: {
  value: number;
  unit: 'g' | 'piece' | 'ml';
  onChange: (value: number) => void;
}) {
  const { t } = useLanguage();
  const step = unit === 'piece' ? 1 : unit === 'ml' || value < 20 ? 1 : 5;
  const min = unit === 'piece' ? 1 : 1;

  return (
    <div>
      <div className="stepper">
        <button
          type="button"
          aria-label={t('amount.decrease')}
          onClick={() => onChange(Math.max(min, roundAmount(value - step, unit)))}
        >
          −
        </button>
        <input
          inputMode="decimal"
          value={String(value)}
          aria-label={t('amount.label', { unit: unitLabel(unit) })}
          onChange={(event) => {
            const next = Number(event.target.value.replace(',', '.'));
            if (Number.isFinite(next) && next >= 0) onChange(next);
            if (event.target.value === '') onChange(0);
          }}
        />
        <button
          type="button"
          aria-label={t('amount.increase')}
          onClick={() => onChange(roundAmount(value + step, unit))}
        >
          +
        </button>
      </div>
      <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
        {unitLabel(unit)}
      </p>
    </div>
  );
}

function roundAmount(value: number, unit: 'g' | 'piece' | 'ml'): number {
  if (unit === 'piece') return Math.max(1, Math.round(value));
  return Math.max(0, Math.round(value * 10) / 10);
}
