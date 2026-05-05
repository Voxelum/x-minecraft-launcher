/* eslint-disable no-template-curly-in-string */
import { MinecraftFolder } from '@xmcl/core'
import { describe, test, expect, beforeEach, vi } from 'vitest'
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
