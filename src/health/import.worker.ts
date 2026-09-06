import { initLocale, t, type Locale } from '../i18n/locale';
import { ingestHealthBytes, ingestHealthFile } from './ingest';

addEventListener(
  'message',
  (event: MessageEvent<{ file?: File; buffer?: ArrayBuffer; locale?: Locale }>) => {
    void (async () => {
      if (event.data.locale) initLocale(event.data.locale);
      try {
        const onProgress = (progress: { scanned: number; inserted: number; duplicates: number }) => {
          postMessage({ type: 'progress', ...progress });
        };
        const result = event.data.file
          ? await ingestHealthFile(event.data.file, onProgress)
          : await ingestHealthBytes(
              new Uint8Array(event.data.buffer ?? new ArrayBuffer(0)),
              onProgress,
            );
        postMessage({ type: 'done', result });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('health.healthImportFailed');
        postMessage({ type: 'error', message });
      }
    })();
  },
);
