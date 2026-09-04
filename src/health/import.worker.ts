import { ingestHealthBytes } from './ingest';

addEventListener('message', (event: MessageEvent<{ buffer: ArrayBuffer }>) => {
  void (async () => {
    try {
      const bytes = new Uint8Array(event.data.buffer);
      const result = await ingestHealthBytes(bytes, (progress) => {
        postMessage({ type: 'progress', ...progress });
      });
      postMessage({ type: 'done', result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Health-tuonti epäonnistui';
      postMessage({ type: 'error', message });
    }
  })();
});
