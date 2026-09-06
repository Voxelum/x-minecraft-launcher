import type { InstanceFile } from './files'

export const instanceFileChecksumAlgorithms = ['sha512', 'sha256', 'sha1', 'crc32'] as const

export type InstanceFileChecksumAlgorithm = (typeof instanceFileChecksumAlgorithms)[number]

export interface InstanceFileChecksum {
  algorithm: InstanceFileChecksumAlgorithm
  value: string
}

export function normalizeInstanceFileChecksum(
  algorithm: InstanceFileChecksumAlgorithm,
  value: string | number | undefined | null,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return algorithm === 'crc32' ? String(Number(value)) : String(value)
}

export function hasInstanceFileChecksum(
  file: Pick<InstanceFile, 'hashes'>,
  algorithms: readonly InstanceFileChecksumAlgorithm[] = instanceFileChecksumAlgorithms,
) {
  return algorithms.some((algorithm) => normalizeInstanceFileChecksum(algorithm, file.hashes[algorithm]))
}

export function getInstanceFileChecksum(
  file: Pick<InstanceFile, 'hashes'>,
  algorithms: readonly InstanceFileChecksumAlgorithm[] = instanceFileChecksumAlgorithms,
): InstanceFileChecksum | undefined {
  const supported = new Set(algorithms)
  for (const algorithm of instanceFileChecksumAlgorithms) {
    if (!supported.has(algorithm)) continue
    const value = normalizeInstanceFileChecksum(algorithm, file.hashes[algorithm])
    if (value) return { algorithm, value }
  }
  return undefined
}
