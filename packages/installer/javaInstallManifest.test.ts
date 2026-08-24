import type { JavaVersion } from '@xmcl/core'
import { describe, expect, test, vi } from 'vitest'
import {
  createJavaInstallWorkflow,
  resolveJavaInstallManifest,
} from './javaInstallManifest'
import type { JavaRuntimeTarget } from './java-runtime.browser'
import type { ZuluJRE } from './zulu'

const target: JavaVersion = { component: 'java-runtime-delta', majorVersion: 21 }
const official: JavaRuntimeTarget = {
  availability: { group: 1, progress: 100 },
  manifest: { url: 'https://example.com/manifest.json', sha1: 'manifest', size: 1 },
  version: { name: '21', released: '2024-01-01' },
}
const zulu: ZuluJRE = {
  features: [],
  architecture: 'x64',
  os: 'win32',
  sha256: 'zulu',
  size: 2,
  url: 'https://example.com/zulu.zip',
}

function options() {
  return {
    target,
    officialDestination: 'jre/official',
    officialExecutable: 'jre/official/bin/java.exe',
    zuluDestination: 'jre/zulu',
    zuluExecutable: 'jre/zulu/bin/java.exe',
    apiHost: ['bmclapi2.bangbang93.com'],
  }
}

describe('JavaInstallManifest', () => {
  test('resolves ordered official and Zulu candidates', async () => {
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
        {
          source: 'zulu',
          destination: 'jre/zulu',
          executable: 'jre/zulu/bin/java.exe',
        },
      ],
    })
  })

  test('forceZulu resolves only the Zulu candidate', async () => {
    const getOfficialRuntime = vi.fn().mockResolvedValue(official)
    const manifest = await resolveJavaInstallManifest({ ...options(), forceZulu: true }, {
      getOfficialRuntime,
    })

    expect(getOfficialRuntime).not.toHaveBeenCalled()
    expect(manifest.candidates.map((candidate) => candidate.source)).toEqual(['zulu'])
  })

  test('workflow dispatches from candidate data', async () => {
    const manifest = await resolveJavaInstallManifest(options(), {
      getOfficialRuntime: vi.fn().mockResolvedValue(official),
    })

    const officialCandidate = manifest.candidates[0]
    if (officialCandidate.source !== 'official') throw new Error('Missing official candidate')
    const officialStage = await createJavaInstallWorkflow(officialCandidate).next()
    const zuluCandidate = manifest.candidates[1]
    if (zuluCandidate.source !== 'zulu') throw new Error('Missing Zulu candidate')
    const zuluStage = await createJavaInstallWorkflow({ ...zuluCandidate, runtime: zulu }).next()

    expect(officialStage).toMatchObject({ done: false, plan: { tasks: [{ id: 'java-runtime-manifest' }] } })
    expect(zuluStage).toMatchObject({ done: false, plan: { tasks: [{ id: 'zulu-runtime-archive' }] } })
  })
})
