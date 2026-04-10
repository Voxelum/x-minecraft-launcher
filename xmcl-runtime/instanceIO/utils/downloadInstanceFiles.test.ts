import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('@xmcl/file-transfer', () => ({
  downloadMultiple: vi.fn(),
}))

vi.mock('@xmcl/installer', () => ({
  onDownloadMultiple: vi.fn().mockReturnValue({}),
}))

import { downloadMultiple } from '@xmcl/file-transfer'
import { downloadInstanceFiles } from './downloadInstanceFiles'
import type { InstanceFile } from '@xmcl/instance'

function makeOption(path: string, url: string) {
  return {
    options: {
      url,
      destination: `/dest/${path}`,
    },
    file: { path } as InstanceFile,
  }
}

describe('downloadInstanceFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should mark all files as finished when all downloads succeed', async () => {
    vi.mocked(downloadMultiple).mockResolvedValue([
      { status: 'fulfilled', value: undefined },
      { status: 'fulfilled', value: undefined },
    ])

    const finished = new Set<string>()
    const options = [
      makeOption('a.jar', 'https://example.com/a.jar'),
      makeOption('b.jar', 'https://example.com/b.jar'),
    ]

    await downloadInstanceFiles(options, finished, AbortSignal.timeout(5000), {})

    expect(finished).toEqual(new Set(['a.jar', 'b.jar']))
    expect(downloadMultiple).toHaveBeenCalledTimes(1)
  })

  test('should retry failed downloads and succeed on retry', async () => {
    vi.mocked(downloadMultiple)
      // First attempt: a succeeds, b fails
      .mockResolvedValueOnce([
        { status: 'fulfilled', value: undefined },
        { status: 'rejected', reason: new Error('network error') },
      ])
      // Retry 1: b succeeds
      .mockResolvedValueOnce([
        { status: 'fulfilled', value: undefined },
      ])

    const finished = new Set<string>()
    const options = [
      makeOption('a.jar', 'https://example.com/a.jar'),
      makeOption('b.jar', 'https://example.com/b.jar'),
    ]

    await downloadInstanceFiles(options, finished, AbortSignal.timeout(5000), {})

    expect(finished).toEqual(new Set(['a.jar', 'b.jar']))
    expect(downloadMultiple).toHaveBeenCalledTimes(2)
  })

  test('should retry up to 3 times before throwing', async () => {
    const error = new Error('persistent error')
    vi.mocked(downloadMultiple)
      // First attempt: b fails
      .mockResolvedValueOnce([
        { status: 'fulfilled', value: undefined },
        { status: 'rejected', reason: error },
      ])
      // Retries 1–3: b keeps failing
      .mockResolvedValueOnce([{ status: 'rejected', reason: error }])
      .mockResolvedValueOnce([{ status: 'rejected', reason: error }])
      .mockResolvedValueOnce([{ status: 'rejected', reason: error }])

    const finished = new Set<string>()
    const options = [
      makeOption('a.jar', 'https://example.com/a.jar'),
      makeOption('b.jar', 'https://example.com/b.jar'),
    ]

    await expect(
      downloadInstanceFiles(options, finished, AbortSignal.timeout(5000), {}),
    ).rejects.toThrow(AggregateError)

    expect(finished).toEqual(new Set(['a.jar']))
    // 1 initial + 3 retries
    expect(downloadMultiple).toHaveBeenCalledTimes(4)
  })

  test('should only retry the failed files, not all files', async () => {
    vi.mocked(downloadMultiple)
      .mockResolvedValueOnce([
        { status: 'fulfilled', value: undefined },
        { status: 'rejected', reason: new Error('fail') },
        { status: 'fulfilled', value: undefined },
      ])
      .mockResolvedValueOnce([
        { status: 'fulfilled', value: undefined },
      ])

    const finished = new Set<string>()
    const options = [
      makeOption('a.jar', 'https://example.com/a.jar'),
      makeOption('b.jar', 'https://example.com/b.jar'),
      makeOption('c.jar', 'https://example.com/c.jar'),
    ]

    await downloadInstanceFiles(options, finished, AbortSignal.timeout(5000), {})

    expect(finished).toEqual(new Set(['a.jar', 'b.jar', 'c.jar']))
    expect(downloadMultiple).toHaveBeenCalledTimes(2)

    // The retry call should only contain the failed file
    const retryCallOptions = vi.mocked(downloadMultiple).mock.calls[1][0].options
    expect(retryCallOptions).toHaveLength(1)
    expect(retryCallOptions[0].destination).toBe('/dest/b.jar')
  })

  test('should not retry when all downloads succeed on first attempt', async () => {
    vi.mocked(downloadMultiple).mockResolvedValueOnce([
      { status: 'fulfilled', value: undefined },
    ])

    const finished = new Set<string>()
    const options = [makeOption('a.jar', 'https://example.com/a.jar')]

    await downloadInstanceFiles(options, finished, AbortSignal.timeout(5000), {})

    expect(downloadMultiple).toHaveBeenCalledTimes(1)
  })

  test('should respect abort signal between retries', async () => {
    const controller = new AbortController()
    vi.mocked(downloadMultiple)
      .mockResolvedValueOnce([
        { status: 'rejected', reason: new Error('fail') },
      ])

    // Abort before retry
    controller.abort()

    const finished = new Set<string>()
    const options = [makeOption('a.jar', 'https://example.com/a.jar')]

    await expect(
      downloadInstanceFiles(options, finished, controller.signal, {}),
    ).rejects.toThrow()

    // Should not have retried since the signal was aborted
    expect(downloadMultiple).toHaveBeenCalledTimes(1)
  })

  test('should succeed when a file fails initially but passes on a later retry', async () => {
    vi.mocked(downloadMultiple)
      // First attempt: both fail
      .mockResolvedValueOnce([
        { status: 'rejected', reason: new Error('fail 1') },
        { status: 'rejected', reason: new Error('fail 2') },
      ])
      // Retry 1: first succeeds, second still fails
      .mockResolvedValueOnce([
        { status: 'fulfilled', value: undefined },
        { status: 'rejected', reason: new Error('fail 2') },
      ])
      // Retry 2: second finally succeeds
      .mockResolvedValueOnce([
        { status: 'fulfilled', value: undefined },
      ])

    const finished = new Set<string>()
    const options = [
      makeOption('a.jar', 'https://example.com/a.jar'),
      makeOption('b.jar', 'https://example.com/b.jar'),
    ]

    await downloadInstanceFiles(options, finished, AbortSignal.timeout(5000), {})

    expect(finished).toEqual(new Set(['a.jar', 'b.jar']))
    expect(downloadMultiple).toHaveBeenCalledTimes(3)
  })
})
