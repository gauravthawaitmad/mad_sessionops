// tokenUtils — localStorage utility functions only.
//
// Token reads/writes have been removed. Redux-persist is the single source of
// truth for tokens in memory; the access_token cookie is the source of truth
// for the Next.js middleware. Use lib/redux/storeAccessor for reading tokens
// from outside the React tree, and lib/auth/cookieUtils for cookie management.

/**
 * Validate localStorage is working (used in health checks).
 */
export function validateLocalStorage(): boolean {
  try {
    const testKey = "__storage_test__";
    localStorage.setItem(testKey, "test");
    const result = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    return result === "test";
  } catch {
    return false;
  }
}

/**
 * Remove stale non-JSON items from localStorage (does not touch token keys).
 */
export function cleanLocalStorage(): void {
  try {
    if (typeof window === "undefined") return;

    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Leave redux-persist keys alone — they are valid JSON blobs.
      if (key.startsWith("persist:")) continue;

      const value = localStorage.getItem(key);
      if (!value) continue;

      try {
        JSON.parse(value);
      } catch {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      console.warn(`Removed invalid localStorage item: ${key}`);
    });
  } catch (error) {
    console.error("Failed to clean localStorage:", error);
  }
}
