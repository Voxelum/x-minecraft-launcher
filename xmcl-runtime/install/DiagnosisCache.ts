export class InFlightCache<T> {
  private readonly promises = new Map<string, Promise<T>>()

  getOrCreate(key: string, create: () => Promise<T>) {
    const existed = this.promises.get(key)
    if (existed) return existed

    const promise = create().finally(() => {
      if (this.promises.get(key) === promise) {
        this.promises.delete(key)
      }
    })
    this.promises.set(key, promise)
    return promise
  }

  clear() {
    this.promises.clear()
  }
}

export class FreshResultCache<T> {
  private readonly inFlight = new InFlightCache<T>()
  private readonly results = new Map<string, {
    checkedAt: number
    value: T
    expiration: ReturnType<typeof setTimeout>
  }>()
  private generation = 0

  constructor(
    private readonly freshness: number,
    private readonly capacity = 32,
  ) {}

  getOrCreate(key: string, create: () => Promise<T>) {
    const cached = this.results.get(key)
    if (cached && Date.now() - cached.checkedAt <= this.freshness) {
      this.results.delete(key)
      this.results.set(key, cached)
      return Promise.resolve(cached.value)
    }
    if (cached) {
      this.delete(key)
    }

    const generation = this.generation
    return this.inFlight.getOrCreate(key, async () => {
      const value = await create()
      if (generation === this.generation) {
        this.set(key, value)
      }
      return value
    })
  }

  private set(key: string, value: T) {
    this.delete(key)
    while (this.results.size >= this.capacity) {
      const oldest = this.results.keys().next().value
      if (oldest === undefined) break
      this.delete(oldest)
    }
    const checkedAt = Date.now()
    const expiration = setTimeout(() => {
      const cached = this.results.get(key)
      if (cached?.checkedAt === checkedAt) {
        this.results.delete(key)
      }
    }, this.freshness)
    this.results.set(key, { checkedAt, value, expiration })
  }

  private delete(key: string) {
    const cached = this.results.get(key)
    if (cached) {
      clearTimeout(cached.expiration)
      this.results.delete(key)
    }
  }

  invalidate() {
    this.generation += 1
    for (const cached of this.results.values()) {
      clearTimeout(cached.expiration)
    }
    this.results.clear()
    this.inFlight.clear()
  }
}