import { normalizeBarcode } from './normalize';

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;

export type CameraErrorKind = 'permission' | 'no_camera' | 'error';

export function classifyCameraError(err: unknown): CameraErrorKind {
  const name = err instanceof DOMException ? err.name : '';
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    message.includes('permission') ||
    message.includes('not allowed')
  ) {
    return 'permission';
  }
  if (
    name === 'NotFoundError' ||
    name === 'OverconstrainedError' ||
    name === 'DevicesNotFoundError' ||
    message.includes('requested device not found') ||
    message.includes('no camera')
  ) {
    return 'no_camera';
  }
  return 'error';
}

export async function nativeBarcodeSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return false;
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
  try {
    if (typeof BarcodeDetector.getSupportedFormats === 'function') {
      const formats = await BarcodeDetector.getSupportedFormats();
      if (!formats.includes('ean_13') && !formats.includes('upc_a')) return false;
    }
    new BarcodeDetector({ formats: [...NATIVE_FORMATS] });
    return true;
  } catch {
    return false;
  }
}

export async function startNativeScanner(
  video: HTMLVideoElement,
  onCode: (barcode: string) => void,
): Promise<() => Promise<void>> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });

  const release = () => {
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  };

  try {
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;
    video.autoplay = true;
    await video.play();

    const detector = new BarcodeDetector({ formats: [...NATIVE_FORMATS] });
    let cancelled = false;
    let raf = 0;
    let reported = false;

    const tick = async () => {
      if (cancelled || reported) return;
      try {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const codes = await detector.detect(video);
          const raw = codes[0]?.rawValue;
          const barcode = raw ? normalizeBarcode(raw) : '';
          if (barcode) {
            reported = true;
            onCode(barcode);
            return;
          }
        }
      } catch {
        // empty / unsupported frame
      }
      if (!cancelled && !reported) {
        raf = requestAnimationFrame(() => void tick());
      }
    };
    raf = requestAnimationFrame(() => void tick());

    return async () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      release();
    };
  } catch (err) {
    release();
    throw err;
  }
}

export async function startHtml5Scanner(
  elementId: string,
  onCode: (barcode: string) => void,
): Promise<() => Promise<void>> {
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
  const scanner = new Html5Qrcode(elementId, {
    verbose: false,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
    ],
    useBarCodeDetectorIfSupported: true,
  });

  let reported = false;
  const config = {
    fps: 8,
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
      width: Math.max(180, Math.min(Math.floor(viewfinderWidth * 0.92), 360)),
      height: Math.max(80, Math.min(Math.floor(viewfinderHeight * 0.28), 160)),
    }),
    disableFlip: true,
  };

  const handle = (text: string) => {
    if (reported) return;
    const barcode = normalizeBarcode(text);
    if (!barcode) return;
    reported = true;
    onCode(barcode);
  };

  try {
    try {
      await scanner.start({ facingMode: { ideal: 'environment' } }, config, handle, () => undefined);
    } catch {
      await scanner.start({ facingMode: 'environment' }, config, handle, () => undefined);
    }
  } catch (err) {
    try {
      scanner.clear();
    } catch {
      // ignore
    }
    throw err;
  }

  return async () => {
    try {
      if (scanner.isScanning) await scanner.stop();
    } catch {
      // already stopped
    }
    try {
      scanner.clear();
    } catch {
      // ignore
    }
  };
}
