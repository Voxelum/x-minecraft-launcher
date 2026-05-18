import { describe, expect, it, vi } from 'vitest'
import { withRetry } from './withRetry'

const ok = (status: number, headers: Record<string, string> = {}) =>
  new Response('', { status, headers })

describe('withRetry', () => {
  it('passes through a 200 response on the first attempt', async () => {
    const underlying = vi.fn(async () => ok(200))
    const fetch = withRetry(underlying as any)
    const r = await fetch('https://x' as any)
    expect(r.status).toBe(200)
    expect(underlying).toHaveBeenCalledTimes(1)
  })

  it('retries transient statuses and returns the eventual success', async () => {
    const underlying = vi.fn()
      .mockResolvedValueOnce(ok(503))
      .mockResolvedValueOnce(ok(200))
    const fetch = withRetry(underlying as any, { baseBackoffMs: 1, maxBackoffMs: 1 })
    const r = await fetch('https://x' as any)
    expect(r.status).toBe(200)
    expect(underlying).toHaveBeenCalledTimes(2)
  })

  it('honors Retry-After (seconds) as the wait floor', async () => {
    const underlying = vi.fn()
      .mockResolvedValueOnce(ok(429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(ok(200))
    const fetch = withRetry(underlying as any, { baseBackoffMs: 1, maxBackoffMs: 1 })
    const r = await fetch('https://x' as any)
    expect(r.status).toBe(200)
  })

  it('stops retrying after maxAttempts and returns the last response', async () => {
    const underlying = vi.fn(async () => ok(503))
    const fetch = withRetry(underlying as any, { maxAttempts: 3, baseBackoffMs: 1, maxBackoffMs: 1 })
    const r = await fetch('https://x' as any)
    expect(r.status).toBe(503)
    expect(underlying).toHaveBeenCalledTimes(3)
  })

  it('does not retry non-transient statuses', async () => {
    const underlying = vi.fn(async () => ok(401))
    const fetch = withRetry(underlying as any, { baseBackoffMs: 1, maxBackoffMs: 1 })
    const r = await fetch('https://x' as any)
    expect(r.status).toBe(401)
    expect(underlying).toHaveBeenCalledTimes(1)
  })

  it('aborts during the backoff sleep when the caller signal fires', async () => {
    const underlying = vi.fn(async () => ok(503))
    const fetch = withRetry(underlying as any, { baseBackoffMs: 1000, maxBackoffMs: 1000 })
    const controller = new AbortController()
    const p = fetch('https://x' as any, { signal: controller.signal } as any)
    setTimeout(() => controller.abort(new Error('user abort')), 5)
    await expect(p).rejects.toThrow('user abort')
  })
})
