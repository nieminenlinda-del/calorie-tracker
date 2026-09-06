import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sumMacros, formatKcal, formatGrams } from '../domain/macros';
import type { Food, FoodLog, MealSlot } from '../domain/types';
import { mealSlotLabel, useLanguage } from '../i18n';
import { amountLabel, logLabel } from '../lib/labels';
import { logsRepo } from '../repos';
import { saveMealAsTemplate, updateLogAmount } from '../domain/logging';
import { AmountStepper } from './AmountStepper';
import { Sheet } from './Sheet';
import { useToast } from '../state/ToastContext';

export function MealSection({
  slot,
  date,
  logs,
  foods,
  onChange,
}: {
  slot: MealSlot;
  date: string;
  logs: FoodLog[];
  foods: Food[];
  onChange: () => Promise<void>;
}) {
  const toast = useToast();
  const { t } = useLanguage();
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const total = useMemo(() => sumMacros(logs), [logs]);

  return (
    <section className="meal">
      <div className="meal-head">
        <div>
          <h2>{mealSlotLabel(slot)}</h2>
          <div className="meal-kcal">
            {logs.length === 0
              ? t('meal.empty')
              : `${formatKcal(total.kcal)} kcal · ${t('macros.p')} ${formatGrams(total.protein)}`}
          </div>
        </div>
        <div className="meal-actions">
          <Link className="chip accent" to={`/add?date=${date}&slot=${slot}`}>
            {t('meal.add')}
          </Link>
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="empty-meal">{t('meal.emptyHint')}</p>
      ) : (
        logs.map((log) => (
          <button key={log.id} type="button" className="log-row" onClick={() => setEditing(log)}>
            <div>
              <div className="name">{logLabel(log, foods)}</div>
              <div className="meta">{amountLabel(log.amount, log.unit)}</div>
            </div>
            <div className="macros">
              {formatKcal(log.kcal)} kcal
              <br />
              {t('macros.p')} {formatGrams(log.protein)} · {t('macros.c')} {formatGrams(log.carbs)} ·{' '}
              {t('macros.f')} {formatGrams(log.fat)}
            </div>
          </button>
        ))
      )}

      {logs.length > 0 ? (
        <div className="row-btns" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setTemplateName(mealSlotLabel(slot));
              setSaving(true);
            }}
          >
            {t('meal.saveMeal')}
          </button>
        </div>
      ) : null}

      {editing ? (
        <EditLogSheet
          log={editing}
          food={foods.find((food) => food.id === editing.food_id)}
          onClose={() => setEditing(null)}
          onSave={async (amount) => {
            await updateLogAmount(
              editing,
              amount,
              foods.find((food) => food.id === editing.food_id),
            );
            await onChange();
            setEditing(null);
            toast(t('toast.updated'));
          }}
          onDelete={async () => {
            await logsRepo.delete(editing.id);
            await onChange();
            setEditing(null);
            toast(t('toast.deleted'));
          }}
        />
      ) : null}

      {saving ? (
        <Sheet title={t('meal.saveMeal')} onClose={() => setSaving(false)}>
          <label className="field">
            <span>{t('meal.name')}</span>
            <input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary"
            style={{ width: '100%' }}
            onClick={async () => {
              if (!templateName.trim()) return;
              if (!logs.some((log) => log.food_id)) {
                toast(t('toast.templateNeedsCatalog'));
                return;
              }
              await saveMealAsTemplate({
                name: templateName,
                meal_slot: slot,
                logs,
              });
              await onChange();
              setSaving(false);
              toast(t('toast.savedAsTemplate'));
            }}
          >
            {t('meal.save')}
          </button>
        </Sheet>
      ) : null}
    </section>
  );
}

function EditLogSheet({
  log,
  food,
  onClose,
  onSave,
  onDelete,
}: {
  log: FoodLog;
  food?: Food;
  onClose: () => void;
  onSave: (amount: number) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState(log.amount);
  return (
    <Sheet title={log.custom_name ?? food?.name_fi ?? t('meal.entry')} onClose={onClose}>
      <AmountStepper value={amount} unit={log.unit} onChange={setAmount} />
      <div className="row-btns" style={{ marginTop: 16 }}>
        <button type="button" className="danger" onClick={() => void onDelete()}>
          {t('meal.delete')}
        </button>
        <button type="button" className="primary" onClick={() => void onSave(amount)}>
          {t('meal.save')}
        </button>
      </div>
    </Sheet>
  );
}
