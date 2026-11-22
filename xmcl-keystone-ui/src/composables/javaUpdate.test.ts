import { describe, expect, it, vi } from 'vitest'
import type { JavaRecord } from '@xmcl/runtime-api'
import { findJavaRuntimeUpdate, promptJavaUpdate, resolveJavaUpdatePrompt } from './javaUpdate'

const java = (overrides: Partial<JavaRecord> = {}): JavaRecord => ({
  path: '/jre/java-runtime-delta/bin/java',
  version: '21.0.5',
  majorVersion: 21,
  valid: true,
  isInternal: true,
  ...overrides,
})

const runtime = (displayVersion: string, runtimeUrl: string, name = 'java-runtime-delta') => ({
  version: 'java21',
  runtimeUrl,
  displayVersion,
  name,
  vendor: 'eclipse',
  path: '/jre/java-runtime-delta',
})

describe('findJavaRuntimeUpdate', () => {
  it('finds a newer runtime for the installed component and reuses its vendor metadata', async () => {
    const getRuntimes = vi
      .fn()
      .mockResolvedValue([
        runtime('21.0.6+0', 'https://example.test/21.0.6'),
        runtime('21.0.5+0', 'https://example.test/21.0.5'),
      ])

    await expect(
      findJavaRuntimeUpdate(
        java({ installVendor: 'net.adoptium.java' }),
        ['com.azul.java'],
        getRuntimes,
      ),
    ).resolves.toEqual({
      vendor: 'net.adoptium.java',
      version: 'java21',
      majorVersion: 21,
      runtimeUrl: 'https://example.test/21.0.6',
      runtimePath: '/jre/java-runtime-delta',
      displayVersion: '21.0.6',
    })
    expect(getRuntimes).toHaveBeenCalledExactlyOnceWith(
      'net.adoptium.java',
      'java21',
      undefined,
      true,
    )
  })

  it('matches versioned runtime folders by package family instead of exact install path', async () => {
    const installedJava = java({
      path: '/home/user/.minecraftx/jre/eclipse_temurin_jre17.0.21+2/jdk-17.0.21.1+2-jre/bin/java',
      version: '17.0.21.2',
      majorVersion: 17,
      installVendor: 'net.adoptium.java',
    })
    const getRuntimes = vi.fn().mockResolvedValue([
      {
        ...runtime('17.0.21+9', 'https://example.test/17.0.21', 'eclipse_temurin_jre17.0.21+9'),
        path: '/home/user/.minecraftx/jre/eclipse_temurin_jre17.0.21+9',
      },
    ])

    await expect(
      findJavaRuntimeUpdate(installedJava, ['net.adoptium.java'], getRuntimes),
    ).resolves.toMatchObject({
      displayVersion: '17.0.21.9',
      runtimeUrl: 'https://example.test/17.0.21',
      runtimePath: '/home/user/.minecraftx/jre/eclipse_temurin_jre17.0.21+9',
    })
  })

  it('uses the managed root rather than an earlier jre directory in the path', async () => {
    const installedJava = java({
      path: '/games/jre/data/jre/eclipse_temurin_jre17.0.21+2/bin/java',
      version: '17.0.21.2',
      majorVersion: 17,
      installVendor: 'net.adoptium.java',
    })
    const getRuntimes = vi.fn().mockResolvedValue([
      {
        ...runtime('17.0.21+9', 'https://example.test/17', 'eclipse_temurin_jre17.0.21+9'),
        path: '/games/jre/data/jre/eclipse_temurin_jre17.0.21+9',
      },
    ])
    await expect(findJavaRuntimeUpdate(installedJava, [], getRuntimes)).resolves.toMatchObject({
      displayVersion: '17.0.21.9',
    })
  })

  it('does not request metadata for external Java or report the current runtime as an update', async () => {
    const getRuntimes = vi.fn().mockResolvedValue([runtime('21.0.5+0', 'https://example.test/21')])

    await expect(
      findJavaRuntimeUpdate(java({ isInternal: false }), ['net.adoptium.java'], getRuntimes),
    ).resolves.toBeUndefined()
    await expect(
      findJavaRuntimeUpdate(java(), ['net.adoptium.java'], getRuntimes),
    ).resolves.toBeUndefined()
    expect(getRuntimes).toHaveBeenCalledOnce()
  })

  it('normalizes legacy Java 8 versions before checking for updates', async () => {
    const getRuntimes = vi.fn().mockResolvedValue([runtime('8.0.512+9', 'https://example.test/8')])

    await expect(
      findJavaRuntimeUpdate(
        java({ version: '1.8.0_512', majorVersion: 8 }),
        ['net.adoptium.java'],
        getRuntimes,
      ),
    ).resolves.toBeUndefined()
  })

  it('detects newer legacy Java 8 updates with a zero build number', async () => {
    const getRuntimes = vi.fn().mockResolvedValue([runtime('8.0.512+0', 'https://example.test/8')])

    await expect(
      findJavaRuntimeUpdate(
        java({ version: '1.8.0_202', majorVersion: 8 }),
        ['net.adoptium.java'],
        getRuntimes,
      ),
    ).resolves.toMatchObject({ displayVersion: '8.0.512' })
  })

  it('rejects when all metadata lookups fail so launch can skip an offline check', async () => {
    const getRuntimes = vi.fn().mockRejectedValue(new Error('offline'))

    await expect(findJavaRuntimeUpdate(java(), ['net.adoptium.java'], getRuntimes)).rejects.toThrow(
      'Unable to check for Java runtime updates',
    )
  })

  it('times out a metadata lookup that never responds', async () => {
    vi.useFakeTimers()
    try {
      const lookup = findJavaRuntimeUpdate(java(), ['net.adoptium.java'], () => new Promise(() => {}))
      const result = expect(lookup).rejects.toThrow('timed out')
      await vi.advanceTimersByTimeAsync(10_000)
      await result
    } finally {
      vi.useRealTimers()
    }
  })

  it('resolves the launch prompt with the user choice', async () => {
    const show = vi.fn()
    const hide = vi.fn()
    const prompt = promptJavaUpdate(show, hide, '21.0.5', '21.0.6', new AbortController().signal)
    expect(show).toHaveBeenCalledOnce()
    resolveJavaUpdatePrompt(show.mock.calls[0][0].id, true)

    await expect(prompt).resolves.toBe(true)
    expect(hide).not.toHaveBeenCalled()
  })

  it('closes the prompt when launch is cancelled', async () => {
    const show = vi.fn()
    const hide = vi.fn()
    const controller = new AbortController()
    const prompt = promptJavaUpdate(show, hide, '21.0.5', '21.0.6', controller.signal)
    await Promise.resolve()

    controller.abort()

    await expect(prompt).resolves.toBe(false)
    expect(hide).toHaveBeenCalledOnce()
  })

  it('does not show a prompt when launch was already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    const show = vi.fn()
    const hide = vi.fn()
    await expect(promptJavaUpdate(show, hide, '21.0.5', '21.0.6', controller.signal)).resolves.toBe(false)
    expect(show).not.toHaveBeenCalled()
    expect(hide).not.toHaveBeenCalled()
  })
})
