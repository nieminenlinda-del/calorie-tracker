import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  classifyCameraError,
  nativeBarcodeSupported,
  startHtml5Scanner,
  startNativeScanner,
  type CameraErrorKind,
} from '../barcode/camera';
import { normalizeBarcode } from '../barcode/normalize';
import { useLanguage } from '../i18n';

const HTML5_READER_ID = 'barcode-html5-reader';

export function BarcodeScannerOverlay({
  onDetected,
  onClose,
  onQuickAdd,
}: {
  onDetected: (barcode: string) => void;
  onClose: () => void;
  onQuickAdd: () => void;
}) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [engine, setEngine] = useState<'native' | 'html5' | null>(null);
  const [cameraError, setCameraError] = useState<CameraErrorKind | null>(null);
  const [typed, setTyped] = useState('');
  const typedId = useId();

  useEffect(() => {
    let cancelled = false;
    let stop: (() => Promise<void>) | undefined;
    const reported = { current: false };

    const emit = (barcode: string) => {
      if (reported.current) return;
      reported.current = true;
      onDetectedRef.current(barcode);
    };

    (async () => {
      const useNative = await nativeBarcodeSupported();
      if (cancelled) return;
      setEngine(useNative ? 'native' : 'html5');
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (cancelled) return;
      try {
        if (useNative && videoRef.current) {
          stop = await startNativeScanner(videoRef.current, emit);
        } else {
          stop = await startHtml5Scanner(HTML5_READER_ID, emit);
        }
      } catch (err) {
        if (!cancelled) setCameraError(classifyCameraError(err));
        return;
      }
      if (cancelled) await stop?.();
    })();

    return () => {
      cancelled = true;
      void stop?.();
    };
  }, []);

  function submitTyped(event: FormEvent) {
    event.preventDefault();
    const barcode = normalizeBarcode(typed);
    if (!barcode) return;
    onDetected(barcode);
  }

  const errorCopy =
    cameraError === 'permission'
      ? t('scan.permission')
      : cameraError === 'no_camera'
        ? t('scan.noCamera')
        : cameraError === 'error'
          ? t('scan.cameraError')
          : null;

  const node = (
    <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label={t('scan.title')}>
      <header className="scanner-toolbar">
        <div>
          <strong>{t('scan.title')}</strong>
          <p className="scanner-hint">{t('scan.cameraHint')}</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('scan.close')}>
          ✕
        </button>
      </header>
      <p className="scanner-prompt">{t('scan.prompt')}</p>
      {errorCopy ? <p className="scanner-error">{errorCopy}</p> : null}
      <div className="scanner-stage" hidden={engine === 'html5' || Boolean(cameraError)}>
        <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />
        <div className="scanner-reticle" aria-hidden />
      </div>
      <div
        id={HTML5_READER_ID}
        className="scanner-stage scanner-html5"
        hidden={engine !== 'html5' || Boolean(cameraError)}
      />
      <form className="scanner-type" onSubmit={submitTyped}>
        <label className="field" htmlFor={typedId}>
          <span>{t('scan.enterCode')}</span>
          <input
            id={typedId}
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="7300000000000"
          />
        </label>
        <button type="submit" className="primary" style={{ width: '100%' }}>
          {t('scan.lookup')}
        </button>
      </form>
      <button type="button" className="ghost" style={{ width: '100%' }} onClick={onQuickAdd}>
        {t('scan.quickAddInstead')}
      </button>
    </div>
  );
  const target = document.getElementById('overlay-root');
  return target ? createPortal(node, target) : node;
}
