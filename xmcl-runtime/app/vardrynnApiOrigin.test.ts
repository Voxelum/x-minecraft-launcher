import { describe, expect, it, vi } from 'vitest'
import {
  VARDRYNN_SERVICE_UNCONFIGURED,
  fetchVardrynnServiceStatus,
  requireVardrynnApiOrigin,
  resolveVardrynnApiOrigin,
} from './vardrynnApiOrigin'

describe('resolveVardrynnApiOrigin', () => {
  it('normalizes a HTTPS origin', () => {
    expect(resolveVardrynnApiOrigin('https://edge.example.test///')).toBe('https://edge.example.test')
  })

  it('is unconfigured without a value and does not report it as invalid', () => {
    const onInvalid = vi.fn()
    expect(resolveVardrynnApiOrigin('', { onInvalid })).toBeUndefined()
    expect(resolveVardrynnApiOrigin(undefined, { onInvalid })).toBeUndefined()
    expect(onInvalid).not.toHaveBeenCalled()
  })

  it.each([
    'http://example.test',
    'https://example.test/api',
    'https://user:secret@example.test',
    'https://example.test?a=1',
    'not a url',
    'https://api.xmcl.app',
    'https://signaling.xmcl.app.',
    'https://xmcl-core-api.azurewebsites.net',
  ])('rejects %s without any fallback', (value) => {
    const onInvalid = vi.fn()
    expect(resolveVardrynnApiOrigin(value, { onInvalid })).toBeUndefined()
    expect(onInvalid).toHaveBeenCalledOnce()
  })

  it('accepts HTTP only on loopback and only for development', () => {
    expect(resolveVardrynnApiOrigin('http://127.0.0.1:8787', { allowLoopback: true })).toBe('http://127.0.0.1:8787')
    expect(resolveVardrynnApiOrigin('http://127.0.0.1:8787')).toBeUndefined()
    expect(resolveVardrynnApiOrigin('http://example.test', { allowLoopback: true })).toBeUndefined()
  })
})

describe('requireVardrynnApiOrigin', () => {
  it('fails with a stable code when unconfigured', () => {
    expect(() => requireVardrynnApiOrigin({})).toThrow(VARDRYNN_SERVICE_UNCONFIGURED)
  })
})

describe('fetchVardrynnServiceStatus', () => {
  const origin = 'https://edge.example.test'

  it('makes no request when unconfigured', async () => {
    const fetch = vi.fn()
    await expect(fetchVardrynnServiceStatus(fetch, undefined)).resolves.toEqual({ state: 'unconfigured' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requests the versioned path and refuses redirects', async () => {
    const fetch = vi.fn(async () => Response.json({ apiVersion: 'v1', state: 'ok' }))
    await expect(fetchVardrynnServiceStatus(fetch, origin)).resolves.toEqual({ state: 'ok' })
    expect(fetch).toHaveBeenCalledWith(
      new URL('https://edge.example.test/v1/status'),
      expect.objectContaining({ redirect: 'error' }),
    )
  })

  it.each([
    ['a network failure', async () => { throw new Error('offline') }, 'unreachable'],
    ['a server error', async () => new Response('', { status: 503 }), 'unreachable'],
    ['a missing route', async () => new Response('', { status: 404 }), 'incompatible'],
    ['a malformed body', async () => new Response('<html>'), 'incompatible'],
  ])('reports %s', async (_, fetch, state) => {
    await expect(fetchVardrynnServiceStatus(fetch, origin)).resolves.toEqual({ state })
  })
})
