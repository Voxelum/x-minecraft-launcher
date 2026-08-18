import { beforeEach, describe, expect, test, vi } from 'vitest'
import { LockKey } from '@xmcl/runtime-api'
import { Mutex } from 'async-mutex'
import { FreshResultCache, InFlightCache } from './DiagnosisCache'

describe('InstallCoordinator instance locks', () => {
  test('runs version installation beside instance file installation while serializing version requests', async () => {
    const locks = new Map<string, Mutex>()
    const getLock = (key: string) => {
      let lock = locks.get(key)
      if (!lock) {
        lock = new Mutex()
        locks.set(key, lock)
      }
      return lock
    }
    const instancePath = 'C:/instances/modpack'
    const instanceLock = getLock(LockKey.instance(instancePath))
    const versionLock = getLock(LockKey.instanceVersion(instancePath))
    const releaseInstance = await instanceLock.acquire()
    const releaseVersion = await versionLock.acquire()

    expect(instanceLock.isLocked()).toBe(true)
    expect(versionLock.isLocked()).toBe(true)

    let secondVersionStarted = false
    const secondVersion = versionLock.runExclusive(() => {
      secondVersionStarted = true
    })
    await Promise.resolve()
    expect(secondVersionStarted).toBe(false)

    releaseVersion()
    await secondVersion
    expect(secondVersionStarted).toBe(true)
    expect(instanceLock.isLocked()).toBe(true)

    releaseInstance()
  })
})

describe('InstallCoordinator diagnosis cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('deduplicates concurrent diagnosis and reuses the fresh result', async () => {
    const cache = new FreshResultCache<{ jar: string } | undefined>(30_000)
    let resolveDiagnosis: (result: { jar: string } | undefined) => void = () => {}
    const diagnosis = new Promise<{ jar: string } | undefined>((resolve) => {
      resolveDiagnosis = resolve
    })
    const diagnose = vi.fn(() => diagnosis)

    const first = cache.getOrCreate('client:v1', diagnose)
    const second = cache.getOrCreate('client:v1', diagnose)
    expect(diagnose).toHaveBeenCalledOnce()

    const issue = { jar: 'v1' }
    resolveDiagnosis(issue)
    await expect(Promise.all([first, second])).resolves.toEqual([issue, issue])
    await expect(cache.getOrCreate('client:v1', diagnose)).resolves.toBe(issue)
    expect(diagnose).toHaveBeenCalledOnce()
  })

  test('invalidates cached and in-flight diagnosis generations', async () => {
    const cache = new FreshResultCache<{ jar: string } | undefined>(30_000)
    const diagnose = vi.fn()
      .mockResolvedValueOnce({ jar: 'old' })
      .mockResolvedValueOnce(undefined)

    await cache.getOrCreate('client:v1', diagnose)
    cache.invalidate()
    await expect(cache.getOrCreate('client:v1', diagnose)).resolves.toBeUndefined()
    expect(diagnose).toHaveBeenCalledTimes(2)
  })

  test('releases expired results without another cache access', async () => {
    vi.useFakeTimers()
    const cache = new FreshResultCache<{ jar: string }>(30_000)
    const diagnose = vi.fn()
      .mockResolvedValueOnce({ jar: 'old' })
      .mockResolvedValueOnce({ jar: 'new' })

    await cache.getOrCreate('client:v1', diagnose)
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(cache.getOrCreate('client:v1', diagnose)).resolves.toEqual({ jar: 'new' })
    expect(diagnose).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  test('evicts the least recently used result at capacity', async () => {
    const cache = new FreshResultCache<string>(30_000, 2)
    const create = vi.fn(async (value: string) => value)

    await cache.getOrCreate('v1', () => create('v1'))
    await cache.getOrCreate('v2', () => create('v2'))
    await cache.getOrCreate('v1', () => create('unused'))
    await cache.getOrCreate('v3', () => create('v3'))
    await expect(cache.getOrCreate('v1', () => create('unused'))).resolves.toBe('v1')
    await cache.getOrCreate('v2', () => create('v2-new'))

    expect(create).toHaveBeenCalledTimes(4)
  })

  test('deduplicates concurrent checksums for a shared file', async () => {
    const cache = new InFlightCache<string>()
    const checksum = vi.fn().mockResolvedValue('sha1')

    await expect(Promise.all([
      cache.getOrCreate('sha1\0/libraries/shared.jar', checksum),
      cache.getOrCreate('sha1\0/libraries/shared.jar', checksum),
    ])).resolves.toEqual(['sha1', 'sha1'])
    expect(checksum).toHaveBeenCalledOnce()
  })

  test('does not reuse in-flight work after invalidation', async () => {
    const cache = new InFlightCache<string>()
    const checksum = vi.fn()
      .mockResolvedValueOnce('old')
      .mockResolvedValueOnce('new')

    const oldChecksum = cache.getOrCreate('shared', checksum)
    cache.clear()
    const newChecksum = cache.getOrCreate('shared', checksum)

    await expect(oldChecksum).resolves.toBe('old')
    await expect(newChecksum).resolves.toBe('new')
    expect(checksum).toHaveBeenCalledTimes(2)
  })
})