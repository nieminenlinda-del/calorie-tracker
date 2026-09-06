import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n';

export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const node = (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-card">
        <div className="sheet-handle" aria-hidden />
        <div className="topbar">
          <h2 className="h1" style={{ fontSize: 20 }}>
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('sheet.close')}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
  const target = document.getElementById('overlay-root');
  return target ? createPortal(node, target) : node;
}
