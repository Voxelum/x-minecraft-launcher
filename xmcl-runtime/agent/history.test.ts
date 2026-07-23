import { appendFile, mkdtemp, readdir, rm } from 'fs-extra'
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
    await store.updateContext(key, { locale: 'zh' })
    expect(await store.load(key)).toMatchObject({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ],
      context: { locale: 'zh' },
    })

    await store.reset(key)
    expect((await store.load(key)).messages).toEqual([])
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
})
