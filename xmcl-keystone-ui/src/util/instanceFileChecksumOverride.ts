import { instanceFileChecksumAlgorithms, normalizeInstanceFileChecksum, type InstanceFile } from '@xmcl/instance'

export function instanceFileChecksumOverride(error: { file: InstanceFile; expect: string; actual: string }): InstanceFile {
  const algorithm = instanceFileChecksumAlgorithms.find(algorithm =>
    normalizeInstanceFileChecksum(algorithm, error.file.hashes[algorithm]) === error.expect,
  ) ?? 'sha1'
  return { ...error.file, hashes: { [algorithm]: error.actual } }
}
