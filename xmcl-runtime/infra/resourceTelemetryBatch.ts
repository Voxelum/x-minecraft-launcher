import type { ResourceDomain } from '@xmcl/resource'
import type { ModMetadataFacts } from '@xmcl/runtime-api'

export interface ResourceTracingPayload {
  name?: string
  sha1: string
  domain?: ResourceDomain
  forge?: {
    modId: string
    version: string
  }
  fabric?: {
    modId: string
    version: string
  }[]
  neoforge?: {
    modId: string
    version: string
  }
  quilt?: {
    modId: string
    version: string
  }
  curseforge?: {
    projectId: number
    fileId: number
  }
  modrinth?: {
    projectId: string
    versionId: string
  }
}

export interface ResourceTelemetryItem {
  message: string
  payload: ResourceTracingPayload
  properties?: Record<string, string>
}

function includesFact<T>(facts: T[], expected: T, equals: (left: T, right: T) => boolean) {
  return facts.some((fact) => equals(fact, expected))
}

export function isResourceTelemetryPayloadKnown(payload: ResourceTracingPayload, facts: ModMetadataFacts | undefined) {
  if (!facts) return false
  // The harvester keeps the first non-empty filename, so renamed copies of the
  // same JAR do not represent new database information.
  if (payload.name && !facts.name) return false
  if (payload.domain && payload.domain !== facts.domain) return false
  if (payload.forge && !includesFact(
    facts.forge,
    { id: payload.forge.modId, version: payload.forge.version },
    (left, right) => left.id === right.id && left.version === right.version,
  )) return false
  if (payload.fabric?.some((fabric) => !includesFact(
    facts.fabric,
    { id: fabric.modId, version: fabric.version },
    (left, right) => left.id === right.id && left.version === right.version,
  ))) return false
  if (payload.modrinth && !includesFact(
    facts.modrinth,
    { id: payload.modrinth.projectId, version: payload.modrinth.versionId },
    (left, right) => left.id === right.id && left.version === right.version,
  )) return false
  if (payload.curseforge && !includesFact(
    facts.curseforge,
    { id: payload.curseforge.projectId, file: payload.curseforge.fileId },
    (left, right) => left.id === right.id && left.file === right.file,
  )) return false

  // The database does not store these loaders yet, so preserve their telemetry.
  if (payload.neoforge || payload.quilt) return false
  return true
}

export class ResourceTelemetryBatch {
  private readonly pending = new Map<string, ResourceTelemetryItem>()
  private readonly seen = new Set<string>()
  private timer: NodeJS.Timeout | undefined
  private flushing = Promise.resolve()
  private disposed = false

  constructor(
    private readonly lookup: (sha1s: string[]) => Promise<ModMetadataFacts[] | undefined>,
    private readonly send: (item: ResourceTelemetryItem) => void,
    private readonly onLookupError: (error: unknown) => void,
    private readonly debounceMs = 1_000,
    private readonly maxBatchSize = 256,
  ) {
  }

  enqueue(payload: ResourceTracingPayload, properties?: Record<string, string>) {
    if (this.disposed) return
    const message = JSON.stringify(payload)
    if (this.seen.has(message)) return
    this.seen.add(message)
    this.pending.set(message, { message, payload, properties })

    if (this.pending.size >= this.maxBatchSize) {
      void this.flush()
      return
    }
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.flush()
    }, this.debounceMs)
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    if (this.pending.size === 0) return this.flushing

    const items = [...this.pending.values()]
    this.pending.clear()
    this.flushing = this.flushing.then(() => this.sendBatch(items))
    return this.flushing
  }

  async dispose() {
    this.disposed = true
    await this.flush()
  }

  private async sendBatch(items: ResourceTelemetryItem[]) {
    let facts: ModMetadataFacts[] | undefined
    try {
      facts = await this.lookup([...new Set(items.map((item) => item.payload.sha1))])
    } catch (error) {
      this.onLookupError(error)
    }
    const factsBySha1 = new Map(facts?.map((entry) => [entry.sha1, entry]))
    for (const item of items) {
      if (!isResourceTelemetryPayloadKnown(item.payload, factsBySha1.get(item.payload.sha1))) {
        this.send(item)
      }
    }
  }
}
