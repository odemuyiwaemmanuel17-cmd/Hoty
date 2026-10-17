// Minimal localStorage stub for node-environment tests (cart persistence).
class MemStorage {
  store = new Map<string, string>()
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null }
  setItem(k: string, v: string) { this.store.set(k, String(v)) }
  removeItem(k: string) { this.store.delete(k) }
  clear() { this.store.clear() }
  key(i: number) { return [...this.store.keys()][i] ?? null }
  get length() { return this.store.size }
}

;(globalThis as Record<string, unknown>).localStorage = new MemStorage()
// zustand's default persist storage checks `window` — alias it in node env.
;(globalThis as Record<string, unknown>).window = globalThis
