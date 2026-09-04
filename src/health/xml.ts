const ENTITY: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&',
};

export function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCharCode(parseInt(body.slice(2), 16));
    }
    if (body.startsWith('#')) {
      return String.fromCharCode(Number(body.slice(1)));
    }
    return ENTITY[body] ?? match;
  });
}

export function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) {
    attrs[match[1]] = decodeXmlEntities(match[2]);
  }
  return attrs;
}

export function stripDoctype(xml: string): string {
  const bom = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  const healthData = bom.search(/<HealthData[\s>]/);
  if (healthData === -1) return bom.replace(/<!DOCTYPE[\s\S]*?(\[[\s\S]*?\]\s*)?>/i, '');
  const decl = bom.match(/^(\s*<\?xml[^?]*\?>\s*)/);
  return `${decl?.[1] ?? ''}${bom.slice(healthData)}`;
}

/** Apple Health wall times like `2026-09-01 08:00:00 +0300` → ISO UTC. */
export function appleDateToIso(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?\s*([+-]\d{2}):?(\d{2})$/,
  );
  if (match) {
    const frac = match[3] ? `.${match[3]}` : '';
    return new Date(`${match[1]}T${match[2]}${frac}${match[4]}:${match[5]}`).toISOString();
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return trimmed;
}

export function sampleId(sample: {
  type: string;
  sourceName: string;
  startDate: string;
  endDate: string;
  unit: string;
  value: number;
}): string {
  return [
    sample.type,
    sample.sourceName,
    sample.startDate,
    sample.endDate,
    sample.unit,
    String(sample.value),
  ].join('|');
}
