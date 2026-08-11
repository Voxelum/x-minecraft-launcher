import { describe, expect, test, vi } from 'vitest'
import { isReplayableFetchBody, splitFetchBody } from './fetchBody'

async function readBody(body: ReadableStream<Uint8Array>) {
  return new TextDecoder().decode(await new Response(body).arrayBuffer())
}

describe('splitFetchBody', () => {
  test('creates independent request streams for the primary and fallback fetches', async () => {
    const body = new Blob(['request body']).stream()
    const pair = splitFetchBody(body)

    await expect(readBody(pair.primary as ReadableStream<Uint8Array>)).resolves.toBe('request body')
    await expect(readBody(pair.fallback as ReadableStream<Uint8Array>)).resolves.toBe('request body')
  })

  test('reuses replayable bodies without copying them', async () => {
    const body = 'request body'
    const pair = splitFetchBody(body)

    expect(pair.primary).toBe(body)
    expect(pair.fallback).toBe(body)
    await expect(pair.cancelFallback()).resolves.toBeUndefined()
  })

  test('does not copy or retry binary request streams', () => {
    const body = new Blob(['large binary upload']).stream()
    const pair = splitFetchBody(body, isReplayableFetchBody({ 'Content-Type': 'application/zip' }))

    expect(pair.primary).toBe(body)
    expect(pair.fallback).toBeUndefined()
    expect(pair.retryable).toBe(false)
    expect(isReplayableFetchBody({ 'content-type': 'application/octet-stream; charset=binary' })).toBe(false)
    expect(isReplayableFetchBody({ 'content-type': 'application/json' })).toBe(true)
  })

  test('can cancel the unused fallback stream after a successful primary fetch', async () => {
    const cancel = vi.fn()
    const body = { tee: () => [{}, { cancel }] }
    const pair = splitFetchBody(body)

    await pair.cancelFallback()
    expect(cancel).toHaveBeenCalledOnce()
  })

  test('ignores errors while cancelling an unused fallback stream', async () => {
    const body = { tee: () => [{}, { cancel: () => Promise.reject(new Error('already closed')) }] }
    const pair = splitFetchBody(body)

    await expect(pair.cancelFallback()).resolves.toBeUndefined()
  })
})