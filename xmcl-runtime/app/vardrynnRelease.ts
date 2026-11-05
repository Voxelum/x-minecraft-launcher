import { VARDRYNN_API_VERSION, type ReleaseInfo, type VardrynnReleaseResponse } from '@xmcl/runtime-api'
import { createHash, createPublicKey, verify } from 'crypto'
import { createReadStream } from 'fs'
import { isUpstreamLauncherUrl } from '~/network/upstreamNetworkPolicy'

export type VardrynnReleaseAsset = VardrynnReleaseResponse['assets'][number]

/** Domain separator, so a signature for another purpose can never be replayed as a release. */
const SIGNATURE_CONTEXT = 'vardrynn-release-v1'
const SHA256 = /^[0-9a-f]{64}$/
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
// Fixed prefix of an Ed25519 SubjectPublicKeyInfo; the raw 32-byte key follows.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/** Release URLs are fetched with the whole file hashed, so any https host is acceptable except upstream ones. */
function isAllowedReleaseUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !isUpstreamLauncherUrl(url)
  } catch {
    return false
  }
}

export function parseVardrynnReleaseKey(value: unknown): Buffer | undefined {
  if (typeof value !== 'string') return undefined
  const raw = Buffer.from(value.trim(), 'base64')
  return raw.length === 32 ? raw : undefined
}

/** Exact bytes a release signature covers: the file hash bound to version, platform and architecture. */
export function releaseSignaturePayload(
  version: string,
  asset: Pick<VardrynnReleaseAsset, 'platform' | 'arch' | 'sha256'>,
): Buffer {
  return Buffer.from([SIGNATURE_CONTEXT, version, asset.platform, asset.arch, asset.sha256].join('\n'))
}

export function verifyReleaseSignature(
  publicKey: Buffer,
  version: string,
  asset: VardrynnReleaseAsset,
): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey]),
      format: 'der',
      type: 'spki',
    })
    const signature = Buffer.from(asset.signature, 'base64')
    return signature.length === 64 && verify(null, releaseSignaturePayload(version, asset), key, signature)
  } catch {
    return false
  }
}

/** Returns undefined for anything outside the `v1` contract, including malformed assets. */
export function parseVardrynnRelease(body: unknown): VardrynnReleaseResponse | undefined {
  const release = (body ?? {}) as Partial<VardrynnReleaseResponse>
  if (
    release.apiVersion !== VARDRYNN_API_VERSION ||
    typeof release.version !== 'string' || !VERSION.test(release.version) ||
    typeof release.channel !== 'string' ||
    typeof release.publishedAt !== 'string' ||
    typeof release.notesUrl !== 'string' ||
    !Array.isArray(release.assets)
  ) return undefined
  const assets = release.assets.filter((a): a is VardrynnReleaseAsset =>
    !!a &&
    typeof a.platform === 'string' &&
    typeof a.arch === 'string' &&
    isAllowedReleaseUrl(a.url) &&
    typeof a.sha256 === 'string' && SHA256.test(a.sha256) &&
    typeof a.signature === 'string')
  return { ...release, assets } as VardrynnReleaseResponse
}

/** The asset for this host, but only if its signature verifies. */
export function selectVerifiedAsset(
  release: VardrynnReleaseResponse,
  platform: string,
  arch: string,
  publicKey: Buffer,
): VardrynnReleaseAsset | undefined {
  return release.assets.find((a) =>
    a.platform === platform && a.arch === arch && verifyReleaseSignature(publicKey, release.version, a))
}

function parseVersion(version: string) {
  const [core, pre] = version.replace(/^v/, '').split(/-(.*)/s)
  return { numbers: core.split('.').map(Number), pre }
}

/** Semver precedence: prereleases sort before their release; prerelease identifiers compare numerically then lexically. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseVersion(candidate)
  const b = parseVersion(current)
  for (let i = 0; i < 3; i++) {
    if ((a.numbers[i] ?? 0) !== (b.numbers[i] ?? 0)) return (a.numbers[i] ?? 0) > (b.numbers[i] ?? 0)
  }
  if (a.pre === b.pre) return false
  if (a.pre === undefined) return true
  if (b.pre === undefined) return false
  const pa = a.pre.split('.')
  const pb = b.pre.split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return false
    if (pb[i] === undefined) return true
    if (pa[i] === pb[i]) continue
    const na = /^\d+$/.test(pa[i])
    const nb = /^\d+$/.test(pb[i])
    if (na && nb) return Number(pa[i]) > Number(pb[i])
    if (na !== nb) return nb
    return pa[i] > pb[i]
  }
  return false
}

export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path).on('data', (c) => hash.update(c)).on('error', reject).on('end', () => resolve(hash.digest('hex')))
  })
}

/** Whether stored update info has the shape of a Vardrynn release. Authenticity is checked by the updater. */
export function isSignedReleaseInfo(info: ReleaseInfo): boolean {
  return info.operation === 'manual' && info.files?.length === 1 && !!info.files[0].sha256 && !!info.files[0].signature
}
