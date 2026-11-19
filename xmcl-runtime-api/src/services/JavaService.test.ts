import { describe, expect, test } from 'vitest'
import { JavaState } from './JavaService'
import { JavasSchema } from '../entities/java.schema'

describe('JavaState settings', () => {
  test('persists managed-runtime metadata in the Java cache schema', () => {
    const state = JavasSchema.parse({
      all: [
        {
          path: '/java/bin/java',
          version: '21',
          majorVersion: 21,
          isInternal: true,
          installVendor: 'net.adoptium.java',
        },
      ],
    })

    expect(state.all[0]).toMatchObject({
      isInternal: true,
      installVendor: 'net.adoptium.java',
    })
  })

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

  test('preserves internal installation metadata when a refresh omits it', () => {
    const state = new JavaState()
    const java = {
      path: '/java/bin/java',
      version: '21',
      majorVersion: 21,
      valid: true,
      isInternal: true,
      installVendor: 'net.adoptium.java',
    }

    state.javaUpdate(java)
    state.javaUpdate({ ...java, isInternal: undefined, installVendor: undefined })

    expect(state.all[0]).toMatchObject({
      isInternal: true,
      installVendor: 'net.adoptium.java',
    })
  })
})
