import { describe, expect, test } from 'vitest'
import { JavaState } from './JavaService'

describe('JavaState settings', () => {
  test('allows empty per-Java settings to replace existing values', () => {
    const state = new JavaState()
    const java = {
      path: '/java/bin/java',
      version: '21',
      majorVersion: 21,
      valid: true,
      prependCommand: 'wrapper',
      vmOptions: ['-Xmx2G'],
    }

    state.javaUpdate(java)
    state.javaUpdate({ ...java, prependCommand: '', vmOptions: [] })

    expect(state.all[0]).toMatchObject({ prependCommand: '', vmOptions: [] })
  })

  test('preserves per-Java settings when a refresh omits them', () => {
    const state = new JavaState()
    const java = {
      path: '/java/bin/java',
      version: '21',
      majorVersion: 21,
      valid: true,
      prependCommand: 'wrapper',
      vmOptions: ['-Xmx2G'],
    }

    state.javaUpdate(java)
    state.javaUpdate({ ...java, prependCommand: undefined, vmOptions: undefined })

    expect(state.all[0]).toMatchObject({
      prependCommand: 'wrapper',
      vmOptions: ['-Xmx2G'],
    })
  })
})
