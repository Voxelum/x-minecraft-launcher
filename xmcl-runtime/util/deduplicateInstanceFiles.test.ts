import { describe, expect, it } from 'vitest'
import { deduplicateInstanceFiles } from './deduplicateInstanceFiles'
import type { InstanceFile } from '@xmcl/instance'

describe('instance file overlay path identity', () => {
  const files: InstanceFile[] = [
    { path: 'config/Settings.cfg', hashes: { sha1: 'old' } },
    { path: 'mods/test.jar', hashes: {} },
    { path: 'config/settings.cfg', hashes: { sha1: 'new' } },
  ]
  it('retains the final complete file descriptor on Windows', () => {
    expect(deduplicateInstanceFiles(files, 'win32')).toEqual([files[2], files[1]])
    expect(files).toHaveLength(3)
  })
  it.each(['linux', 'darwin'] as const)('preserves distinct paths on %s', platform => {
    expect(deduplicateInstanceFiles(files, platform)).toBe(files)
  })
  it('handles an empty baseline', () => {
    expect(deduplicateInstanceFiles([], 'win32')).toEqual([])
  })
})
