import { getLocale, t } from '../i18n/locale';
import { ingestHealthFile } from './ingest';
import type { IngestProgress, IngestResult } from './types';

export async function importHealthFile(
  file: File,
  onProgress?: (progress: IngestProgress) => void,
): Promise<IngestResult> {
  if (typeof Worker === 'undefined') {
    return ingestHealthFile(file, onProgress);
  }

  try {
    return await importViaWorker(file, onProgress);
  } catch {
    return ingestHealthFile(file, onProgress);
  }
}

function importViaWorker(
  file: File,
  onProgress?: (progress: IngestProgress) => void,
): Promise<IngestResult> {
  const worker = new Worker(new URL('./import.worker.ts', import.meta.url), {
    type: 'module',
  });

  return new Promise((resolve, reject) => {
    const fail = (error: Error) => {
      worker.terminate();
      reject(error);
    };

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | ({ type: 'progress' } & IngestProgress)
        | { type: 'done'; result: IngestResult }
        | { type: 'error'; message: string };
      if (data.type === 'progress') {
        onProgress?.({
          scanned: data.scanned,
          inserted: data.inserted,
          duplicates: data.duplicates,
        });
        return;
      }
      if (data.type === 'done') {
        worker.terminate();
        resolve(data.result);
        return;
      }
      fail(new Error(data.message));
    };

    worker.onerror = (event) => {
      fail(new Error(event.message || t('health.healthImportFailed')));
    };

    worker.postMessage({ file, locale: getLocale() });
  });
}
