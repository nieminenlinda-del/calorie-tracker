/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persistentStorage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestPersistentStorage', () => {
  it('calls persist when StorageManager is available and ignores the result', () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persist } });

    expect(() => requestPersistentStorage()).not.toThrow();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does not throw when persist is missing', () => {
    vi.stubGlobal('navigator', { storage: {} });
    expect(() => requestPersistentStorage()).not.toThrow();
  });

  it('does not throw when storage is missing', () => {
    vi.stubGlobal('navigator', {});
    expect(() => requestPersistentStorage()).not.toThrow();
  });

  it('does not throw when persist rejects', () => {
    const persist = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { storage: { persist } });
    expect(() => requestPersistentStorage()).not.toThrow();
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
