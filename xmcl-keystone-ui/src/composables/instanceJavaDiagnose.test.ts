import { describe, expect, it } from 'vitest'
import { JavaCompatibleState, type InstanceJavaStatus } from './instanceJava'
import { getInstanceJavaIssue } from './instanceJavaDiagnose'

function createStatus(overrides: Partial<InstanceJavaStatus> = {}): InstanceJavaStatus {
  return {
    instance: 'instance',
    javaPath: undefined,
    java: {
      path: '/java',
      version: '21.0.1',
      majorVersion: 21,
      valid: true,
    },
    preference: {
      requirement: 21,
      preferred: 21,
    },
    ...overrides,
  } as InstanceJavaStatus
}

describe('getInstanceJavaIssue', () => {
  it('reports a missing Java in auto mode', () => {
    expect(getInstanceJavaIssue(createStatus({ java: undefined }))).toBe('missing')
  })

  it('keeps reporting an invalid manually selected Java', () => {
    expect(getInstanceJavaIssue(createStatus({
      javaPath: '/removed-java',
      java: undefined,
    }))).toBe('invalid')
  })

  it('reports an incompatible manually selected Java', () => {
    expect(getInstanceJavaIssue(createStatus({
      javaPath: '/java',
      compatible: JavaCompatibleState.VeryLikelyIncompatible,
    }))).toBe('incompatible')
  })

  it('allows a selected Java to be bypassed', () => {
    expect(getInstanceJavaIssue(createStatus({
      javaPath: '/java',
      compatible: JavaCompatibleState.VeryLikelyIncompatible,
    }), '/java')).toBeUndefined()
  })
})