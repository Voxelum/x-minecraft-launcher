import { MockAgent, fetch as _fetch } from 'undici'
import { describe, expect, test } from 'vitest'
import { CurseforgeV1Client } from './index'

describe('CurseforgeV1Client', () => {
  const agent = new MockAgent()
  const fetch: typeof globalThis.fetch = (input, init) => {
    init = Object.assign(init || {}, {
      dispatcher: agent,
    })
    return _fetch(input as any, init as any) as any
  }

  test('#constructor', () => {
    const headers = { hello: 'world' }
    const client = new CurseforgeV1Client('key', { headers, baseUrl: 'https://test.url' })
    expect((client as any).baseUrl).toEqual('https://test.url')
    expect((client as any).headers).toEqual({
      'x-api-key': 'key',
      hello: 'world',
    })
    expect((client as any).dispatcher).toEqual(undefined)
  })
  test('#getMod', async () => {
    const mockPool = agent.get('https://api.curseforge.com')
    mockPool
      .intercept({
        path: '/v1/mods/310806',
        headers: { 'x-api-key': 'key' },
      })
      .reply(200, { data: 'hello' })
    const client = new CurseforgeV1Client('key', { fetch })
    const result = await client.getMod(310806)
    expect(result).toEqual('hello')
  })
  test('#getModDescription', async () => {
    const mockPool = agent.get('https://api.curseforge.com')
    mockPool
      .intercept({
        path: '/v1/mods/310806/description',
        headers: { 'x-api-key': 'key' },
      })
      .reply(200, { data: 'description' })
    const client = new CurseforgeV1Client('key', { fetch })
    const result = await client.getModDescription(310806)
    expect(result).toEqual('description')
  })
  test('#getModFile', async () => {
    const mockPool = agent.get('https://api.curseforge.com')
    mockPool
      .intercept({
        path: '/v1/mods/310806/files/2657461',
        headers: { 'x-api-key': 'key' },
      })
      .reply(200, { data: 'file' })
    const client = new CurseforgeV1Client('key', { fetch })
    const result = await client.getModFile(310806, 2657461)
    expect(result).toEqual('file')
  })
  test('#getMods', async () => {
    const mockPool = agent.get('https://api.curseforge.com')
    mockPool
      .intercept({
        method: 'POST',
        body: JSON.stringify({ modIds: [310806] }),
        path: '/v1/mods',
        headers: { 'x-api-key': 'key', accept: 'application/json' },
      })
      .reply(200, { data: '[]' })
    const client = new CurseforgeV1Client('key', { fetch })
    const result = await client.getMods([310806])
    expect(result).toEqual('[]')
  })
  test('#getFiles', async () => {
    const mockPool = agent.get('https://api.curseforge.com')
    mockPool
      .intercept({
        method: 'POST',
        body: JSON.stringify({ fileIds: [2657461] }),
        path: '/v1/mods/files',
        headers: { 'x-api-key': 'key' },
      })
      .reply(200, { data: '[]' })
    const client = new CurseforgeV1Client('key', { fetch })
    const result = await client.getFiles([2657461])
    expect(result).toEqual('[]')
  })
  test('#getCategories', async () => {
    const mockPool = agent.get('https://api.curseforge.com')
    mockPool
      .intercept({
        path: '/v1/categories',
        query: { gameId: '432' },
        headers: { 'x-api-key': 'key' },
      })
      .reply(200, { data: '[]' })
    const client = new CurseforgeV1Client('key', { fetch })
    const result = await client.getCategories()
    expect(result).toEqual('[]')
  })
  test('#getCategories', async () => {
    const mockPool = agent.get('https://api.curseforge.com')
    mockPool
      .intercept({
        path: '/v1/categories',
        query: { gameId: '432' },
        headers: { 'x-api-key': 'key' },
      })
      .reply(200, { data: '[]' })
    const client = new CurseforgeV1Client('key', { fetch })
    const result = await client.getCategories()
    expect(result).toEqual('[]')
  })
  test('#getModFiles', async () => {
    const mockPool = agent.get('https://api.curseforge.com')
    mockPool
      .intercept({
        path: '/v1/mods/310806/files',
        headers: { 'x-api-key': 'key' },
        query: {
          gameVersion: '',
          gameVersionTypeId: '',
          index: '',
          pageSize: '',
        },
      })
      .reply(200, { data: [] })
    const client = new CurseforgeV1Client('key', { fetch })
    const result = await client.getModFiles({ modId: 310806 })
    expect(result).toStrictEqual({ data: [] })
  })
  test('#searchMods', async () => {
    const mockPool = agent.get('https://api.curseforge.com')
    mockPool
      .intercept({
        path: '/v1/mods/search',
        headers: { 'x-api-key': 'key' },
        query: {
          gameId: '432',
          sortField: '2',
          sortOrder: 'desc',
          index: '0',
          pageSize: '25',
        },
      })
      .reply(200, { data: [] })
    const client = new CurseforgeV1Client('key', { fetch })
    const result = await client.searchMods({})
    expect(result).toStrictEqual({ data: [] })
  })
})
