import { applyTemplate } from '../domain/logging';
import { mealSlotLabel, useLanguage } from '../i18n';
import { templatesRepo } from '../repos';
import { useTracker } from '../state/TrackerContext';
import { useToast } from '../state/ToastContext';

export function TemplatesPage() {
  const { date, templates, refresh } = useTracker();
  const toast = useToast();
  const { t, tcount } = useLanguage();

  return (
    <div className="page">
      <h1 className="h1">{t('templates.title')}</h1>
      <p className="lede">{t('templates.lede')}</p>
      {templates.map((template) => (
        <article key={template.id} className="template-card">
          <h3>{template.name}</h3>
          <p className="muted">
            {mealSlotLabel(template.meal_slot)} · {tcount(template.items.length, 'add.rowsOne', 'add.rowsOther')}
          </p>
          <div className="row-btns" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="primary"
              onClick={async () => {
                await applyTemplate({ template, date });
                await refresh();
                toast(t('toast.foodAdded', { name: template.name }));
              }}
            >
              {t('templates.addToday')}
            </button>
            {!template.id.startsWith('seed-') ? (
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  await templatesRepo.delete(template.id);
                  await refresh();
                  toast(t('toast.templateDeleted'));
                }}
              >
                {t('meal.delete')}
              </button>
            ) : (
              <span className="muted" style={{ alignSelf: 'center' }}>
                {t('templates.preset')}
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
