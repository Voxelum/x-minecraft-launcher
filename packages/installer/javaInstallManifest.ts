import type { JavaVersion } from '@xmcl/core'
import {
  createJavaRuntimeInstallWorkflow,
  createZuluRuntimeInstallWorkflow,
} from './javaWorkflow'
import type { JavaRuntimeTarget } from './java-runtime.browser'
import type { InstallWorkflow } from './installManifest'
import type { ZuluJRE } from './zulu'

export interface OfficialJavaInstallCandidate {
  source: 'official'
  runtime: JavaRuntimeTarget
  destination: string
  executable: string
  apiHost?: string | string[]
}

export interface ZuluJavaInstallCandidate {
  source: 'zulu'
  destination: string
  executable: string
}

export type JavaInstallCandidate = OfficialJavaInstallCandidate | ZuluJavaInstallCandidate

export interface ResolvedZuluJavaInstallCandidate extends ZuluJavaInstallCandidate {
  runtime: ZuluJRE
}

export type ResolvedJavaInstallCandidate = OfficialJavaInstallCandidate | ResolvedZuluJavaInstallCandidate

export interface JavaInstallManifest {
  schemaVersion: 1
  target: JavaVersion
  candidates: JavaInstallCandidate[]
}

export interface ResolveJavaInstallManifestOptions {
  target: JavaVersion
  forceZulu?: boolean
  officialDestination: string
  officialExecutable: string
  zuluDestination: string
  zuluExecutable: string
  apiHost?: string | string[]
}

export interface JavaInstallManifestResolver {
  getOfficialRuntime(target: JavaVersion): Promise<JavaRuntimeTarget | undefined>
}

export async function resolveJavaInstallManifest(
  options: ResolveJavaInstallManifestOptions,
  resolver: JavaInstallManifestResolver,
): Promise<JavaInstallManifest> {
  const candidates: JavaInstallCandidate[] = []
  if (!options.forceZulu) {
    const runtime = await resolver.getOfficialRuntime(options.target)
    if (runtime) {
      candidates.push({
        source: 'official',
        runtime,
        destination: options.officialDestination,
        executable: options.officialExecutable,
        apiHost: options.apiHost,
      })
    }
  }
  candidates.push({
    source: 'zulu',
    destination: options.zuluDestination,
    executable: options.zuluExecutable,
  })
  return {
    schemaVersion: 1,
    target: options.target,
    candidates,
  }
}

export function createJavaInstallWorkflow(
  candidate: ResolvedJavaInstallCandidate,
): InstallWorkflow<void> {
  return candidate.source === 'official'
    ? createJavaRuntimeInstallWorkflow({
        target: candidate.runtime,
        destination: candidate.destination,
        apiHost: candidate.apiHost,
      })
    : createZuluRuntimeInstallWorkflow({
        runtime: candidate.runtime,
        destination: candidate.destination,
        executable: candidate.executable,
      })
}
