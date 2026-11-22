import type { JavaVersion } from '@xmcl/core'
import { describe, expect, test, vi } from 'vitest'
import { createJavaInstallWorkflow, resolveJavaInstallManifest } from './javaInstallManifest'
import type { JavaRuntimeTarget } from './java-runtime.browser'

const target: JavaVersion = { component: 'java-runtime-delta', majorVersion: 21 }
const official: JavaRuntimeTarget = {
  availability: { group: 1, progress: 100 },
  manifest: { url: 'https://example.com/manifest.json', sha1: 'manifest', size: 1 },
  version: { name: '21', released: '2024-01-01' },
}

function options() {
  return {
    target,
    officialDestination: 'jre/official',
    officialExecutable: 'jre/official/bin/java.exe',
    apiHost: ['bmclapi2.bangbang93.com'],
  }
}

describe('JavaInstallManifest', () => {
  test('resolves the official candidate', async () => {
    const manifest = await resolveJavaInstallManifest(options(), {
      getOfficialRuntime: vi.fn().mockResolvedValue(official),
    })

    expect(manifest).toEqual({
      schemaVersion: 1,
      target,
      candidates: [
        {
          source: 'official',
          runtime: official,
          destination: 'jre/official',
          executable: 'jre/official/bin/java.exe',
          apiHost: ['bmclapi2.bangbang93.com'],
        },
      ],
    })
  })

  test('creates the official runtime workflow', async () => {
    const manifest = await resolveJavaInstallManifest(options(), {
      getOfficialRuntime: vi.fn().mockResolvedValue(official),
    })
    const stage = await createJavaInstallWorkflow(manifest.candidates[0]).next()

    expect(stage).toMatchObject({
      done: false,
      plan: { tasks: [{ id: 'java-runtime-manifest' }] },
    })
  })
})
