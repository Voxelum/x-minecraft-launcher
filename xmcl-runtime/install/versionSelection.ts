import type { PartialRuntimeVersions } from '@xmcl/instance'
import { findMatchedVersion, type VersionHeader } from '@xmcl/runtime-api'

export function selectLocalVersion(
  versions: VersionHeader[],
  runtime: PartialRuntimeVersions,
  selectedVersion = '',
) {
  const selected = selectedVersion
    ? versions.find((version) => version.id === selectedVersion)
    : undefined
  if (selected && findMatchedVersion([selected], '', runtime)) return selected
  return findMatchedVersion(versions, '', runtime)
}