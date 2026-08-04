import type { LaunchHistoryRecord } from '@xmcl/runtime-api'
import { writeFile as writeAtomically } from 'atomically'
import { createHash } from 'crypto'
import { copyFile, ensureDir, pathExists, readFile, readdir, rm, stat, writeFile } from 'fs-extra'
import { join, resolve } from 'path'

const MAX_LAUNCHES_PER_INSTANCE = 3
const evidenceNames = ['game.log', 'debug.log', 'crash-report.txt', 'launcher-output.log'] as const
type EvidenceName = typeof evidenceNames[number]
const launchIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function instanceKey(instancePath: string) {
  const normalized = resolve(instancePath).replace(/\\/g, '/')
  return createHash('sha256').update(process.platform === 'win32' ? normalized.toLowerCase() : normalized).digest('hex')
}

function assertLaunchId(launchId: string) {
  if (!launchIdPattern.test(launchId)) throw new Error(`Invalid launch id: ${launchId}`)
}

export class LaunchHistoryStore {
  private updates = new Map<string, Promise<unknown>>()

  constructor(private root: string) {}

  private update<T>(launchId: string, operation: () => Promise<T>) {
    const previous = this.updates.get(launchId) ?? Promise.resolve()
    const next = previous.catch(() => {}).then(operation)
    this.updates.set(launchId, next)
    const cleanup = () => {
      if (this.updates.get(launchId) === next) this.updates.delete(launchId)
    }
    void next.then(cleanup, cleanup)
    return next
  }

  private instanceRoot(instancePath: string) {
    return join(this.root, instanceKey(instancePath))
  }

  private launchRoot(instancePath: string, launchId: string) {
    assertLaunchId(launchId)
    return join(this.instanceRoot(instancePath), launchId)
  }

  private manifestPath(instancePath: string, launchId: string) {
    return join(this.launchRoot(instancePath, launchId), 'launch.json')
  }

  private liveGameLogPath(instancePath: string, record: LaunchHistoryRecord) {
    return record.side === 'server'
      ? join(instancePath, 'server', 'logs', 'latest.log')
      : join(instancePath, 'logs', 'latest.log')
  }

  private launchesOverlap(record: LaunchHistoryRecord, other: LaunchHistoryRecord) {
    const recordEnd = record.endedAt ?? Number.POSITIVE_INFINITY
    const otherEnd = other.endedAt ?? Number.POSITIVE_INFINITY
    return record.startedAt <= otherEnd && other.startedAt <= recordEnd
  }

  private async resolveLiveEvidence(instancePath: string, records: LaunchHistoryRecord[]) {
    await Promise.all(records.map(async (record) => {
      if (record.state !== 'running' || record.evidence.gameLog !== 'absent') return
      if (records.some(other => other.launchId !== record.launchId && this.launchesOverlap(record, other))) {
        record.evidence.gameLog = 'ambiguous'
        return
      }
      const modifiedAt = await stat(this.liveGameLogPath(instancePath, record)).then(value => value.mtimeMs).catch(() => undefined)
      if (modifiedAt !== undefined && modifiedAt >= record.startedAt) record.evidence.gameLog = 'available'
    }))
    return records
  }

  private async writeManifest(instancePath: string, record: LaunchHistoryRecord) {
    const path = this.manifestPath(instancePath, record.launchId)
    await ensureDir(this.launchRoot(instancePath, record.launchId))
    await writeAtomically(path, JSON.stringify(record, undefined, 2))
  }

  async begin(instancePath: string, record: Omit<LaunchHistoryRecord, 'state' | 'evidence'>) {
    return this.update(record.launchId, async () => {
      const launch: LaunchHistoryRecord = {
        ...record,
        state: 'running',
        evidence: {
          gameLog: 'absent',
          debugLog: 'absent',
          crashReport: 'absent',
          launcherOutput: 'absent',
        },
      }
      await this.writeManifest(instancePath, launch)
      await this.prune(instancePath)
      return launch
    })
  }

  async markReady(instancePath: string, launchId: string, readyAt: number) {
    return this.update(launchId, async () => {
      const record = await this.get(instancePath, launchId)
      if (!record) return
      record.readyAt = readyAt
      await this.writeManifest(instancePath, record)
    })
  }

  async complete(instancePath: string, launchId: string, result: {
    endedAt: number
    exitCode?: number
    signal?: string
    crashed: boolean
    crashReportPath?: string
    crashReport?: string
    launcherOutput?: string
    gameLogPath?: string
    debugLogPath?: string
    gameLogAmbiguous: boolean
  }) {
    return this.update(launchId, async () => {
      const record = await this.get(instancePath, launchId)
      if (!record) return
      const root = this.launchRoot(instancePath, launchId)
      if (result.launcherOutput) {
        await writeFile(join(root, 'launcher-output.log'), result.launcherOutput, 'utf8')
        record.evidence.launcherOutput = 'available'
      }
      if (result.crashReportPath && await pathExists(result.crashReportPath)) {
        await copyFile(result.crashReportPath, join(root, 'crash-report.txt'))
        record.evidence.crashReport = 'available'
      } else if (result.crashReport) {
        await writeFile(join(root, 'crash-report.txt'), result.crashReport, 'utf8')
        record.evidence.crashReport = 'available'
      }
      if (result.gameLogAmbiguous) {
        record.evidence.gameLog = 'ambiguous'
        record.evidence.debugLog = 'ambiguous'
      } else if (result.gameLogPath && await pathExists(result.gameLogPath)) {
        await copyFile(result.gameLogPath, join(root, 'game.log'))
        record.evidence.gameLog = 'available'
      }
      if (!result.gameLogAmbiguous && result.debugLogPath && await pathExists(result.debugLogPath)) {
        await copyFile(result.debugLogPath, join(root, 'debug.log'))
        record.evidence.debugLog = 'available'
      }
      record.state = 'exited'
      record.endedAt = result.endedAt
      record.exitCode = result.exitCode
      record.signal = result.signal
      record.crashed = result.crashed
      await this.writeManifest(instancePath, record)
    })
  }

  async list(instancePath: string) {
    const ids = await readdir(this.instanceRoot(instancePath)).catch(() => [])
    const records = await Promise.all(ids.filter(id => launchIdPattern.test(id)).map(id => this.get(instancePath, id)))
    const sorted = records
      .filter((record): record is LaunchHistoryRecord => !!record)
      .sort((a, b) => b.startedAt - a.startedAt)
    return this.resolveLiveEvidence(instancePath, sorted)
  }

  async get(instancePath: string, launchId: string): Promise<LaunchHistoryRecord | undefined> {
    const raw = await readFile(this.manifestPath(instancePath, launchId), 'utf8').catch(() => '')
    if (!raw) return undefined
    try {
      const record = JSON.parse(raw) as LaunchHistoryRecord
      return record.launchId === launchId ? record : undefined
    } catch {
      return undefined
    }
  }

  async readEvidence(instancePath: string, launchId: string, name: EvidenceName) {
    if (!evidenceNames.includes(name)) throw new Error(`Unknown launch evidence: ${name}`)
    const snapshot = await readFile(join(this.launchRoot(instancePath, launchId), name), 'utf8').catch(() => '')
    if (snapshot || name !== 'game.log') return snapshot
    const record = (await this.list(instancePath)).find(value => value.launchId === launchId)
    if (record?.state !== 'running' || record.evidence.gameLog !== 'available') return ''
    return readFile(this.liveGameLogPath(instancePath, record), 'utf8').catch(() => '')
  }

  async findByCrashReport(instancePath: string, content: string) {
    if (!content) return undefined
    const records = await this.list(instancePath)
    for (const record of records) {
      if (record.evidence.crashReport !== 'available') continue
      if (await this.readEvidence(instancePath, record.launchId, 'crash-report.txt') === content) return record
    }
    return undefined
  }

  private async prune(instancePath: string) {
    const records = await this.list(instancePath)
    await Promise.all(records.slice(MAX_LAUNCHES_PER_INSTANCE).map(record =>
      rm(this.launchRoot(instancePath, record.launchId), { recursive: true, force: true }),
    ))
  }
}