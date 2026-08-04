import { appendFile, mkdtemp, readFile, readdir, rm } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, test } from 'vitest'
import { AgentHistoryStore } from './history'

const roots: string[] = []

async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-agent-history-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('AgentHistoryStore', () => {
  test('imports, appends, updates context and resets a conversation', async () => {
    const root = await tempRoot()
    const store = new AgentHistoryStore(root, () => undefined)
    const key = { agentId: 'launcher' as const, scope: '/instance' }

    expect(await store.importLegacy({
      key,
      messages: [{ role: 'user', content: 'hello' }],
      context: { locale: 'en' },
    })).toBe('imported')
    expect(await store.importLegacy({ key, messages: [] })).toBe('exists')

    await store.appendMessage(key, { role: 'assistant', content: 'hi' })
    await store.updateContext(key, { locale: 'zh', systemPrompt: 'frozen prompt' })
    await store.updateContext(key, { page: '/mods' })
    expect(await store.load(key)).toMatchObject({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ],
      context: { locale: 'zh', systemPrompt: 'frozen prompt', page: '/mods' },
    })

    await store.reset(key)
    expect((await store.load(key)).messages).toEqual([])
  })

  test('creates a session when context arrives before the first message', async () => {
    const root = await tempRoot()
    const store = new AgentHistoryStore(root, () => undefined)
    const key = { agentId: 'launcher' as const, scope: '/instance' }

    await store.updateContext(key, { systemPrompt: 'first prompt' })

    expect(await store.load(key)).toMatchObject({
      messages: [],
      context: { systemPrompt: 'first prompt' },
    })
  })

  test('isolates conversations and metadata by instance scope', async () => {
    const root = await tempRoot()
    const store = new AgentHistoryStore(root, () => undefined)
    const first = { agentId: 'launcher' as const, scope: '/instances/first' }
    const second = { agentId: 'launcher' as const, scope: '/instances/second' }

    await store.updateContext(first, { systemPrompt: 'first prompt' })
    await store.appendMessage(first, { role: 'user', content: 'first message' })
    await store.updateContext(second, { systemPrompt: 'second prompt' })
    await store.appendMessage(second, { role: 'user', content: 'second message' })

    expect(await store.load(first)).toMatchObject({
      context: { systemPrompt: 'first prompt' },
      messages: [{ content: 'first message' }],
    })
    expect(await store.load(second)).toMatchObject({
      context: { systemPrompt: 'second prompt' },
      messages: [{ content: 'second message' }],
    })
  })

  test('ignores a malformed trailing line', async () => {
    const root = await tempRoot()
    const store = new AgentHistoryStore(root, () => undefined)
    const key = { agentId: 'css' as const, scope: 'global' }
    await store.importLegacy({ key, messages: [{ role: 'user', content: 'keep me' }] })
    const [dir] = await readdir(join(root, 'css'))
    await appendFile(join(root, 'css', dir), '{"broken":')
    expect((await store.load(key)).messages).toEqual([{ role: 'user', content: 'keep me' }])
  })

  test('archives the old conversation while starting with an empty active history', async () => {
    const root = await tempRoot()
    const store = new AgentHistoryStore(root, () => undefined)
    const key = { agentId: 'launcher' as const, scope: '/instance' }
    await store.appendMessage(key, { role: 'user', content: 'keep me' })

    expect(await store.archive(key, 'archive-id')).toBe(true)
    expect((await store.load(key)).messages).toEqual([])
    const archived = (await readdir(join(root, 'launcher', 'archive'), { recursive: true }))
      .find(path => String(path).endsWith('.jsonl'))
    expect(await readFile(join(root, 'launcher', 'archive', String(archived)), 'utf8')).toContain('keep me')

    expect(await store.restoreArchive(key, 'archive-id')).toBe(true)
    expect((await store.load(key)).messages).toEqual([{ role: 'user', content: 'keep me' }])
  })

  test('replaces messages while preserving the session context', async () => {
    const root = await tempRoot()
    const store = new AgentHistoryStore(root, () => undefined)
    const key = { agentId: 'launcher' as const, scope: '/instance' }
    await store.importLegacy({
      key,
      messages: [{ role: 'user', content: 'old history' }],
      context: { locale: 'zh' },
    })

    await store.replaceMessages(key, [
      { role: 'system', name: 'compaction', content: 'checkpoint', compaction: { tokensBefore: 256_000 } },
      { role: 'user', content: 'recent turn' },
    ])

    expect(await store.load(key)).toMatchObject({
      context: { locale: 'zh' },
      messages: [
        { role: 'system', name: 'compaction', content: 'checkpoint', compaction: { tokensBefore: 256_000 } },
        { role: 'user', content: 'recent turn' },
      ],
    })
  })

  test('preserves a compaction checkpoint when trimming imported history', async () => {
    const root = await tempRoot()
    const store = new AgentHistoryStore(root, () => undefined)
    const key = { agentId: 'launcher' as const, scope: '/instance' }
    const checkpoint = { role: 'system' as const, name: 'compaction', content: 'checkpoint', compaction: { tokensBefore: 256_001 } }
    const messages = [
      checkpoint,
      ...Array.from({ length: 130 }, (_, index) => ({ role: 'user' as const, content: `message-${index}` })),
    ]

    await store.importLegacy({ key, messages })

    const loaded = await store.load(key)
    expect(loaded.messages).toHaveLength(120)
    expect(loaded.messages[0]).toEqual(checkpoint)
    expect(loaded.messages.at(-1)).toEqual({ role: 'user', content: 'message-129' })
  })
})
