import { unzipSync } from 'fflate';

const ZIP_MAGIC = [0x50, 0x4b];

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

/** Prefer `export.xml`; ignore `export_cda.xml`. Paths may be nested. */
export function extractExportXml(bytes: Uint8Array): Uint8Array {
  if (looksLikeXml(bytes)) return bytes;
  if (!looksLikeZip(bytes)) {
    throw new Error('Tiedosto ei ole Health-vienti (xml tai zip)');
  }

  const files = unzipSync(bytes);
  const entry = Object.entries(files).find(([name]) => {
    const normalized = name.replace(/\\/g, '/');
    const base = normalized.slice(normalized.lastIndexOf('/') + 1);
    return base === 'export.xml';
  });
  if (!entry) {
    throw new Error('Zip-tiedostosta ei löytynyt export.xml');
  }
  return entry[1];
}

export function xmlBytesToString(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}
