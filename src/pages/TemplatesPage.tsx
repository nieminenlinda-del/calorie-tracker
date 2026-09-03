import { applyTemplate } from '../domain/logging';
import { MEAL_SLOT_LABELS } from '../domain/types';
import { templatesRepo } from '../repos';
import { useTracker } from '../state/TrackerContext';
import { useToast } from '../state/ToastContext';

export function TemplatesPage() {
  const { date, templates, refresh } = useTracker();
  const toast = useToast();

  return (
    <div className="page">
      <h1 className="h1">Ateriamallit</h1>
      <p className="lede">
        Tallenna toistuva ateria ja lisää se yhdellä napilla. Treenipäivän mallit tulevat valmiina.
      </p>
      {templates.map((template) => (
        <article key={template.id} className="template-card">
          <h3>{template.name}</h3>
          <p className="muted">
            {MEAL_SLOT_LABELS[template.meal_slot]} · {template.items.length} riviä
          </p>
          <div className="row-btns" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="primary"
              onClick={async () => {
                await applyTemplate({ template, date });
                await refresh();
                toast(`${template.name} lisätty`);
              }}
            >
              Lisää tänään
            </button>
            {!template.id.startsWith('seed-') ? (
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  await templatesRepo.delete(template.id);
                  await refresh();
                  toast('Malli poistettu');
                }}
              >
                Poista
              </button>
            ) : (
              <span className="muted" style={{ alignSelf: 'center' }}>
                Valmis malli
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
