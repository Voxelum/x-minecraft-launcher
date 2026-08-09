import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { AgentDocumentStore } from './documents'

const shaderpackDocument = `---
id: shaderpack-enable
description: Evaluate the GPU and configure a compatible shader implementation.
tags: [shaderpack, gpu, iris]
---
# First version
`

describe('AgentDocumentStore', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'xmcl-agent-documents-'))
    await writeFile(join(directory, 'shaderpack-enable.md'), shaderpackDocument)
    await writeFile(join(directory, 'ignored.json'), '{ invalid json')
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  test('lists and searches frontmatter metadata without returning the body', async () => {
    const store = new AgentDocumentStore(directory)
    await expect(store.list()).resolves.toEqual([
      expect.objectContaining({
        id: 'shaderpack-enable',
        description: 'Evaluate the GPU and configure a compatible shader implementation.',
      }),
    ])
    await expect(store.search('gpu iris')).resolves.toEqual([
      expect.objectContaining({ id: 'shaderpack-enable', score: expect.any(Number) }),
    ])
    expect((await store.list())[0]).not.toHaveProperty('title')
    expect((await store.list())[0]).not.toHaveProperty('tags')
    expect((await store.list())[0]).not.toHaveProperty('body')
  })

  test('reads bodies without frontmatter and without caching files', async () => {
    const store = new AgentDocumentStore(directory)
    await expect(store.read('shaderpack-enable')).resolves.toMatchObject({ body: '# First version\n' })
    await writeFile(join(directory, 'shaderpack-enable.md'), shaderpackDocument.replace('First version', 'Updated version'))
    await expect(store.read('shaderpack-enable')).resolves.toMatchObject({ body: '# Updated version\n' })
  })

  test('rejects invalid frontmatter', async () => {
    await writeFile(join(directory, 'invalid.md'), '---\nid: invalid\n---\nBody\n')
    const store = new AgentDocumentStore(directory)
    await expect(store.list()).rejects.toThrow('has no description')
  })

  test('rejects document ids that are not kebab-case', async () => {
    await writeFile(join(directory, 'invalid.md'), '---\nid: invalid.id\ndescription: Invalid id.\ntags: []\n---\nBody\n')
    const store = new AgentDocumentStore(directory)
    await expect(store.list()).rejects.toThrow('id must use kebab-case')
  })

  test('rejects Markdown without frontmatter', async () => {
    await writeFile(join(directory, 'missing.md'), '# Missing frontmatter\n')
    const store = new AgentDocumentStore(directory)
    await expect(store.list()).rejects.toThrow('has no valid frontmatter')
  })

  test('rejects duplicate ids across Markdown files', async () => {
    await writeFile(join(directory, 'duplicate.md'), shaderpackDocument)
    const store = new AgentDocumentStore(directory)
    await expect(store.list()).rejects.toThrow('Duplicate Agent document id')
  })
})