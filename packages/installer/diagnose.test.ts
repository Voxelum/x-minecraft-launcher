/* eslint-disable no-template-curly-in-string */
import { MinecraftFolder } from '@xmcl/core'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { diagnoseFile } from './diagnose'
import { diagnoseLibraries } from './libraries'
import * as fs from 'fs/promises'

vi.mock('fs/promises')

const resolvedLib = {
  name: 'com.mojang:patchy:1.1',
  download: {
    path: 'com/mojang/patchy/1.1/patchy-1.1.jar',
    sha1: 'aef610b34a1be37fa851825f12372b78424d8903',
    size: 15817,
    url: 'https://libraries.minecraft.net/com/mojang/patchy/1.1/patchy-1.1.jar',
  },
  groupId: 'com.mojang',
  artifactId: 'patchy',
  version: '1.1',
  isSnapshot: false,
  type: 'jar',
  classifier: '',
  path: 'com/mojang/patchy/1.1/patchy-1.1.jar',
  isNative: false,
} as const

describe('#diagnoseLibraries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should diagnose empty result for valid library', async () => {
    const accessMock = vi.mocked(fs.access)
    accessMock.mockResolvedValue(undefined)

    const libs = await diagnoseLibraries(
      [resolvedLib],
      MinecraftFolder.from('temp'),
      {
        checksum: async () => 'aef610b34a1be37fa851825f12372b78424d8903',
      },
    )
    expect(libs).toHaveLength(0)
  })

  test('should diagnose invalid library for no such file', async () => {
    const accessMock = vi.mocked(fs.access)
    accessMock.mockRejectedValue(new Error('ENOENT'))

    const libs = await diagnoseLibraries([resolvedLib], MinecraftFolder.from('temp'))
    expect(libs).toHaveLength(1)
    expect(libs[0]).toEqual(resolvedLib)
  })

  test('should diagnose invalid library for checksum not match', async () => {
    const accessMock = vi.mocked(fs.access)
    accessMock.mockResolvedValue(undefined)

    const libs = await diagnoseLibraries(
      [resolvedLib],
      MinecraftFolder.from('temp'),
      {
        checksum: async () => 'wrongchecksum',
      },
    )
    expect(libs).toHaveLength(1)
    expect(libs[0]).toEqual(resolvedLib)
  })
})

describe('#diagnoseFile timestamp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('does not checksum a missing file without a timestamp', async () => {
    vi.mocked(fs.access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
    const checksum = vi.fn()

    const issue = await diagnoseFile(
      { file: 'missing.jar', expectedChecksum: 'expected', role: 'jar', hint: '' },
      { checksum },
    )

    expect(issue?.type).toBe('missing')
    expect(checksum).not.toHaveBeenCalled()
  })

  test('checksums an existing file without a timestamp', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined)
    const checksum = vi.fn().mockResolvedValue('expected')

    const issue = await diagnoseFile(
      { file: 'existing.jar', expectedChecksum: 'expected', role: 'jar', hint: '' },
      { checksum },
    )

    expect(issue).toBeUndefined()
    expect(checksum).toHaveBeenCalledOnce()
  })

  test('trusts a file not modified after the validation timestamp', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined)
    vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: 100, size: 1 } as any)
    const checksum = vi.fn()

    const issue = await diagnoseFile(
      { file: 'locked.jar', expectedChecksum: 'expected', role: 'jar', hint: '' },
      { checksum, timestamp: 100 },
    )

    expect(issue).toBeUndefined()
    expect(checksum).not.toHaveBeenCalled()
  })

  test('checksums a file modified after the validation timestamp', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined)
    vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: 101, size: 1 } as any)
    const checksum = vi.fn().mockResolvedValue('actual')

    const issue = await diagnoseFile(
      { file: 'changed.jar', expectedChecksum: 'expected', role: 'jar', hint: '' },
      { checksum, timestamp: 100 },
    )

    expect(issue).toMatchObject({ type: 'corrupted', receivedChecksum: 'actual' })
    expect(checksum).toHaveBeenCalledOnce()
  })
})
