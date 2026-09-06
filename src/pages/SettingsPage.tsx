import { useState } from 'react';
import { ActiveEnergyCard } from '../components/ActiveEnergyCard';
import { DEFAULT_DIET_FLAGS, DEFAULT_TARGETS, type DietFlag } from '../domain/types';
import { LOCALES, flagLabel, useLanguage } from '../i18n';
import { targetsRepo } from '../repos';
import { useTracker } from '../state/TrackerContext';
import { useToast } from '../state/ToastContext';

export function SettingsPage() {
  const { targets, energyHistory, refresh } = useTracker();
  const toast = useToast();
  const { locale, setLocale, t } = useLanguage();
  const [kcal, setKcal] = useState(targets.kcal);
  const [protein, setProtein] = useState(targets.protein);
  const [carbs, setCarbs] = useState(targets.carbs);
  const [fat, setFat] = useState(targets.fat);
  const [flags, setFlags] = useState<DietFlag[]>(targets.diet_flags);

  return (
    <div className="page">
      <h1 className="h1">{t('settings.title')}</h1>
      <p className="lede">
        {t('settings.lede', { p: t('macros.p'), c: t('macros.c'), f: t('macros.f') })}
      </p>

      <div className="section-label">{t('settings.language')}</div>
      <div className="flags" role="group" aria-label={t('settings.language')} style={{ marginBottom: 16 }}>
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            className={locale === code ? 'flag on' : 'flag'}
            aria-pressed={locale === code}
            onClick={() => setLocale(code)}
          >
            {code === 'sv' ? t('settings.languageSv') : t('settings.languageEn')}
          </button>
        ))}
      </div>

      <label className="field">
        <span>kcal</span>
        <input
          inputMode="numeric"
          value={kcal}
          onChange={(event) => setKcal(Number(event.target.value) || 0)}
        />
      </label>
      <label className="field">
        <span>{t('settings.proteinG')}</span>
        <input
          inputMode="decimal"
          value={protein}
          onChange={(event) => setProtein(Number(event.target.value) || 0)}
        />
      </label>
      <label className="field">
        <span>{t('settings.carbsG')}</span>
        <input
          inputMode="decimal"
          value={carbs}
          onChange={(event) => setCarbs(Number(event.target.value) || 0)}
        />
      </label>
      <label className="field">
        <span>{t('settings.fatG')}</span>
        <input
          inputMode="decimal"
          value={fat}
          onChange={(event) => setFat(Number(event.target.value) || 0)}
        />
      </label>

      <div className="section-label">{t('settings.diet')}</div>
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
              {flagLabel(flag)}
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
            toast(t('toast.targetsSaved'));
          }}
        >
          {t('settings.save')}
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
            toast(t('toast.defaultsRestored'));
          }}
        >
          {t('settings.restoreDefaults')}
        </button>
      </div>

      <h2 className="h1" style={{ fontSize: 20, marginTop: 28 }}>
        {t('settings.imports')}
      </h2>
      <p className="lede">{t('settings.importsLede')}</p>
      <ActiveEnergyCard history={energyHistory} showImport showHistory />
    </div>
  );
}
