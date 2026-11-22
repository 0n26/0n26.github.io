export function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

const titleEntities: Readonly<Record<string, string>> = {
  amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
};

export function titleText(value: unknown): string | undefined {
  return text(text(value)?.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, code: string) => {
    if (!code.startsWith('#')) return titleEntities[code.toLowerCase()];
    const hex = code[1].toLowerCase() === 'x';
    const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
    return point > 0 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff)
      ? String.fromCodePoint(point) : entity;
  }).replace(/\\(?=['"])/g, ''));
}

export function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}
