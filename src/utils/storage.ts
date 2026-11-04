/** The stored string, or null if the key is unset or storage is unavailable. */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Stores a string. Returns false if it could not be saved. */
export function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * The stored JSON value, or undefined if the key is unset, the text is not
 * valid JSON, or storage is unavailable. The result is untrusted: check it.
 */
export function readJson(key: string): unknown {
  const text = readStorage(key);
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Stores a value as JSON. Returns false if it could not be saved. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeStorage(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
