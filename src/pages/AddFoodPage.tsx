import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { lookupBarcode } from '../barcode/lookup';
import { AmountStepper } from '../components/AmountStepper';
import { BarcodeScannerOverlay } from '../components/BarcodeScannerOverlay';
import { ScanConfirmCard } from '../components/ScanConfirmCard';
import { searchFoods } from '../domain/diet';
import { previousDay } from '../domain/dates';
import {
  applyTemplate,
  copyLogsToDate,
  isQuickFood,
  logCatalogFood,
  logQuickAddFood,
  logScannedFood,
} from '../domain/logging';
import {
  macrosFromCustom,
  scaleFoodMacros,
  formatKcal,
  formatGrams,
  unitLabel,
} from '../domain/macros';
import type { MealSlot } from '../domain/types';
import { mealSlotLabel, useLanguage } from '../i18n';
import { foodDisplayName, foodLabel } from '../lib/labels';
import { logsRepo } from '../repos';
import { useTracker } from '../state/TrackerContext';
import { useToast } from '../state/ToastContext';
import type { Food } from '../domain/types';

type Tab = 'catalog' | 'quick' | 'templates';
type ScanMiss = { barcode: string; reason: 'not_found' | 'offline' | 'error' };
type ScanHit = { food: Food; source: 'local' | 'off'; missingNutrition: boolean };

export function AddFoodPage() {
  const { date: contextDate, visibleFoods, templates, logs, refresh } = useTracker();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { t, tcount } = useLanguage();
  const date = params.get('date') ?? contextDate;
  const slot = (params.get('slot') as MealSlot | null) ?? 'breakfast';
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'quick' ? 'quick' : 'catalog');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState(50);
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [scanHit, setScanHit] = useState<ScanHit | null>(null);
  const [scanMiss, setScanMiss] = useState<ScanMiss | null>(null);

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
  const myFoods = useMemo(
    () => visibleFoods.filter((food) => isQuickFood(food)),
    [visibleFoods],
  );
  const myFoodsNotRecent = useMemo(
    () => myFoods.filter((food) => !recent.some((item) => item.id === food.id)),
    [myFoods, recent],
  );
  const stapleFoods = useMemo(
    () => filtered.filter((food) => !isQuickFood(food)),
    [filtered],
  );

  const preview = selected ? scaleFoodMacros(selected, amount) : null;
  const slotTemplates = templates.filter((template) => template.meal_slot === slot);

  function clearScan() {
    setScanHit(null);
    setScanMiss(null);
    setLookingUp(false);
  }

  function goQuickAdd() {
    setScanning(false);
    clearScan();
    setSelectedId(null);
    setTab('quick');
  }

  async function handleBarcode(raw: string) {
    setScanning(false);
    setScanHit(null);
    setScanMiss(null);
    setSelectedId(null);
    setLookingUp(true);
    try {
      const result = await lookupBarcode(raw);
      if (result.status === 'found') {
        setScanHit({
          food: result.food,
          source: result.source,
          missingNutrition: result.missingNutrition,
        });
      } else if (result.status === 'not_found') {
        setScanMiss({ barcode: result.barcode, reason: 'not_found' });
      } else {
        setScanMiss({ barcode: result.barcode, reason: result.reason });
      }
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <div className="page page-add">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/')} aria-label={t('add.back')}>
          ‹
        </button>
        <div className="brand">
          <strong>{t('add.title')}</strong>
          <span>{mealSlotLabel(slot)}</span>
        </div>
        <Link className="chip" to="/">
          {t('add.done')}
        </Link>
      </header>

      <div className="tabs">
        <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')}>
          {t('add.tabCatalog')}
        </TabButton>
        <TabButton active={tab === 'quick'} onClick={() => setTab('quick')}>
          {t('add.tabQuick')}
        </TabButton>
        <TabButton active={tab === 'templates'} onClick={() => setTab('templates')}>
          {t('add.tabTemplates')}
        </TabButton>
      </div>

      {lookingUp ? <p className="lede">{t('scan.lookingUp')}</p> : null}

      {tab !== 'templates' && scanMiss ? (
        <div className="template-card">
          <p className="lede">
            {scanMiss.reason === 'not_found'
              ? t('scan.notFound', { barcode: scanMiss.barcode })
              : scanMiss.reason === 'offline'
                ? t('scan.offline')
                : t('scan.error')}
          </p>
          <div className="row-btns">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setScanMiss(null);
                setScanning(true);
              }}
            >
              {t('scan.tryAgain')}
            </button>
            <button type="button" className="primary" onClick={goQuickAdd}>
              {t('scan.quickAddInstead')}
            </button>
          </div>
        </div>
      ) : null}

      {tab !== 'templates' && scanHit ? (
        <ScanConfirmCard
          food={scanHit.food}
          source={scanHit.source}
          missingNutrition={scanHit.missingNutrition}
          onBack={() => clearScan()}
          onQuickAdd={goQuickAdd}
          onConfirm={async (values) => {
            const { food } = await logScannedFood({
              date,
              meal_slot: slot,
              draft: scanHit.food,
              ...values,
            });
            await refresh();
            toast(t('toast.foodAdded', { name: foodDisplayName(food) }));
            navigate('/');
          }}
        />
      ) : null}

      {tab !== 'templates' && selected && !scanHit ? (
        <div className="template-card">
          <h2 className="h1">{foodDisplayName(selected)}</h2>
          <p className="lede">
            {selected.name_fi !== foodDisplayName(selected) ? `${selected.name_fi}` : selected.name_en}
            {selected.brand ? ` · ${selected.brand}` : ''} · {selected.kcal} kcal /{' '}
            {selected.basis === 'per_piece'
              ? t('add.perPiece')
              : selected.basis === 'per_ml'
                ? t('add.per100ml')
                : t('add.per100g')}
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
          ) : null}
          <div className="row-btns">
            <button type="button" className="ghost" onClick={() => setSelectedId(null)}>
              {t('add.back')}
            </button>
            <button
              type="button"
              className="primary"
              onClick={async () => {
                await logCatalogFood({ date, meal_slot: slot, food: selected, amount });
                await refresh();
                toast(t('toast.foodAdded', { name: foodDisplayName(selected) }));
                navigate('/');
              }}
            >
              {t('add.add')}
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'catalog' && !selected && !scanHit ? (
          <div>
            <ScanBarcodeButton
              onClick={() => {
                clearScan();
                setScanning(true);
              }}
            />
            <input
              className="search"
              placeholder={t('add.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query === '' && recent.length > 0 ? (
              <>
                <div className="section-label">{t('add.recent')}</div>
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
            {query === '' && myFoodsNotRecent.length > 0 ? (
              <>
                <div className="section-label">{t('add.myFoods')}</div>
                {myFoodsNotRecent.map((food) => (
                  <FoodButton
                    key={`mine-${food.id}`}
                    food={food}
                    onPick={() => {
                      setSelectedId(food.id);
                      setAmount(food.default_serving);
                    }}
                  />
                ))}
              </>
            ) : null}
            <div className="section-label">{query === '' ? t('add.staples') : t('add.tabCatalog')}</div>
            {(query === '' ? stapleFoods : filtered).map((food) => (
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
      ) : null}

      {tab === 'quick' && !selected && !scanHit ? (
        <div>
          <ScanBarcodeButton
            onClick={() => {
              clearScan();
              setScanning(true);
            }}
          />
          {myFoods.length > 0 ? (
            <>
              <div className="section-label">{t('add.myFoods')}</div>
              {myFoods.map((food) => (
                <FoodButton
                  key={`quick-${food.id}`}
                  food={food}
                  onPick={() => {
                    setSelectedId(food.id);
                    setAmount(food.default_serving);
                  }}
                />
              ))}
            </>
          ) : null}
          {myFoods.length > 0 ? <div className="section-label">{t('add.quickNew')}</div> : null}
          <QuickAddForm
            onSubmit={async (values) => {
              const { food } = await logQuickAddFood({
                date,
                meal_slot: slot,
                name: values.name,
                amount: values.amount,
                ...macrosFromCustom(values),
              });
              await refresh();
              toast(t('toast.quickAddSaved', { name: food.name_en ?? food.name_fi }));
              navigate('/');
            }}
          />
        </div>
      ) : null}

      {tab === 'templates' ? (
        <div>
          {slotTemplates.length === 0 ? (
            <p className="lede">{t('add.noTemplates')}</p>
          ) : (
            slotTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className="food-row"
                onClick={async () => {
                  await applyTemplate({ template, date, meal_slot: slot });
                  await refresh();
                  toast(t('toast.foodAdded', { name: template.name }));
                  navigate('/');
                }}
              >
                <div>
                  <div className="name">{template.name}</div>
                  <div className="sub">{tcount(template.items.length, 'add.rowsOne', 'add.rowsOther')}</div>
                </div>
                <b>{t('add.use')}</b>
              </button>
            ))
          )}
          <CopyMealButton
            date={date}
            slot={slot}
            onCopied={async () => {
              await refresh();
              toast(t('toast.mealCopied'));
              navigate('/');
            }}
          />
        </div>
      ) : null}

      {scanning ? (
        <BarcodeScannerOverlay
          onDetected={(code) => void handleBarcode(code)}
          onClose={() => setScanning(false)}
          onQuickAdd={goQuickAdd}
        />
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

function ScanBarcodeButton({ onClick }: { onClick: () => void }) {
  const { t } = useLanguage();
  return (
    <button type="button" className="scan-btn" onClick={onClick}>
      {t('scan.button')}
    </button>
  );
}

function FoodButton({ food, onPick }: { food: Food; onPick: () => void }) {
  const { t } = useLanguage();
  return (
    <button type="button" className="food-row" onClick={onPick}>
      <div>
        <div className="name">{foodDisplayName(food)}</div>
        <div className="sub">
          {foodLabel(food)} · {food.kcal} kcal /{' '}
          {food.basis === 'per_piece' ? t('add.perPiece') : food.basis === 'per_ml' ? t('add.per100ml') : t('add.per100g')} ·{' '}
          {t('add.defaultAmount', {
            amount: food.default_serving,
            unit: unitLabel(food.serving_unit),
          })}
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
  const { t } = useLanguage();
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
      <p className="lede">{t('add.quickHint')}</p>
      <label className="field">
        <span>{t('meal.name')}</span>
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="field">
        <span>{t('add.amountG')}</span>
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
        <Num label={t('macros.p')} value={protein} onChange={setProtein} />
        <Num label={t('macros.c')} value={carbs} onChange={setCarbs} />
        <Num label={t('macros.f')} value={fat} onChange={setFat} />
      </div>
      <button type="submit" className="primary" style={{ width: '100%' }}>
        {t('add.saveQuick')}
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
  const { t } = useLanguage();
  return (
    <button
      type="button"
      className="ghost"
      style={{ width: '100%', marginTop: 8 }}
      onClick={async () => {
        const source = await logsRepo.getByDateAndSlot(previousDay(date), slot);
        if (source.length === 0) {
          toast(t('toast.yesterdayMealEmptyShort'));
          return;
        }
        await copyLogsToDate(source, date, slot);
        await onCopied();
      }}
    >
      {t('add.copyYesterdayMeal', { meal: mealSlotLabel(slot).toLowerCase() })}
    </button>
  );
}
