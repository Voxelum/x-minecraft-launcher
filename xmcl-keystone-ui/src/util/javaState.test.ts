import { describe, test, expect } from 'vitest'
import type { JavaRecord } from '@xmcl/runtime-api'
import { mergeJavaUpdate } from './javaState'

const rec = (over: Partial<JavaRecord> & { path: string }): JavaRecord => ({
  version: '21',
  majorVersion: 21,
  valid: true,
  ...over,
})

describe('mergeJavaUpdate', () => {
  // The whole point of the helper is to compensate for `JavaState.javaUpdate`
  // mutating in place. These cases lock in the reference contract that the
  // renderer-side override exists to provide.

  test('adding a new Java returns a new array reference', () => {
    const before = [rec({ path: '/jdk21' })]
    const after = mergeJavaUpdate(before, rec({ path: '/jdk17', majorVersion: 17, version: '17' }))
    expect(after).not.toBe(before)
    expect(after.map(j => j.path)).toEqual(['/jdk21', '/jdk17'])
  })

  test('idempotent refresh (no field changed) keeps the same array reference', () => {
    const before = [rec({ path: '/jdk21' })]
    const after = mergeJavaUpdate(before, rec({ path: '/jdk21' }))
    expect(after).toBe(before)
  })

  test('metadata change produces a new array AND a new record reference for the changed slot', () => {
    const before = [rec({ path: '/jdk21', valid: true })]
    const after = mergeJavaUpdate(before, rec({ path: '/jdk21', valid: false }))
    expect(after).not.toBe(before)
    expect(after[0]).not.toBe(before[0])
    expect(after[0].valid).toBe(false)
  })

  test('array form: mix of add + idempotent + update — produces one new array, untouched slots keep refs', () => {
    const r1 = rec({ path: '/jdk21' })
    const r2 = rec({ path: '/jdk17', majorVersion: 17, version: '17' })
    const before = [r1, r2]
    const after = mergeJavaUpdate(before, [
      rec({ path: '/jdk21' }),                                    // idempotent
      rec({ path: '/jdk17', majorVersion: 17, version: '17.1' }), // update
      rec({ path: '/jdk25', majorVersion: 25, version: '25' }),   // add
    ])
    expect(after).not.toBe(before)
    expect(after).toHaveLength(3)
    expect(after[0]).toBe(r1) // untouched
    expect(after[1]).not.toBe(r2) // updated
    expect(after[1].version).toBe('17.1')
    expect(after[2].path).toBe('/jdk25')
  })

  test('arch only widens (j.arch || existed.arch) — never wipes a known arch with undefined', () => {
    const before = [rec({ path: '/jdk21', arch: 'x64' })]
    const after = mergeJavaUpdate(before, rec({ path: '/jdk21', arch: undefined }))
    // Nothing observable changed → same reference
    expect(after).toBe(before)
    expect(after[0].arch).toBe('x64')
  })

  test('newly-known arch promotes to a new array', () => {
    const before = [rec({ path: '/jdk21', arch: undefined })]
    const after = mergeJavaUpdate(before, rec({ path: '/jdk21', arch: 'x64' }))
    expect(after).not.toBe(before)
    expect(after[0].arch).toBe('x64')
  })

  test('empty update yields the same reference', () => {
    const before = [rec({ path: '/jdk21' })]
    const after = mergeJavaUpdate(before, [])
    expect(after).toBe(before)
  })
})
