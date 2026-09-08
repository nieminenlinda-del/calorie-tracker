import { normalizeBarcode } from './normalize';

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;
const LAYOUT_TIMEOUT_MS = 2500;

export type CameraErrorKind = 'permission' | 'no_camera' | 'error';

/** Native getUserMedia fallbacks (ideal → exact → front → any camera). */
export const NATIVE_VIDEO_CONSTRAINTS: MediaTrackConstraints[] = [
  { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  { facingMode: 'environment' },
  { facingMode: 'user' },
  {},
];

/**
 * html5-qrcode only accepts `{ facingMode: 'environment' | 'user' }` or
 * `{ facingMode: { exact } }`. `{ ideal: 'environment' }` throws *before*
 * getUserMedia and leaves the instance stuck in a state transition, so a
 * retry on the same instance never prompts for the camera.
 */
export const HTML5_VIDEO_CONSTRAINTS: Array<{ facingMode: 'environment' | 'user' }> = [
  { facingMode: 'environment' },
  { facingMode: 'user' },
];

export function classifyCameraError(err: unknown): CameraErrorKind {
  const name = err instanceof DOMException ? err.name : '';
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError' ||
    message.includes('permission') ||
    message.includes('not allowed') ||
    message.includes('notallowed') ||
    message.includes('denied')
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

/**
 * iPhone / iPad Safari and home-screen PWAs (iPadOS 13+ reports as Macintosh
 * with touch). Native BarcodeDetector is skipped here — even when the
 * constructor exists it is unreliable, and html5-qrcode is the camera path.
 */
export function preferHtml5Scanner(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iP(hone|ad|od)/i.test(userAgent)) return true;
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return true;
  return false;
}

export function isLaidOutScannerContainer(element: HTMLElement): boolean {
  if (!element.isConnected || element.hidden) return false;
  if (typeof window !== 'undefined') {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return element.clientWidth > 0 && element.clientHeight > 0;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** Do not start Html5Qrcode against a hidden or zero-size node (Safari fails instantly). */
export async function waitForLaidOutElement(
  element: HTMLElement,
  timeoutMs = LAYOUT_TIMEOUT_MS,
): Promise<void> {
  if (isLaidOutScannerContainer(element)) return;
  await nextFrame();
  await nextFrame();
  if (isLaidOutScannerContainer(element)) return;
  const deadline = Date.now() + timeoutMs;
  while (!isLaidOutScannerContainer(element)) {
    if (Date.now() >= deadline) {
      throw new Error('Scanner container is hidden or has zero size');
    }
    await nextFrame();
  }
}

export async function nativeBarcodeSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (preferHtml5Scanner(navigator.userAgent, navigator.maxTouchPoints ?? 0)) return false;
  if (!('BarcodeDetector' in window)) return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
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

async function getCameraStream(): Promise<MediaStream> {
  let lastErr: unknown;
  for (const video of NATIVE_VIDEO_CONSTRAINTS) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: false, video });
    } catch (err) {
      lastErr = err;
      if (classifyCameraError(err) === 'permission') throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Could not open camera');
}

export async function startNativeScanner(
  video: HTMLVideoElement,
  onCode: (barcode: string) => void,
): Promise<() => Promise<void>> {
  await waitForLaidOutElement(video);
  const stream = await getCameraStream();

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

async function stopHtml5Scanner(scanner: {
  isScanning: boolean;
  stop: () => Promise<void>;
  clear: () => void;
}): Promise<void> {
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
}

export async function startHtml5Scanner(
  elementId: string,
  onCode: (barcode: string) => void,
): Promise<() => Promise<void>> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Scanner container is missing');
  await waitForLaidOutElement(element);

  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

  const config = {
    fps: 8,
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
      width: Math.max(180, Math.min(Math.floor(viewfinderWidth * 0.92), 360)),
      height: Math.max(80, Math.min(Math.floor(viewfinderHeight * 0.28), 160)),
    }),
    disableFlip: true,
  };

  let reported = false;
  const handle = (text: string) => {
    if (reported) return;
    const barcode = normalizeBarcode(text);
    if (!barcode) return;
    reported = true;
    onCode(barcode);
  };

  const createScanner = () =>
    new Html5Qrcode(elementId, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
      useBarCodeDetectorIfSupported: true,
    });

  let scanner: InstanceType<typeof Html5Qrcode> | undefined;
  let lastErr: unknown;
  for (const video of HTML5_VIDEO_CONSTRAINTS) {
    const next = createScanner();
    try {
      await next.start(video, config, handle, () => undefined);
      scanner = next;
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      await stopHtml5Scanner(next);
      if (classifyCameraError(err) === 'permission') break;
    }
  }

  if (!scanner) {
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'Could not start the camera'));
  }

  const active = scanner;
  return async () => {
    await stopHtml5Scanner(active);
  };
}
