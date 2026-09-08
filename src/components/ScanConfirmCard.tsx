import { useMemo, useState } from 'react';
import { AmountStepper } from './AmountStepper';
import { isQuickFood } from '../domain/logging';
import {
  formatGrams,
  formatKcal,
  macrosFromCustom,
  macrosPer100g,
  roundKcal,
  roundMacro,
  scaleFoodMacros,
} from '../domain/macros';
import type { Food, Macros } from '../domain/types';
import { useLanguage } from '../i18n';
import { foodDisplayName } from '../lib/labels';

export function ScanConfirmCard({
  food,
  source,
  missingNutrition,
  onBack,
  onQuickAdd,
  onConfirm,
}: {
  food: Food;
  source: 'local' | 'off';
  missingNutrition: boolean;
  onBack: () => void;
  onQuickAdd: () => void;
  onConfirm: (values: {
    name: string;
    amount: number;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => Promise<void>;
}) {
  const { t } = useLanguage();
  const editable = source === 'off' || isQuickFood(food);
  const [name, setName] = useState(foodDisplayName(food));
  const [amount, setAmount] = useState(food.default_serving);
  const [perBasis, setPerBasis] = useState<Macros>({
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  });

  const scaledFood = useMemo(
    () => ({ ...food, ...perBasis }),
    [food, perBasis],
  );
  const preview = scaleFoodMacros(scaledFood, amount);

  function setPreviewMacro(key: keyof Macros, value: number) {
    const next: Macros = { ...preview, [key]: key === 'kcal' ? roundKcal(value) : roundMacro(value) };
    if (food.basis === 'per_piece') {
      setPerBasis(macrosFromCustom(next));
      return;
    }
    setPerBasis(macrosPer100g(amount > 0 ? amount : 100, next));
  }

  return (
    <div className="template-card">
      <h2 className="h1">{editable ? t('scan.title') : foodDisplayName(food)}</h2>
      <p className="lede">
        {source === 'off' ? t('scan.sourceOff') : t('scan.sourceLocal')}
        {food.brand ? ` · ${food.brand}` : ''}
        {food.barcode ? ` · ${food.barcode}` : ''}
      </p>
      <p className="lede">{missingNutrition ? t('scan.missingNutrition') : t('scan.confirmHint')}</p>
      {editable ? (
        <label className="field">
          <span>{t('meal.name')}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
      ) : (
        <p className="lede">
          {food.name_fi !== foodDisplayName(food) ? `${food.name_fi}` : food.name_en}
          {food.basis === 'per_piece'
            ? ` · ${t('add.perPiece')}`
            : food.basis === 'per_ml'
              ? ` · ${t('add.per100ml')}`
              : ` · ${t('add.per100g')}`}
        </p>
      )}
      <AmountStepper value={amount} unit={food.serving_unit} onChange={setAmount} />
      {editable ? (
        <>
          <p className="muted">{t('scan.per100gHint')}</p>
          <label className="field">
            <span>kcal</span>
            <input
              inputMode="decimal"
              value={preview.kcal}
              onChange={(event) => setPreviewMacro('kcal', Number(event.target.value) || 0)}
            />
          </label>
          <div className="macro-grid" style={{ marginBottom: 12 }}>
            <MacroField
              label={t('macros.p')}
              value={preview.protein}
              onChange={(value) => setPreviewMacro('protein', value)}
            />
            <MacroField
              label={t('macros.c')}
              value={preview.carbs}
              onChange={(value) => setPreviewMacro('carbs', value)}
            />
            <MacroField
              label={t('macros.f')}
              value={preview.fat}
              onChange={(value) => setPreviewMacro('fat', value)}
            />
          </div>
        </>
      ) : (
        <div className="preview">
          <div>
            <b>{formatKcal(preview.kcal)}</b>
            <span>kcal</span>
          </div>
          <div>
            <b>{formatGrams(preview.protein)}</b>
            <span>{t('macros.p')}</span>
          </div>
          <div>
            <b>{formatGrams(preview.carbs)}</b>
            <span>{t('macros.c')}</span>
          </div>
          <div>
            <b>{formatGrams(preview.fat)}</b>
            <span>{t('macros.f')}</span>
          </div>
        </div>
      )}
      <div className="row-btns">
        <button type="button" className="ghost" onClick={onBack}>
          {t('add.back')}
        </button>
        <button
          type="button"
          className="primary"
          onClick={() =>
            void onConfirm({
              name,
              amount,
              ...preview,
            })
          }
        >
          {t('add.add')}
        </button>
      </div>
      {missingNutrition ? (
        <button
          type="button"
          className="ghost"
          style={{ width: '100%', marginTop: 8 }}
          onClick={onQuickAdd}
        >
          {t('scan.quickAddInstead')}
        </button>
      ) : null}
    </div>
  );
}

function MacroField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}
