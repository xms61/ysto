// Checks for the hand-written validators (docs/SECURITY.md#input). Input arrives as unknown JSON, and a
// validator either proves its shape or refuses it.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Exactly these keys, so an unexpected field is refused rather than silently ignored.
export function hasKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

export function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return allowed.some((option) => option === value);
}

// Distinct items, each one of the allowed values.
export function isSubsetOf<T extends string>(value: unknown, allowed: readonly T[]): value is T[] {
  return Array.isArray(value) && new Set(value).size === value.length && value.every((item) => isOneOf(item, allowed));
}
