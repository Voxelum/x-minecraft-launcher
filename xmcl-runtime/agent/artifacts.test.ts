import { mkdtemp, rm } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, test } from 'vitest'
import { AgentArtifactStore } from './artifacts'

const roots: string[] = []

async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-agent-artifacts-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('AgentArtifactStore', () => {
  test('writes, lists, pages, greps and resets conversation artifacts', async () => {
    const store = new AgentArtifactStore(await tempRoot())
    const key = { agentId: 'launcher' as const, scope: '/instance/a' }
    const otherKey = { agentId: 'launcher' as const, scope: '/instance/b' }
    const artifact = await store.write(key, 'alpha\nbeta match\ngamma MATCH\nomega', 'modrinth_tags')

    expect(artifact.path).toMatch(/^artifacts\/modrinth-tags-.+\.txt$/)
    expect(await store.list(key)).toMatchObject([{ path: artifact.path, length: 34 }])
    await expect(store.read(otherKey, artifact.path)).rejects.toThrow()
    await expect(store.read(key, '../history.json')).rejects.toThrow('Not an Agent artifact path')
    await expect(store.read(key, 'artifacts/../history.json')).rejects.toThrow('Invalid Agent artifact path')

    expect(await store.read(key, artifact.path, 0, 5)).toMatchObject({ content: 'alpha', offset: 0, limit: 5, hasMore: true })
    expect(await store.grep(key, artifact.path, 'match', true, 1, 1)).toMatchObject({
      totalMatches: 2,
      hasMore: false,
      matches: [{ line: 3, text: 'gamma MATCH' }],
    })

    await store.reset(key)
    expect(await store.list(key)).toEqual([])
  })

  test('archives artifacts away from the new active conversation and can restore them', async () => {
    const store = new AgentArtifactStore(await tempRoot())
    const key = { agentId: 'launcher' as const, scope: '/instance/a' }
    const artifact = await store.write(key, 'keep me', 'test')

    expect(await store.archive(key, 'archive-id')).toBe(true)
    expect(await store.list(key)).toEqual([])

    expect(await store.restoreArchive(key, 'archive-id')).toBe(true)
    expect(await store.read(key, artifact.path)).toMatchObject({ content: 'keep me' })
  })

  test('shows match context when grepping a minified JSON artifact', async () => {
    const store = new AgentArtifactStore(await tempRoot())
    const key = { agentId: 'launcher' as const, scope: '/instance/a' }
    const content = `{"padding":"${'x'.repeat(500)}","mods":[{"name":"Iris Shaders","enabled":true}]}`
    const artifact = await store.write(key, content, 'vfs_list')

    const result = await store.grep(key, artifact.path, 'iris', true)

    expect(result).toMatchObject({ totalMatches: 1, matches: [{ line: 1 }] })
    expect(result.matches[0].text).toContain('Iris Shaders')
    expect(result.matches[0].text).not.toContain('"padding"')
    expect(result.matches[0].text.length).toBeLessThanOrEqual(400)
  })
})