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
  const html5Id = `barcode-html5-reader-${useId().replace(/:/g, '')}`;
  const [engine, setEngine] = useState<'native' | 'html5' | null>(null);
  const [cameraError, setCameraError] = useState<CameraErrorKind | null>(null);
  const [typed, setTyped] = useState('');
  const typedId = useId();

  useEffect(() => {
    let cancelled = false;
    void nativeBarcodeSupported().then((useNative) => {
      if (!cancelled) setEngine(useNative ? 'native' : 'html5');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!engine) return;
    let cancelled = false;
    const stopRef = { current: undefined as undefined | (() => Promise<void>) };
    const reported = { current: false };

    const emit = (barcode: string) => {
      if (reported.current) return;
      reported.current = true;
      onDetectedRef.current(barcode);
    };

    (async () => {
      try {
        if (engine === 'native') {
          const video = videoRef.current;
          if (!video) throw new Error('Scanner container is missing');
          stopRef.current = await startNativeScanner(video, emit);
        } else {
          stopRef.current = await startHtml5Scanner(html5Id, emit);
        }
        if (cancelled) await stopRef.current?.();
      } catch (err) {
        if (!cancelled) setCameraError(classifyCameraError(err));
      }
    })();

    return () => {
      cancelled = true;
      void stopRef.current?.();
    };
  }, [engine, html5Id]);

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
      <div className="scanner-stage" hidden={Boolean(cameraError)}>
        {engine === 'native' ? (
          <>
            <video
              ref={videoRef}
              className="scanner-video"
              playsInline
              muted
              autoPlay
            />
            <div className="scanner-reticle" aria-hidden />
          </>
        ) : null}
        {engine === 'html5' ? <div id={html5Id} className="scanner-html5" /> : null}
      </div>
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
