import { describe, it, expect, vi } from 'vitest'
import { createInstance, CreateInstanceOptions } from './create'

describe('createInstance', () => {
  const getCandidatePath = vi.fn((name: string) => `/instances/${name}`)
  const getLatestRelease = vi.fn(() => '1.20.1')

  it('should create a new instance with required fields', () => {
    const options: CreateInstanceOptions = {
      name: 'TestInstance',
    }
    const instance = createInstance(options, getCandidatePath, getLatestRelease, true)
    expect(instance.name).toBe('TestInstance')
    expect(instance.path).toBe('/instances/TestInstance')
    expect(instance.creationDate).toBeGreaterThan(0)
    expect(instance.lastAccessDate).toBeGreaterThan(0)
    expect(instance.playtime).toBe(0)
    expect(instance.lastPlayedDate).toBe(0)
    expect(instance.runtime.minecraft).toBe('1.20.1')
  })

  it('should use provided path if given', () => {
    const options: CreateInstanceOptions = {
      name: 'TestInstance',
      path: '/custom/path',
    }
    const instance = createInstance(options, getCandidatePath, getLatestRelease, true)
    expect(instance.path).toBe('/custom/path')
  })

  it('should not overwrite runtime.minecraft if provided', () => {
    const options: CreateInstanceOptions = {
      name: 'TestInstance',
      runtime: { minecraft: '1.18.2' },
    }
    const instance = createInstance(options, getCandidatePath, getLatestRelease, true)
    expect(instance.runtime.minecraft).toBe('1.18.2')
    expect(instance.runtime.forge).toBe('')
  })

  it('should correctly fallback prop if provided', () => {
    const options: CreateInstanceOptions = {
      name: 'TestInstance',
      runtime: { minecraft: '1.18.2', forge: undefined },
    }
    const instance = createInstance(options, getCandidatePath, getLatestRelease, true)
    expect(instance.runtime.minecraft).toBe('1.18.2')
    expect(instance.runtime.forge).toBe('')
  })

  it('should not set creation fields if isCreate is false', () => {
    const options: CreateInstanceOptions = {
      name: 'TestInstance',
      creationDate: 123,
      lastAccessDate: 456,
      playtime: 789,
      lastPlayedDate: 1011,
    }
    const instance = createInstance(options, getCandidatePath, getLatestRelease, false)
    expect(instance.creationDate).toBe(123)
    expect(instance.lastAccessDate).toBe(456)
    expect(instance.playtime).toBe(789)
    expect(instance.lastPlayedDate).toBe(1011)
  })
})
