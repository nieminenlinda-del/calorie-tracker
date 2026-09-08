/**
 * Best-effort persistent storage on app start.
 * Result is ignored: iOS WebKit may grant, deny, or decide silently.
 * Must never block opening Ravinto.
 */
export function requestPersistentStorage(): void {
  try {
    void globalThis.navigator?.storage?.persist?.();
  } catch {
    // persist() is optional and must not surface as a startup error.
  }
}
