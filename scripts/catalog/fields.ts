// Narrowing helpers for JSON from outside the repo (API responses and caches). Each returns a typed
// value or a fallback, so the parsers built on them read like the shapes they expect.

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function recordsIn(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function stringsIn(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
