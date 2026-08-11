import { ensureDir, mkdtemp, readdir, rm, writeFile } from 'fs-extra'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { LaunchHistoryStore } from './LaunchHistoryStore'

describe('LaunchHistoryStore', () => {
  let root: string
  let instancePath: string
  let store: LaunchHistoryStore

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xmcl-launch-history-'))
    instancePath = join(root, 'instance')
    store = new LaunchHistoryStore(join(root, 'history'))
  })

  afterEach(() => rm(root, { recursive: true, force: true }))

  test('records a launch even when no evidence exists', async () => {
    const launchId = '11111111-1111-4111-8111-111111111111'
    await store.begin(instancePath, {
      launchId,
      operationId: 'operation-a',
      pid: 42,
      side: 'client',
      version: 'neoforge-1.21.1',
      minecraft: '1.21.1',
      startedAt: 100,
    })
    await store.complete(instancePath, launchId, {
      endedAt: 200,
      exitCode: 0,
      crashed: false,
      gameLogAmbiguous: false,
    })

    expect(await store.get(instancePath, launchId)).toMatchObject({
      state: 'exited',
      evidence: { gameLog: 'absent', debugLog: 'absent', crashReport: 'absent', launcherOutput: 'absent' },
    })
  })

  test('snapshots existing evidence associated with the launch', async () => {
    const launchId = '22222222-2222-4222-8222-222222222222'
    const gameLog = join(root, 'latest.log')
    const debugLog = join(root, 'debug.log')
    const crashReport = join(root, 'crash.txt')
    await writeFile(gameLog, 'game evidence')
    await writeFile(debugLog, 'debug evidence')
    await writeFile(crashReport, 'crash evidence')
    await store.begin(instancePath, {
      launchId,
      operationId: 'operation-b',
      pid: 43,
      side: 'client',
      version: 'fabric-1.21.1',
      minecraft: '1.21.1',
      startedAt: 100,
    })
    await store.complete(instancePath, launchId, {
      endedAt: 200,
      exitCode: 1,
      crashed: true,
      crashReportPath: crashReport,
      launcherOutput: 'launcher evidence',
      gameLogPath: gameLog,
      debugLogPath: debugLog,
      gameLogAmbiguous: false,
    })

    expect(await store.readEvidence(instancePath, launchId, 'game.log')).toBe('game evidence')
    expect(await store.readEvidence(instancePath, launchId, 'debug.log')).toBe('debug evidence')
    expect(await store.readEvidence(instancePath, launchId, 'crash-report.txt')).toBe('crash evidence')
    expect(await store.readEvidence(instancePath, launchId, 'launcher-output.log')).toBe('launcher evidence')

    await writeFile(gameLog, 'next launch game evidence')
    await writeFile(debugLog, 'next launch debug evidence')
    await writeFile(crashReport, 'next crash evidence')
    expect(await store.readEvidence(instancePath, launchId, 'game.log')).toBe('game evidence')
    expect(await store.readEvidence(instancePath, launchId, 'debug.log')).toBe('debug evidence')
    expect(await store.readEvidence(instancePath, launchId, 'crash-report.txt')).toBe('crash evidence')
  })

  test('finds the launch that archived a crash report', async () => {
    const launchId = '33333333-3333-4333-8333-333333333333'
    await store.begin(instancePath, {
      launchId,
      operationId: 'operation-crash',
      pid: 44,
      side: 'client',
      version: 'neoforge-1.21.1',
      minecraft: '1.21.1',
      startedAt: 100,
    })
    await store.complete(instancePath, launchId, {
      endedAt: 200,
      exitCode: 1,
      crashed: true,
      crashReport: 'matching crash evidence',
      gameLogAmbiguous: false,
    })

    await expect(store.findByCrashReport(instancePath, 'matching crash evidence')).resolves.toMatchObject({ launchId })
    await expect(store.findByCrashReport(instancePath, 'different crash evidence')).resolves.toBeUndefined()
  })

  test('reads a running launch game log without waiting for exit', async () => {
    const launchId = '55555555-5555-4555-8555-555555555555'
    const startedAt = Date.now() - 1_000
    await ensureDir(join(instancePath, 'logs'))
    await store.begin(instancePath, {
      launchId,
      operationId: 'operation-live',
      pid: 46,
      side: 'client',
      version: '1.21.1',
      minecraft: '1.21.1',
      startedAt,
    })
    await writeFile(join(instancePath, 'logs', 'latest.log'), 'live game evidence')

    expect((await store.list(instancePath))[0]).toMatchObject({
      launchId,
      state: 'running',
      evidence: { gameLog: 'available' },
    })
    expect(await store.readEvidence(instancePath, launchId, 'game.log')).toBe('live game evidence')
  })

  test('does not expose a live game log shared by overlapping launches', async () => {
    const firstLaunchId = '66666666-6666-4666-8666-666666666666'
    const secondLaunchId = '77777777-7777-4777-8777-777777777777'
    const startedAt = Date.now() - 1_000
    await ensureDir(join(instancePath, 'logs'))
    await store.begin(instancePath, {
      launchId: firstLaunchId,
      operationId: 'operation-live-a',
      pid: 47,
      side: 'client',
      version: '1.21.1',
      minecraft: '1.21.1',
      startedAt,
    })
    await store.begin(instancePath, {
      launchId: secondLaunchId,
      operationId: 'operation-live-b',
      pid: 48,
      side: 'client',
      version: '1.21.1',
      minecraft: '1.21.1',
      startedAt: startedAt + 100,
    })
    await writeFile(join(instancePath, 'logs', 'latest.log'), 'shared live evidence')

    expect((await store.list(instancePath)).map(record => record.evidence.gameLog)).toEqual(['ambiguous', 'ambiguous'])
    expect(await store.readEvidence(instancePath, firstLaunchId, 'game.log')).toBe('')
    expect(await store.readEvidence(instancePath, secondLaunchId, 'game.log')).toBe('')
  })

  test('does not claim a shared game log for concurrent launches', async () => {
    const launchId = '33333333-3333-4333-8333-333333333333'
    const gameLog = join(root, 'latest.log')
    await writeFile(gameLog, 'ambiguous evidence')
    await store.begin(instancePath, {
      launchId,
      operationId: 'operation-c',
      pid: 44,
      side: 'client',
      version: '1.21.1',
      minecraft: '1.21.1',
      startedAt: 100,
    })
    await store.complete(instancePath, launchId, {
      endedAt: 200,
      exitCode: 0,
      crashed: false,
      gameLogPath: gameLog,
      gameLogAmbiguous: true,
    })

    expect((await store.get(instancePath, launchId))?.evidence.gameLog).toBe('ambiguous')
    expect(await store.readEvidence(instancePath, launchId, 'game.log')).toBe('')
  })

  test('ignores unrelated entries in the instance history directory', async () => {
    const launchId = '44444444-4444-4444-8444-444444444444'
    await store.begin(instancePath, {
      launchId,
      operationId: 'operation-d',
      pid: 45,
      side: 'client',
      version: '1.21.1',
      minecraft: '1.21.1',
      startedAt: 100,
    })
    const [key] = await readdir(join(root, 'history'))
    await ensureDir(join(root, 'history', key, 'temporary'))

    await expect(store.list(instancePath)).resolves.toMatchObject([{ launchId }])
  })

  test('keeps only the latest three launches per instance', async () => {
    const launchIds = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ]
    for (const [index, launchId] of launchIds.entries()) {
      await store.begin(instancePath, {
        launchId,
        operationId: `operation-${index}`,
        pid: 50 + index,
        side: 'client',
        version: '1.21.1',
        minecraft: '1.21.1',
        startedAt: 100 + index,
      })
    }

    expect((await store.list(instancePath)).map(record => record.launchId)).toEqual(launchIds.slice(1).reverse())
    await expect(store.get(instancePath, launchIds[0])).resolves.toBeUndefined()
  })
})