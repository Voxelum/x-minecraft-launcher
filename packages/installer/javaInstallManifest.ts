import type { JavaVersion } from '@xmcl/core'
import { createJavaRuntimeInstallWorkflow } from './javaWorkflow'
import type { JavaRuntimeTarget } from './java-runtime.browser'
import type { InstallWorkflow } from './installManifest'

export interface OfficialJavaInstallCandidate {
  source: 'official'
  runtime: JavaRuntimeTarget
  destination: string
  executable: string
  apiHost?: string | string[]
}

export type JavaInstallCandidate = OfficialJavaInstallCandidate

export interface JavaInstallManifest {
  schemaVersion: 1
  target: JavaVersion
  candidates: JavaInstallCandidate[]
}

export interface ResolveJavaInstallManifestOptions {
  target: JavaVersion
  officialDestination: string
  officialExecutable: string
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
  return {
    schemaVersion: 1,
    target: options.target,
    candidates,
  }
}

export function createJavaInstallWorkflow(candidate: JavaInstallCandidate): InstallWorkflow<void> {
  return createJavaRuntimeInstallWorkflow({
    target: candidate.runtime,
    destination: candidate.destination,
    apiHost: candidate.apiHost,
  })
}
