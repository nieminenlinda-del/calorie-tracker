import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';

const ZIP_MAGIC = [0x50, 0x4b];
const PUSH_SLICE = 256 * 1024;

export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === ZIP_MAGIC[0] && bytes[1] === ZIP_MAGIC[1];
}

export function looksLikeXml(bytes: Uint8Array): boolean {
  const head = new TextDecoder('utf-8').decode(bytes.slice(0, 256)).replace(/^\uFEFF/, '').trimStart();
  return (
    head.startsWith('<?xml') ||
    head.startsWith('<!DOCTYPE') ||
    head.startsWith('<HealthData')
  );
}

export function isExportXmlEntryName(name: string): boolean {
  const normalized = name.replace(/\\/g, '/');
  const base = normalized.slice(normalized.lastIndexOf('/') + 1);
  return base === 'export.xml';
}

function createUnzip(): Unzip {
  const uz = new Unzip();
  uz.register(UnzipInflate);
  uz.register(UnzipPassThrough);
  return uz;
}

/** Stream `export.xml` from a zip. GPX routes / export_cda.xml are terminated unread. */
export function streamExportXmlFromZip(
  zipBytes: Uint8Array,
  onChunk: (chunk: Uint8Array, final: boolean) => void,
): void {
  let found = false;
  const uz = createUnzip();
  uz.onfile = (file) => {
    if (!isExportXmlEntryName(file.name)) {
      file.terminate();
      return;
    }
    found = true;
    file.ondata = (err, dat, final) => {
      if (err) throw err;
      onChunk(dat, final);
    };
    file.start();
  };
  for (let i = 0; i < zipBytes.length; i += PUSH_SLICE) {
    const end = Math.min(i + PUSH_SLICE, zipBytes.length);
    uz.push(zipBytes.subarray(i, end), end >= zipBytes.length);
  }
  if (!found) {
    throw new Error('Zip-tiedostosta ei löytynyt export.xml');
  }
}

export async function streamExportXmlFromZipChunks(
  chunks: AsyncIterable<Uint8Array>,
  onChunk: (chunk: Uint8Array, final: boolean) => void | Promise<void>,
): Promise<void> {
  let found = false;
  let chain = Promise.resolve();
  const uz = createUnzip();
  uz.onfile = (file) => {
    if (!isExportXmlEntryName(file.name)) {
      file.terminate();
      return;
    }
    found = true;
    file.ondata = (err, dat, final) => {
      chain = chain.then(async () => {
        if (err) throw err;
        await onChunk(dat, final);
      });
    };
    file.start();
  };

  for await (const chunk of chunks) {
    uz.push(chunk, false);
    await chain;
  }
  uz.push(new Uint8Array(0), true);
  await chain;
  if (!found) {
    throw new Error('Zip-tiedostosta ei löytynyt export.xml');
  }
}

/** Small-fixture helper. Still skips non-export.xml entries via terminate in stream path. */
export function extractExportXml(bytes: Uint8Array): Uint8Array {
  if (looksLikeXml(bytes)) return bytes;
  if (!looksLikeZip(bytes)) {
    throw new Error('Tiedosto ei ole Health-vienti (xml tai zip)');
  }
  const parts: Uint8Array[] = [];
  streamExportXmlFromZip(bytes, (chunk) => {
    parts.push(chunk);
  });
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function xmlBytesToString(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function* iterateFileChunks(file: File, size = PUSH_SLICE): AsyncGenerator<Uint8Array> {
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + size, file.size);
    yield new Uint8Array(await file.slice(offset, end).arrayBuffer());
    offset = end;
  }
}
