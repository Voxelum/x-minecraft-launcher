import { describe, expect, it } from 'vitest'
import type { LauncherApp } from '~/app'
import MutexManager from '../app/MutexManager'
import { javaRuntimeLockKey, withJavaRuntimeLock } from './javaRuntimeLock'

describe('Java runtime process lock', () => {
  it('serializes competing operations while allowing nested removal during launch', async () => {
    const app: LauncherApp = Object.create(null)
    Object.assign(app, { mutex: new MutexManager(app) })
    let release!: () => void
    const wait = new Promise<void>((resolve) => { release = resolve })
    const events: string[] = []
    const launch = withJavaRuntimeLock(app, '/jre/a', async () => {
      events.push('launch')
      await withJavaRuntimeLock(app, '/jre/a', async () => { events.push('nested') })
      await wait
      events.push('spawned')
    })
    const remove = withJavaRuntimeLock(app, '/jre/a', async () => { events.push('remove') })
    await Promise.resolve()
    await Promise.resolve()
    expect(events).toEqual(['launch', 'nested'])
    release()
    await Promise.all([launch, remove])
    expect(events).toEqual(['launch', 'nested', 'spawned', 'remove'])
  })

  it('does not block a different runtime', async () => {
    const app: LauncherApp = Object.create(null)
    Object.assign(app, { mutex: new MutexManager(app) })
    let release!: () => void
    const wait = new Promise<void>(resolve => { release = resolve })
    const first = withJavaRuntimeLock(app, '/jre/a', () => wait)
    await expect(withJavaRuntimeLock(app, '/jre/b', async () => 'ready')).resolves.toBe('ready')
    release()
    await first
  })

  it('uses the installation directory for managed executable aliases', () => {
    const app = { platform: { os: 'linux' } } as LauncherApp
    expect(javaRuntimeLockKey(app, '/data/jre/old/bin/java', '/data/jre'))
      .toBe(javaRuntimeLockKey(app, '/data/jre/old/other/java', '/data/jre'))
    expect(javaRuntimeLockKey(app, '/data/jre/new/bin/java', '/data/jre'))
      .not.toBe(javaRuntimeLockKey(app, '/data/jre/old/bin/java', '/data/jre'))
  })
})
