import type { AgentConversation, AgentConversationKey, AgentMessage, LegacyConversationImport } from '@xmcl/runtime-api'
import { createHash, randomUUID } from 'crypto'
import { appendFile, ensureDir, readFile, rename, rm, stat, writeFile } from 'fs-extra'
import { dirname, join } from 'path'

type SessionRecord = {
  v: 1
  type: 'session'
  agentId: AgentConversationKey['agentId']
  scope: string
  sessionId: string
  createdAt: number
  promptVersion: 1
  context?: Record<string, unknown>
}

type MessageRecord = {
  v: 1
  type: 'message'
  seq: number
  at: number
  message: AgentMessage
}

type HistoryRecord = SessionRecord | MessageRecord
const MAX_FILE_SIZE = 1024 * 1024
const MAX_RECORDS = 200

function keyId(key: AgentConversationKey) {
  return createHash('sha256').update(`${key.agentId}\0${key.scope}`).digest('hex')
}

function maxMessages(key: AgentConversationKey) {
  return key.agentId === 'css' ? 80 : 120
}

function parseRecords(raw: string): HistoryRecord[] {
  const records: HistoryRecord[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const record = JSON.parse(line)
      if (record?.v === 1 && (record.type === 'session' || record.type === 'message')) records.push(record)
    } catch {
      // A crash can leave one incomplete tail line.
    }
  }
  return records
}

function keepCompleteTail(messages: AgentMessage[], limit: number) {
  if (messages.length <= limit) return messages
  let start = messages.length - limit
  if (messages[start]?.role === 'tool') {
    while (start > 0 && messages[start - 1]?.role !== 'assistant') start--
    if (start > 0) start--
  }
  return messages.slice(start)
}

export class AgentHistoryStore {
  private queues = new Map<string, Promise<void>>()

  constructor(private root: string, private warn: (message: string) => void) {}

  private path(key: AgentConversationKey) {
    return join(this.root, key.agentId, `${keyId(key)}.jsonl`)
  }

  private queue(key: AgentConversationKey, task: () => Promise<void>) {
    const id = keyId(key)
    const previous = this.queues.get(id) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(task)
    this.queues.set(id, next)
    return next.finally(() => {
      if (this.queues.get(id) === next) this.queues.delete(id)
    })
  }

  async load(key: AgentConversationKey): Promise<AgentConversation> {
    const raw = await readFile(this.path(key), 'utf8').catch(() => '')
    const records = parseRecords(raw)
    const session = records.find((record): record is SessionRecord => record.type === 'session')
    const messages = records
      .filter((record): record is MessageRecord => record.type === 'message')
      .sort((a, b) => a.seq - b.seq)
      .map(record => record.message)
    const last = records.at(-1)
    return {
      key,
      messages,
      context: session?.context,
      updatedAt: last?.type === 'message' ? last.at : session?.createdAt,
    }
  }

  async ensureSession(key: AgentConversationKey, context?: Record<string, unknown>) {
    return this.queue(key, async () => {
      const file = this.path(key)
      const existing = parseRecords(await readFile(file, 'utf8').catch(() => ''))
      if (existing.some(record => record.type === 'session')) return
      await ensureDir(dirname(file))
      const record: SessionRecord = {
        v: 1,
        type: 'session',
        agentId: key.agentId,
        scope: key.scope,
        sessionId: randomUUID(),
        createdAt: Date.now(),
        promptVersion: 1,
        context,
      }
      await appendFile(file, `${JSON.stringify(record)}\n`, 'utf8')
    })
  }

  async appendMessage(key: AgentConversationKey, message: AgentMessage) {
    return this.queue(key, async () => {
      const file = this.path(key)
      await ensureDir(dirname(file))
      let records = parseRecords(await readFile(file, 'utf8').catch(() => ''))
      if (!records.some(record => record.type === 'session')) {
        const session: SessionRecord = {
          v: 1,
          type: 'session',
          agentId: key.agentId,
          scope: key.scope,
          sessionId: randomUUID(),
          createdAt: Date.now(),
          promptVersion: 1,
        }
        await appendFile(file, `${JSON.stringify(session)}\n`, 'utf8')
        records = [session]
      }
      const seq = records.reduce((value, record) => record.type === 'message' ? Math.max(value, record.seq) : value, 0) + 1
      const record: MessageRecord = { v: 1, type: 'message', seq, at: Date.now(), message }
      await appendFile(file, `${JSON.stringify(record)}\n`, 'utf8')
      const size = await stat(file).then(value => value.size, () => 0)
      if (records.length + 1 > MAX_RECORDS || size > MAX_FILE_SIZE) await this.compactUnlocked(key)
    })
  }

  async importLegacy(input: LegacyConversationImport): Promise<'imported' | 'exists'> {
    let result: 'imported' | 'exists' = 'exists'
    await this.queue(input.key, async () => {
      const file = this.path(input.key)
      if (await readFile(file, 'utf8').then(raw => parseRecords(raw).length > 0, () => false)) return
      await ensureDir(dirname(file))
      const session: SessionRecord = {
        v: 1,
        type: 'session',
        agentId: input.key.agentId,
        scope: input.key.scope,
        sessionId: randomUUID(),
        createdAt: input.updatedAt ?? Date.now(),
        promptVersion: 1,
        context: input.context,
      }
      const messages = keepCompleteTail(input.messages, maxMessages(input.key))
      const lines = [
        JSON.stringify(session),
        ...messages.map((message, index) => JSON.stringify({
          v: 1,
          type: 'message',
          seq: index + 1,
          at: input.updatedAt ?? Date.now(),
          message,
        } satisfies MessageRecord)),
      ]
      await writeFile(file, `${lines.join('\n')}\n`, 'utf8')
      result = 'imported'
    })
    return result
  }

  async reset(key: AgentConversationKey) {
    return this.queue(key, () => rm(this.path(key), { force: true }))
  }

  async updateContext(key: AgentConversationKey, context: Record<string, unknown>) {
    return this.queue(key, async () => {
      const file = this.path(key)
      const records = parseRecords(await readFile(file, 'utf8').catch(() => ''))
      const session = records.find((record): record is SessionRecord => record.type === 'session')
      if (!session) return
      session.context = context
      const temp = `${file}.${process.pid}.tmp`
      await writeFile(temp, `${records.map(record => JSON.stringify(record)).join('\n')}\n`, 'utf8')
      await rename(temp, file)
    })
  }

  private async compactUnlocked(key: AgentConversationKey) {
    const file = this.path(key)
    const records = parseRecords(await readFile(file, 'utf8').catch(() => ''))
    const session = records.find((record): record is SessionRecord => record.type === 'session')
    if (!session) return
    const messages = keepCompleteTail(
      records.filter((record): record is MessageRecord => record.type === 'message').map(record => record.message),
      maxMessages(key),
    )
    const lines = [
      JSON.stringify(session),
      ...messages.map((message, index) => JSON.stringify({
        v: 1,
        type: 'message',
        seq: index + 1,
        at: Date.now(),
        message,
      } satisfies MessageRecord)),
    ]
    const temp = `${file}.${process.pid}.tmp`
    await writeFile(temp, `${lines.join('\n')}\n`, 'utf8')
    await rename(temp, file).catch(async (error) => {
      this.warn(`Failed to compact agent history ${file}: ${String(error)}`)
      await rm(temp, { force: true })
    })
  }
}
