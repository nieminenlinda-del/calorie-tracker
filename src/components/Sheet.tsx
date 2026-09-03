import type { ReactNode } from 'react';

export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-card">
        <div className="topbar">
          <h2 className="h1" style={{ fontSize: 20 }}>
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Sulje">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
