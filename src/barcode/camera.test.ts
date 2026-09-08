/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HTML5_VIDEO_CONSTRAINTS,
  NATIVE_VIDEO_CONSTRAINTS,
  classifyCameraError,
  isLaidOutScannerContainer,
  nativeBarcodeSupported,
  preferHtml5Scanner,
  waitForLaidOutElement,
} from './camera';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function mockBox(el: HTMLElement, width: number, height: number) {
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => height });
}

describe('classifyCameraError', () => {
  it('maps permission denials separately from generic start failures', () => {
    expect(classifyCameraError(new DOMException('Permission denied', 'NotAllowedError'))).toBe(
      'permission',
    );
    expect(classifyCameraError(new DOMException('denied', 'PermissionDeniedError'))).toBe(
      'permission',
    );
    expect(classifyCameraError('Error getting userMedia, error = NotAllowedError')).toBe(
      'permission',
    );
  });

  it('maps missing / overconstrained cameras', () => {
    expect(classifyCameraError(new DOMException('no devices', 'NotFoundError'))).toBe('no_camera');
    expect(classifyCameraError(new DOMException('bad constraints', 'OverconstrainedError'))).toBe(
      'no_camera',
    );
  });

  it('keeps html5-qrcode constraint / transition throws as generic errors', () => {
    expect(
      classifyCameraError("'facingMode' should be string or object with exact as key."),
    ).toBe('error');
    expect(classifyCameraError('Cannot transition to a new state, already under transition')).toBe(
      'error',
    );
    expect(classifyCameraError(new Error('Scanner container is hidden or has zero size'))).toBe(
      'error',
    );
  });
});

describe('preferHtml5Scanner / nativeBarcodeSupported', () => {
  it('forces html5 on iPhone Safari and home-screen PWAs', () => {
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    expect(preferHtml5Scanner(iphone)).toBe(true);
    expect(preferHtml5Scanner('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(
      preferHtml5Scanner(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        5,
      ),
    ).toBe(true);
    expect(preferHtml5Scanner('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', 0)).toBe(
      false,
    );
  });

  it('does not take the native BarcodeDetector path on iPhone even when the API exists', async () => {
    class FakeDetector {
      static async getSupportedFormats() {
        return ['ean_13', 'upc_a'];
      }
    }
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      maxTouchPoints: 5,
      mediaDevices: { getUserMedia: vi.fn() },
    });
    expect(await nativeBarcodeSupported()).toBe(false);
  });

  it('allows native detection on desktop when BarcodeDetector supports EAN-13', async () => {
    class FakeDetector {
      static async getSupportedFormats() {
        return ['ean_13'];
      }
    }
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      maxTouchPoints: 0,
      mediaDevices: { getUserMedia: vi.fn() },
    });
    expect(await nativeBarcodeSupported()).toBe(true);
  });
});

describe('html5-qrcode facingMode configs', () => {
  it('never passes { ideal } which html5-qrcode rejects before getUserMedia', () => {
    for (const video of HTML5_VIDEO_CONSTRAINTS) {
      expect(Object.keys(video)).toEqual(['facingMode']);
      expect(typeof video.facingMode).toBe('string');
      expect(['environment', 'user']).toContain(video.facingMode);
    }
    expect(HTML5_VIDEO_CONSTRAINTS[0]?.facingMode).toBe('environment');
  });

  it('falls back through rear, then front, then unconstrained for native getUserMedia', () => {
    expect(NATIVE_VIDEO_CONSTRAINTS[0]).toMatchObject({
      facingMode: { ideal: 'environment' },
    });
    expect(NATIVE_VIDEO_CONSTRAINTS.at(-1)).toEqual({});
  });
});

describe('scanner container layout', () => {
  it('treats hidden / display:none / zero-size nodes as not ready', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    mockBox(el, 320, 240);
    expect(isLaidOutScannerContainer(el)).toBe(true);

    el.hidden = true;
    expect(isLaidOutScannerContainer(el)).toBe(false);

    el.hidden = false;
    mockBox(el, 0, 0);
    expect(isLaidOutScannerContainer(el)).toBe(false);
  });

  it('waits until the html5 reader is visible and has size before starting', async () => {
    const el = document.createElement('div');
    el.hidden = true;
    mockBox(el, 0, 0);
    document.body.appendChild(el);

    const pending = waitForLaidOutElement(el, 1000);
    queueMicrotask(() => {
      el.hidden = false;
      mockBox(el, 390, 240);
    });
    await pending;
    expect(isLaidOutScannerContainer(el)).toBe(true);
  });

  it('fails closed if the container stays hidden', async () => {
    const el = document.createElement('div');
    el.hidden = true;
    mockBox(el, 0, 0);
    document.body.appendChild(el);
    await expect(waitForLaidOutElement(el, 40)).rejects.toThrow(/hidden or has zero size/i);
  });
});
