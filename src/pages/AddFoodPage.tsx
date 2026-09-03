import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AmountStepper } from '../components/AmountStepper';
import { searchFoods } from '../domain/diet';
import { previousDay } from '../domain/dates';
import { applyTemplate, copyLogsToDate, logCatalogFood, logCustomFood } from '../domain/logging';
import {
  macrosFromCustom,
  scaleFoodMacros,
  formatKcal,
  formatGrams,
  unitLabel,
} from '../domain/macros';
import { MEAL_SLOT_LABELS, type MealSlot } from '../domain/types';
import { foodLabel } from '../lib/labels';
import { logsRepo } from '../repos';
import { useTracker } from '../state/TrackerContext';
import { useToast } from '../state/ToastContext';
import type { Food } from '../domain/types';

type Tab = 'catalog' | 'quick' | 'templates';

export function AddFoodPage() {
  const { date: contextDate, visibleFoods, templates, logs, refresh } = useTracker();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const date = params.get('date') ?? contextDate;
  const slot = (params.get('slot') as MealSlot | null) ?? 'breakfast';
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'quick' ? 'quick' : 'catalog');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState(50);

  const selected = visibleFoods.find((food) => food.id === selectedId) ?? null;
  const filtered = useMemo(() => searchFoods(visibleFoods, query), [visibleFoods, query]);
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const log of [...logs].reverse()) {
      if (!log.food_id || seen.has(log.food_id)) continue;
      seen.add(log.food_id);
      ids.push(log.food_id);
    }
    return visibleFoods.filter((food) => ids.includes(food.id)).slice(0, 6);
  }, [logs, visibleFoods]);

  const preview = selected ? scaleFoodMacros(selected, amount) : null;
  const slotTemplates = templates.filter((template) => template.meal_slot === slot);

  return (
    <div className="page page-add">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/')} aria-label="Takaisin">
          ‹
        </button>
        <div className="brand">
          <strong>Lisää ruokaa</strong>
          <span>{MEAL_SLOT_LABELS[slot]}</span>
        </div>
        <Link className="chip" to="/">
          Valmis
        </Link>
      </header>

      <div className="tabs">
        <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')}>
          Valikoima
        </TabButton>
        <TabButton active={tab === 'quick'} onClick={() => setTab('quick')}>
          Pika
        </TabButton>
        <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>
          Mallit
        </TabButton>
      </div>

      {tab === 'catalog' ? (
        selected ? (
          <div>
            <h2 className="h1">{selected.name_fi}</h2>
            <p className="lede">
              {selected.name_en}
              {selected.brand ? ` · ${selected.brand}` : ''} · {selected.kcal} kcal /{' '}
              {selected.basis === 'per_piece' ? 'kpl' : '100 g'}
            </p>
            <AmountStepper value={amount} unit={selected.serving_unit} onChange={setAmount} />
            {preview ? (
              <div className="preview">
                <div>
                  <b>{formatKcal(preview.kcal)}</b>
                  <span>kcal</span>
                </div>
                <div>
                  <b>{formatGrams(preview.protein)}</b>
                  <span>P</span>
                </div>
                <div>
                  <b>{formatGrams(preview.carbs)}</b>
                  <span>H</span>
                </div>
                <div>
                  <b>{formatGrams(preview.fat)}</b>
                  <span>R</span>
                </div>
              </div>
            ) : null}
            <div className="row-btns">
              <button type="button" className="ghost" onClick={() => setSelectedId(null)}>
                Takaisin
              </button>
              <button
                type="button"
                className="primary"
                onClick={async () => {
                  await logCatalogFood({ date, meal_slot: slot, food: selected, amount });
                  await refresh();
                  toast(`${selected.name_fi} lisätty`);
                  navigate('/');
                }}
              >
                Lisää
              </button>
            </div>
          </div>
        ) : (
          <div>
            <input
              className="search"
              placeholder="Hae suomeksi tai englanniksi"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query === '' && recent.length > 0 ? (
              <>
                <div className="section-label">Viimeksi</div>
                {recent.map((food) => (
                  <FoodButton
                    key={`recent-${food.id}`}
                    food={food}
                    onPick={() => {
                      setSelectedId(food.id);
                      setAmount(food.default_serving);
                    }}
                  />
                ))}
              </>
            ) : null}
            <div className="section-label">Perusruoat</div>
            {filtered.map((food) => (
              <FoodButton
                key={food.id}
                food={food}
                onPick={() => {
                  setSelectedId(food.id);
                  setAmount(food.default_serving);
                }}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === 'quick' ? (
        <QuickAddForm
          onSubmit={async (values) => {
            await logCustomFood({
              date,
              meal_slot: slot,
              name: values.name,
              amount: values.amount,
              unit: 'g',
              ...macrosFromCustom(values),
            });
            await refresh();
            toast('Pikalisäys tallennettu');
            navigate('/');
          }}
        />
      ) : null}

      {tab === 'templates' ? (
        <div>
          {slotTemplates.length === 0 ? (
            <p className="lede">Ei malleja tälle aterialle vielä.</p>
          ) : (
            slotTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="food-row"
                onClick={async () => {
                  await applyTemplate({ template, date, meal_slot: slot });
                  await refresh();
                  toast(`${template.name} lisätty`);
                  navigate('/');
                }}
              >
                <div>
                  <div className="name">{template.name}</div>
                  <div className="sub">{template.items.length} riviä</div>
                </div>
                <b>Käytä</b>
              </button>
            ))
          )}
          <CopyMealButton
            date={date}
            slot={slot}
            onCopied={async () => {
              await refresh();
              toast('Ateria kopioitu');
              navigate('/');
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? 'chip accent' : 'chip'} onClick={onClick}>
      {children}
    </button>
  );
}

function FoodButton({ food, onPick }: { food: Food; onPick: () => void }) {
  return (
    <button type="button" className="food-row" onClick={onPick}>
      <div>
        <div className="name">{food.name_fi}</div>
        <div className="sub">
          {foodLabel(food)} · {food.kcal} kcal / {food.basis === 'per_piece' ? 'kpl' : '100 g'} · oletus{' '}
          {food.default_serving} {unitLabel(food.serving_unit)}
        </div>
      </div>
      <b>+</b>
    </button>
  );
}

function QuickAddForm({
  onSubmit,
}: {
  onSubmit: (values: {
    name: string;
    amount: number;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(100);
  const [kcal, setKcal] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        void onSubmit({ name, amount, kcal, protein, carbs, fat });
      }}
    >
      <label className="field">
        <span>Nimi</span>
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="field">
        <span>Määrä (g)</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value) || 0)}
        />
      </label>
      <label className="field">
        <span>kcal</span>
        <input
          inputMode="decimal"
          value={kcal}
          onChange={(event) => setKcal(Number(event.target.value) || 0)}
        />
      </label>
      <div className="macro-grid" style={{ marginBottom: 12 }}>
        <Num label="P" value={protein} onChange={setProtein} />
        <Num label="H" value={carbs} onChange={setCarbs} />
        <Num label="R" value={fat} onChange={setFat} />
      </div>
      <button type="submit" className="primary" style={{ width: '100%' }}>
        Tallenna pikalisäys
      </button>
    </form>
  );
}

function Num({
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

function CopyMealButton({
  date,
  slot,
  onCopied,
}: {
  date: string;
  slot: MealSlot;
  onCopied: () => Promise<void>;
}) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="ghost"
      style={{ width: '100%', marginTop: 8 }}
      onClick={async () => {
        const source = await logsRepo.getByDateAndSlot(previousDay(date), slot);
        if (source.length === 0) {
          toast('Eilinen ateria on tyhjä');
          return;
        }
        await copyLogsToDate(source, date, slot);
        await onCopied();
      }}
    >
      Kopioi eilisen {MEAL_SLOT_LABELS[slot].toLowerCase()}
    </button>
  );
}
