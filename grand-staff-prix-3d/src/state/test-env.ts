// Minimal browser-global shims so store.ts loads under vitest's default `node`
// environment (no jsdom dependency). The store reads `localStorage` at import and
// touches `window` (lazy Web-Audio) at runtime; both are absent in node. This
// module is imported FIRST by store.test.ts so the globals exist before the store
// module is evaluated. Test-only — not referenced by the app.

class MemoryStorage {
  private m = new Map<string, string>()
  get length(): number {
    return this.m.size
  }
  clear(): void {
    this.m.clear()
  }
  getItem(key: string): string | null {
    return this.m.has(key) ? this.m.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.m.set(key, String(value))
  }
  removeItem(key: string): void {
    this.m.delete(key)
  }
  key(index: number): string | null {
    return Array.from(this.m.keys())[index] ?? null
  }
}

const g = globalThis as unknown as { localStorage?: Storage; window?: unknown }
if (!g.localStorage) g.localStorage = new MemoryStorage() as unknown as Storage
// `window` only needs to exist as an object — store's audio engine reads
// `window.AudioContext` (undefined here, so audio stays a no-op).
if (!g.window) g.window = globalThis

export {}
