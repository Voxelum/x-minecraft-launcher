import { describe, it, expect } from 'vitest'
import { WorkerQueue } from './WorkerQueue'

describe('WorkerQueue', () => {
  it('runs each job exactly once under a synchronous burst with high concurrency', async () => {
    const runs = new Map<number, number>()
    const q = new WorkerQueue<number>(
      async (n) => {
        runs.set(n, (runs.get(n) ?? 0) + 1)
        // Mimic a real worker: first await something already resolved
        // (e.g. a cached open), then do async I/O.
        await Promise.resolve()
        await new Promise((r) => setTimeout(r, 1))
      },
      128,
      { shouldRetry: () => false },
    )

    const jobs = Array.from({ length: 300 }, (_, i) => i)
    for (const j of jobs) q.push(j)

    await new Promise<void>((resolve) => {
      q.onIdle = () => resolve()
    })

    // Before the shift-before-await fix, the head job ran `workers` (128)
    // times in parallel while the rest ran once.
    for (const j of jobs) {
      expect(runs.get(j)).toBe(1)
    }
  })

  it('retries a failing job up to the retry count then reports it', async () => {
    const attempts = new Map<number, number>()
    const errored: number[] = []
    const q = new WorkerQueue<number>(
      async (n) => {
        attempts.set(n, (attempts.get(n) ?? 0) + 1)
        if (n === 7) throw new Error('boom')
      },
      4,
      { retryCount: 2, retryAwait: () => 0, shouldRetry: () => true },
    )
    q.onerror = (job) => errored.push(job)

    for (let i = 0; i < 10; i++) q.push(i)
    await new Promise<void>((resolve) => {
      q.onIdle = () => resolve()
    })

    expect(errored).toEqual([7])
    // initial attempt + 2 retries
    expect(attempts.get(7)).toBe(3)
    // every other job ran exactly once
    for (let i = 0; i < 10; i++) {
      if (i === 7) continue
      expect(attempts.get(i)).toBe(1)
    }
  })
})
