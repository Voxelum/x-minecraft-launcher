import { describe, it, expect } from 'vitest'
import { Mutex } from 'async-mutex'

/**
 * Regression coverage for the InstallInstanceFilesError race fix.
 *
 * Bug: `InstanceService.deleteInstance` used to take a different mutex
 * key (`LockKey.instanceRemove(p)`) from `InstanceInstallService.#install`
 * (`LockKey.instance(p)`), and only called `instanceLock.cancel()` on
 * the install lock. `async-mutex.cancel()` rejects PENDING acquires
 * with E_CANCELED but does NOT abort the active holder, so `rm -rf`
 * could run under an in-flight install. The install would then crash
 * with `ENOENT open '.install-profile'` / `rename ENOENT|EPERM|EBUSY`
 * on subsequent file ops.
 *
 * Fix: `deleteInstance` now (a) registers strong-ref remove handlers
 * that the install uses to abort fast, (b) calls `instanceLock.cancel()`
 * synchronously then `instanceLock.runExclusive(...)` BEFORE any await,
 * so the delete is queued ahead of any new acquirer and only runs
 * after the active holder releases.
 *
 * These tests verify the precise mutex handshake the production code
 * depends on, without needing the full service DI graph.
 */
describe('deleteInstance / #install lock handshake', () => {
  /** Mimic InstanceService.registerRemoveHandler / deleteInstance with
   *  the new strong-ref + queue-before-await pattern. */
  type RemoveHandler = () => Promise<void> | void
  const makeRemoveRegistry = () => {
    const handlers: RemoveHandler[] = []
    return {
      register: (h: RemoveHandler) => {
        handlers.push(h)
        return () => {
          const i = handlers.indexOf(h)
          if (i >= 0) handlers.splice(i, 1)
        }
      },
      snapshot: () => handlers.slice(),
    }
  }

  it('delete waits for an active install to release before rm', async () => {
    const lock = new Mutex()
    const events: string[] = []

    // Simulated install holds the lock for some time, no abort.
    const installDone = lock.runExclusive(async () => {
      events.push('install:start')
      await new Promise((r) => setTimeout(r, 30))
      events.push('install:end')
    })

    // Yield so install has the lock.
    await new Promise((r) => setTimeout(r, 5))

    // Simulated deleteInstance: cancel pending, queue runExclusive
    // SYNCHRONOUSLY (no await before it), then await.
    lock.cancel()
    const deleteDone = lock.runExclusive(async () => {
      events.push('delete:rm')
    })

    await Promise.all([installDone, deleteDone])
    expect(events).toEqual(['install:start', 'install:end', 'delete:rm'])
  })

  it('delete aborts an active install via remove handler and waits for graceful release', async () => {
    const lock = new Mutex()
    const registry = makeRemoveRegistry()
    const events: string[] = []

    // Simulated install: registers an abort handler, holds the lock,
    // unwinds when aborted, throws AbortError, unregisters in finally.
    const installAbort = new AbortController()
    const installDone = (async () => {
      const unregister = registry.register(() => installAbort.abort())
      try {
        await lock.runExclusive(async () => {
          events.push('install:locked')
          // Simulate long-running install loop that polls the signal.
          for (let i = 0; i < 50; i++) {
            installAbort.signal.throwIfAborted()
            await new Promise((r) => setTimeout(r, 5))
          }
          events.push('install:completed')
        })
      } finally {
        unregister()
      }
    })().catch((e) => {
      events.push(`install:threw:${(e as Error).name}`)
    })

    await new Promise((r) => setTimeout(r, 10))

    // deleteInstance simulation: invoke handlers (fast abort), then
    // queue runExclusive synchronously.
    lock.cancel()
    const handlerPromises = registry.snapshot().map((fn) => {
      try { return Promise.resolve(fn()) } catch (e) { return Promise.reject(e) }
    })
    const deleteDone = lock.runExclusive(async () => {
      await Promise.allSettled(handlerPromises)
      events.push('delete:rm')
    })

    await Promise.all([installDone, deleteDone])

    expect(events).toContain('install:locked')
    expect(events).toContain('install:threw:AbortError')
    expect(events).not.toContain('install:completed')
    expect(events.indexOf('delete:rm')).toBeGreaterThan(events.indexOf('install:threw:AbortError'))
  })

  it('delete cancels a pending install that has not yet acquired the lock', async () => {
    const lock = new Mutex()
    const events: string[] = []

    // First install grabs the lock and holds it briefly.
    const installA = lock.runExclusive(async () => {
      events.push('A:locked')
      await new Promise((r) => setTimeout(r, 20))
    })

    await new Promise((r) => setTimeout(r, 5))

    // Second install QUEUES on the same lock — pending.
    const installB = lock.runExclusive(async () => {
      events.push('B:locked')
    }).catch((e: Error) => {
      // async-mutex throws `Error('request for lock canceled')`.
      events.push(`B:cancelled:${e.message}`)
    })

    await new Promise((r) => setTimeout(r, 5))

    // deleteInstance: cancel rejects pending B; then synchronously
    // queue our own acquire (which is allowed because cancel() only
    // affects acquires that were pending AT THE TIME of cancel).
    lock.cancel()
    const deleteDone = lock.runExclusive(async () => {
      events.push('delete:rm')
    })

    await Promise.all([installA, installB, deleteDone])

    expect(events).toContain('A:locked')
    expect(events).toContain('B:cancelled:request for lock canceled')
    expect(events).not.toContain('B:locked')
    expect(events).toContain('delete:rm')
  })

  it('a buggy remove handler does not block deletion (allSettled semantics)', async () => {
    const lock = new Mutex()
    const registry = makeRemoveRegistry()
    const events: string[] = []

    // Register a handler that throws synchronously and another that
    // rejects asynchronously — neither should prevent the rm step.
    registry.register(() => { throw new Error('handler bug') })
    registry.register(async () => { throw new Error('async handler bug') })

    lock.cancel()
    const handlerPromises = registry.snapshot().map((fn) => {
      try { return Promise.resolve(fn()) } catch (e) { return Promise.reject(e) }
    })
    await lock.runExclusive(async () => {
      await Promise.allSettled(handlerPromises)
      events.push('delete:rm')
    })

    expect(events).toEqual(['delete:rm'])
  })
})

/**
 * Regression coverage for the secondary bug in
 * `InstanceInstallService.#install`'s catch:
 *
 *   try { await prepareInstallFiles(...) }
 *   catch (e) { await writeJson(currentStatePath, ...); throw e }
 *
 * If the inner `writeJson` itself threw (e.g. because a concurrent
 * deleteInstance had just rm'd the dir, or AV held the file), the
 * inner throw replaced the original error. Production telemetry only
 * ever saw the generic ENOENT-on-`.install-profile` wrapper, never
 * the true cause (download / zip / network). Fix: the inner writeJson
 * is now `.catch`'d so it can never shadow `e`.
 */
describe('install catch must preserve original error', () => {
  /**
   * Replicates the exact shape of the production catch block. Kept
   * intentionally small so it stays in sync with the real handler.
   */
  async function installCatchHelper(args: {
    prepare: () => Promise<void>
    writePartial: () => Promise<void>
  }): Promise<void> {
    try {
      await args.prepare()
    } catch (e) {
      // Guarded — must not let writePartial's error shadow `e`.
      await args.writePartial().catch(() => { /* swallowed */ })
      throw e
    }
  }

  it('preserves the prepareInstallFiles error when writeJson also fails', async () => {
    const original = Object.assign(new Error('download failed: sha1 mismatch'), {
      name: 'ChecksumNotMatchError',
    })

    let caught: any
    try {
      await installCatchHelper({
        prepare: async () => { throw original },
        writePartial: async () => {
          const ioErr: any = new Error("ENOENT: no such file or directory, open '.install-profile'")
          ioErr.code = 'ENOENT'
          throw ioErr
        },
      })
    } catch (e) {
      caught = e
    }

    expect(caught).toBe(original)
    expect(caught.name).toBe('ChecksumNotMatchError')
  })

  it('still propagates the prepareInstallFiles error when writeJson succeeds', async () => {
    const original = new Error('zip stream closed')
    original.name = 'ZipFileClosed'

    let caught: any
    try {
      await installCatchHelper({
        prepare: async () => { throw original },
        writePartial: async () => { /* ok */ },
      })
    } catch (e) {
      caught = e
    }
    expect(caught).toBe(original)
  })
})
