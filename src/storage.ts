// Browser storage that may be missing. Blocked site data makes even reading localStorage throw, and a full
// or private store refuses writes; the app then keeps its settings only until the page closes.
export function localStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readItem(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

// Null removes the item.
export function writeItem(storage: Storage | null, key: string, value: string | null): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // A full or blocked store keeps nothing, and the page works on without it.
  }
}

export function readJson(storage: Storage | null, key: string): unknown {
  const text = readItem(storage, key);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
