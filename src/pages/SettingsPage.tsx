import { useState } from 'react';
import { ActiveEnergyCard } from '../components/ActiveEnergyCard';
import { DEFAULT_DIET_FLAGS, DEFAULT_TARGETS, type DietFlag } from '../domain/types';
import { targetsRepo } from '../repos';
import { useTracker } from '../state/TrackerContext';
import { useToast } from '../state/ToastContext';

const FLAG_LABELS: Record<DietFlag, string> = {
  dairy_free: 'Maidoton',
  no_bread: 'Ei leipää',
  no_tofu: 'Ei tofua',
  eggs_ok: 'Munat ok',
  fish_ok: 'Kala ok',
  no_other_meat: 'Ei muuta lihaa',
  finnish_groceries: 'Suomen kaupat',
};

export function SettingsPage() {
  const { targets, energyHistory, refresh } = useTracker();
  const toast = useToast();
  const [kcal, setKcal] = useState(targets.kcal);
  const [protein, setProtein] = useState(targets.protein);
  const [carbs, setCarbs] = useState(targets.carbs);
  const [fat, setFat] = useState(targets.fat);
  const [flags, setFlags] = useState<DietFlag[]>(targets.diet_flags);

  return (
    <div className="page">
      <h1 className="h1">Tavoitteet</h1>
      <p className="lede">
        Oletuslukemat ovat 2050 kcal · 125 P · 265 H · 60 R. Voit muokata niitä; päivän jäljellä
        -luvut päivittyvät heti. Treenipäivän +250 kcal on erillinen kytkin, se ei ylikirjoita
        tätä lukemaa.
      </p>

      <label className="field">
        <span>kcal</span>
        <input
          inputMode="numeric"
          value={kcal}
          onChange={(event) => setKcal(Number(event.target.value) || 0)}
        />
      </label>
      <label className="field">
        <span>Proteiini (g)</span>
        <input
          inputMode="decimal"
          value={protein}
          onChange={(event) => setProtein(Number(event.target.value) || 0)}
        />
      </label>
      <label className="field">
        <span>Hiilihydraatit (g)</span>
        <input
          inputMode="decimal"
          value={carbs}
          onChange={(event) => setCarbs(Number(event.target.value) || 0)}
        />
      </label>
      <label className="field">
        <span>Rasva (g)</span>
        <input
          inputMode="decimal"
          value={fat}
          onChange={(event) => setFat(Number(event.target.value) || 0)}
        />
      </label>

      <div className="section-label">Ruokavalio</div>
      <div className="flags">
        {DEFAULT_DIET_FLAGS.map((flag) => {
          const on = flags.includes(flag);
          return (
            <button
              key={flag}
              type="button"
              className={on ? 'flag on' : 'flag'}
              onClick={() =>
                setFlags((current) =>
                  current.includes(flag)
                    ? current.filter((item) => item !== flag)
                    : [...current, flag],
                )
              }
            >
              {FLAG_LABELS[flag]}
            </button>
          );
        })}
      </div>

      <div className="stack" style={{ marginTop: 20 }}>
        <button
          type="button"
          className="primary"
          onClick={async () => {
            await targetsRepo.save({ kcal, protein, carbs, fat, diet_flags: flags });
            await refresh();
            toast('Tavoitteet tallennettu');
          }}
        >
          Tallenna
        </button>
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            setKcal(DEFAULT_TARGETS.kcal);
            setProtein(DEFAULT_TARGETS.protein);
            setCarbs(DEFAULT_TARGETS.carbs);
            setFat(DEFAULT_TARGETS.fat);
            setFlags([...DEFAULT_DIET_FLAGS]);
            await targetsRepo.save({
              ...DEFAULT_TARGETS,
              diet_flags: [...DEFAULT_DIET_FLAGS],
              adjust_for_training_day: false,
            });
            await refresh();
            toast('Oletukset palautettu');
          }}
        >
          Palauta oletukset (2050 / 125 / 265 / 60)
        </button>
      </div>

      <h2 className="h1" style={{ fontSize: 20, marginTop: 28 }}>
        Apple Health
      </h2>
      <ActiveEnergyCard history={energyHistory} showImport showHistory />
    </div>
  );
}
