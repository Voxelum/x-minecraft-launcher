import { BLUEPRINT_EXTENSIONS } from '@xmcl/schematic'
import { describe, expect, it } from 'vitest'
import { ResourceDomain } from '../ResourceDomain'
import { shouldIgnoreFile } from './shouldIgnoreFile'

describe('shouldIgnoreFile', () => {
  it('ignores non-blueprint files in blueprint directories', () => {
    expect(shouldIgnoreFile('preview.png', ResourceDomain.Blueprints)).toBe(true)
    expect(shouldIgnoreFile('nested/thumbnail.PNG', ResourceDomain.Blueprints)).toBe(true)
  })

  it('accepts every supported blueprint extension', () => {
    for (const extension of Object.keys(BLUEPRINT_EXTENSIONS)) {
      expect(shouldIgnoreFile(`build${extension}`, ResourceDomain.Blueprints)).toBe(false)
    }
  })

  it('keeps extensionless blueprint directories traversable', () => {
    expect(shouldIgnoreFile('nested', ResourceDomain.Blueprints, true)).toBe(false)
    expect(shouldIgnoreFile('builds.v2', ResourceDomain.Blueprints, true)).toBe(false)
  })

  it('ignores extensionless files in blueprint directories', () => {
    expect(shouldIgnoreFile('README', ResourceDomain.Blueprints, false)).toBe(true)
  })
})
