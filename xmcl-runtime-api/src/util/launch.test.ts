import type { Instance } from '@xmcl/instance'
import { describe, expect, test } from 'vitest'
import type { UserProfile } from '../entities/user.schema'
import { generateLaunchOptionsWithGlobal } from './launch'

const createInstance = (overrides: Partial<Instance> = {}) =>
  ({
    path: '/instance',
    env: {},
    ...overrides,
  }) as Instance

const baseOptions = {
  token: '',
  operationId: 'test',
  javaPath: '/java/bin/java',
  globalEnv: {},
  globalMcOptions: [],
  globalAssignMemory: false,
  globalMinMemory: 0,
  globalMaxMemory: 0,
  modCount: 0,
  getOrInstallAuthlibInjector: async () => '/authlib.jar',
  track: async <T>(_token: string, operation: () => Promise<T>) => operation(),
}

describe('generateLaunchOptionsWithGlobal Java options', () => {
  test('uses per-Java options when the instance has no overrides', async () => {
    const options = await generateLaunchOptionsWithGlobal(
      createInstance(),
      { authority: '' } as UserProfile,
      '1.20.1',
      {
        ...baseOptions,
        globalJavaPrependCommand: 'prime-run',
        globalJavaVmOptions: ['-Xmx4G'],
      },
    )

    expect(options.prependCommand).toBe('prime-run')
    expect(options.vmOptions).toEqual(['-Xmx4G'])
  })

  test('uses explicit empty instance settings instead of per-Java options', async () => {
    const options = await generateLaunchOptionsWithGlobal(
      createInstance({ prependCommand: '', vmOptions: [] }),
      { authority: '' } as UserProfile,
      '1.20.1',
      {
        ...baseOptions,
        globalJavaPrependCommand: 'prime-run',
        globalJavaVmOptions: ['-Xmx4G'],
      },
    )

    expect(options.prependCommand).toBe('')
    expect(options.vmOptions).toEqual([])
  })
})
