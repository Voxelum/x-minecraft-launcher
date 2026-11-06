import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto'
import { basename } from 'node:path'

/** Must match `releaseSignaturePayload` in xmcl-runtime/app/vardrynnRelease.ts; the test round-trips through it. */
export function signaturePayload(version: string, asset: { platform: string; arch: string; sha256: string }) {
  return Buffer.from(['vardrynn-release-v1', version, asset.platform, asset.arch, asset.sha256].join('\n'))
}

export interface PackageFile {
  name: string
  bytes: Buffer
}

/**
 * Packages that can be handed to the OS installer, named by electron-builder's
 * `vardrynn-${version}-${arch}.${ext}` (`amd64` for x64 debs). Archives are published for manual download but
 * never offered as an update. Windows is excluded until its packages carry an
 * Authenticode signature, because the OS would refuse to install them.
 */
export function classifyPackage(name: string, version: string) {
  const match = new RegExp(`^vardrynn-${version.replace(/[.+]/g, '\\$&')}-(x64|amd64|arm64|ia32)\\.(dmg|deb)$`).exec(basename(name))
  if (!match) return undefined
  const platform = { dmg: 'darwin', deb: 'linux' }[match[2] as 'dmg' | 'deb']
  // electron-builder names x64 Debian packages with Debian's own `amd64`.
  return { platform, arch: match[1] === 'amd64' ? 'x64' : match[1] }
}

export function generateReleaseKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    // Raw 32 bytes: what VARDRYNN_RELEASE_PUBLIC_KEY holds at build time.
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64'),
    // PKCS#8 DER: what VARDRYNN_RELEASE_SIGNING_KEY holds in CI.
    privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
  }
}

export function buildReleaseManifest(options: {
  version: string
  channel: string
  publishedAt: string
  notesUrl: string
  downloadBase: string
  files: PackageFile[]
  signingKey: string
  /** The public key the build embeds; signing aborts if the secret does not belong to it. */
  publicKey: string
}) {
  const key = createPrivateKey({ key: Buffer.from(options.signingKey, 'base64'), format: 'der', type: 'pkcs8' })
  const derived = createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64')
  if (derived !== options.publicKey) throw new Error('The signing key does not match VARDRYNN_RELEASE_PUBLIC_KEY')
  const base = new URL(options.downloadBase)
  if (base.protocol !== 'https:') throw new Error('The download base must be https')
  const assets = options.files.flatMap((file) => {
    const target = classifyPackage(file.name, options.version)
    if (!target) return []
    const sha256 = createHash('sha256').update(file.bytes).digest('hex')
    return [{
      ...target,
      url: new URL(basename(file.name), base.href.replace(/\/?$/, '/')).href,
      sha256,
      signature: sign(null, signaturePayload(options.version, { ...target, sha256 }), key).toString('base64'),
    }]
  })
  if (!assets.length) throw new Error(`No installable packages for ${options.version} (expected dmg or deb)`)
  const seen = new Set<string>()
  for (const a of assets) {
    const id = `${a.platform}-${a.arch}`
    if (seen.has(id)) throw new Error(`More than one package for ${id}`)
    seen.add(id)
  }
  return {
    apiVersion: 'v1' as const,
    version: options.version,
    channel: options.channel,
    publishedAt: options.publishedAt,
    notesUrl: options.notesUrl,
    assets,
  }
}
