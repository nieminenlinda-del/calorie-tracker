import { ingestHealthBytes } from './ingest';
import type { IngestProgress, IngestResult } from './types';

export async function importHealthFile(
  file: File,
  onProgress?: (progress: IngestProgress) => void,
): Promise<IngestResult> {
  const buffer = await file.arrayBuffer();
  if (typeof Worker === 'undefined') {
    return ingestHealthBytes(new Uint8Array(buffer), onProgress);
  }

  try {
    return await importViaWorker(buffer, onProgress);
  } catch {
    return ingestHealthBytes(new Uint8Array(buffer), onProgress);
  }
}

function importViaWorker(
  buffer: ArrayBuffer,
  onProgress?: (progress: IngestProgress) => void,
): Promise<IngestResult> {
  const copy = new Uint8Array(buffer).slice();
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
      fail(new Error(event.message || 'Health-tuonti epäonnistui'));
    };

    worker.postMessage({ buffer: copy.buffer }, [copy.buffer]);
  });
}
