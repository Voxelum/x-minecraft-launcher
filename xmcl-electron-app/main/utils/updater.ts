import { ElectronUpdateOperation, VARDRYNN_API_VERSION } from '@xmcl/runtime-api'
import type { ReleaseFile, ReleaseInfo, UpdateCapability } from '@xmcl/runtime-api'
import type { DownloadUpdateOptions, LauncherAppUpdater } from '@xmcl/runtime/app'
import { resolveVardrynnApiOrigin } from '~/app/vardrynnApiOrigin'
import {
  isNewerVersion,
  parseVardrynnRelease,
  parseVardrynnReleaseKey,
  selectVerifiedAsset,
  sha256File,
  verifyReleaseSignature,
} from '~/app/vardrynnRelease'
import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { mkdir, rename, rm } from 'fs/promises'
import { basename, join } from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import type ElectronLauncherApp from '../ElectronLauncherApp'

const CHECK_TIMEOUT = 10_000

export interface UpdaterOptions {
  /** Vardrynn service origin; updates are off without one. */
  origin?: string
  /** Raw Ed25519 public key that release signatures must verify against. */
  publicKey?: Buffer
  version: string
  platform: string
  arch: string
  stagingDirectory: string
  fetch: typeof fetch
  /** Hands a verified package to the OS. Resolves to an error message, or empty on success. */
  open: (path: string) => Promise<string>
  quit: () => void
}

function defaultOptions(app?: ElectronLauncherApp): UpdaterOptions {
  // Same inputs as `pluginFlights`, so both agree on whether the service is configured.
  const origin = resolveVardrynnApiOrigin(process.env.VARDRYNN_API_BASE_URL, {
    allowLoopback: process.env.NODE_ENV !== 'production',
  })
  return {
    origin,
    publicKey: parseVardrynnReleaseKey(process.env.VARDRYNN_RELEASE_PUBLIC_KEY),
    version: app?.version ?? '0.0.0',
    platform: process.platform,
    arch: process.arch,
    stagingDirectory: join(app?.appDataPath ?? '', 'updates'),
    fetch: (input, init) => (app?.fetch ?? fetch)(input as any, init),
    open: async (path) => (await import('electron')).shell.openPath(path),
    quit: () => app?.quit(),
  }
}

/**
 * Updates come only from the Vardrynn release endpoint and are accepted only with an
 * Ed25519 signature from the key compiled into this build. The signature covers the
 * file hash, version, platform and architecture; the download is then hashed in full.
 * Installation hands the verified package to the OS installer.
 */
export class ElectronUpdater implements LauncherAppUpdater {
  readonly #options: UpdaterOptions

  constructor(app?: ElectronLauncherApp, options?: Partial<UpdaterOptions>) {
    this.#options = { ...defaultOptions(app), ...options }
  }

  get capability(): UpdateCapability | undefined {
    return this.#options.origin && this.#options.publicKey
      ? undefined
      : { automatic: false, reason: 'not-configured' }
  }

  #configured() {
    const { origin, publicKey } = this.#options
    if (!origin || !publicKey) {
      throw new Error('Vardrynn updates are unavailable until a release source and signing key are configured')
    }
    return { origin, publicKey }
  }

  async checkUpdateTask(): Promise<ReleaseInfo> {
    const { origin, publicKey } = this.#configured()
    const response = await this.#options.fetch(new URL(`/${VARDRYNN_API_VERSION}/releases/latest`, origin), {
      // A redirect could leave the approved origin.
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(CHECK_TIMEOUT),
    })
    if (response.status === 404) throw new Error('No update info found')
    if (!response.ok) throw new Error(`Vardrynn release service responded ${response.status}`)
    const release = parseVardrynnRelease(await response.json().catch(() => undefined))
    if (!release) throw new Error('Vardrynn release service returned an incompatible response')
    const { platform, arch, version } = this.#options
    const asset = selectVerifiedAsset(release, platform, arch, publicKey)
    if (!asset) throw new Error(`No signed Vardrynn release for ${platform}-${arch}`)
    return {
      name: release.version,
      body: release.notesUrl,
      date: release.publishedAt,
      files: [{
        name: basename(new URL(asset.url).pathname),
        url: asset.url,
        platform: asset.platform,
        arch: asset.arch,
        sha256: asset.sha256,
        signature: asset.signature,
      }],
      newUpdate: isNewerVersion(release.version, version),
      operation: ElectronUpdateOperation.Verified,
    }
  }

  /** Never trust stored update info: re-check that the signature still verifies for this host. */
  #verifiedFile(info: ReleaseInfo): ReleaseFile & { sha256: string } {
    const { publicKey } = this.#configured()
    const file = info.files[0]
    if (
      info.operation !== ElectronUpdateOperation.Verified ||
      info.files.length !== 1 ||
      !file?.sha256 || !file.signature || !file.platform || !file.arch ||
      file.platform !== this.#options.platform || file.arch !== this.#options.arch ||
      !verifyReleaseSignature(publicKey, info.name, file as any)
    ) {
      throw new Error('Update is not a signed Vardrynn release for this system')
    }
    const parsed = parseVardrynnRelease({
      apiVersion: VARDRYNN_API_VERSION, version: info.name, channel: '', publishedAt: '', notesUrl: '',
      assets: [file],
    })
    // A bad name could escape the staging directory; a bad url could reach an upstream host.
    if (!parsed?.assets.length || file.name !== basename(file.name) || file.name.startsWith('.')) {
      throw new Error('Update has an unsafe file reference')
    }
    return file as ReleaseFile & { sha256: string }
  }

  #stagedPath(info: ReleaseInfo, file: ReleaseFile) {
    return join(this.#options.stagingDirectory, info.name, file.name)
  }

  async downloadUpdate(info: ReleaseInfo, options?: DownloadUpdateOptions): Promise<void> {
    const file = this.#verifiedFile(info)
    const destination = this.#stagedPath(info, file)
    if (await sha256File(destination).then((h) => h === file.sha256, () => false)) return

    await mkdir(join(this.#options.stagingDirectory, info.name), { recursive: true })
    const partial = destination + '.partial'
    const hash = createHash('sha256')
    try {
      const response = await this.#options.fetch(file.url, { signal: options?.abortSignal })
      if (!response.ok || !response.body) throw new Error(`Update download responded ${response.status}`)
      await pipeline(
        Readable.fromWeb(response.body as any),
        new Transform({ transform(chunk, _, done) { hash.update(chunk); done(null, chunk) } }),
        createWriteStream(partial),
        { signal: options?.abortSignal },
      )
      if (hash.digest('hex') !== file.sha256) throw new Error('Downloaded update does not match its signed checksum')
      await rename(partial, destination)
    } catch (e) {
      await rm(partial, { force: true })
      throw e
    }
  }

  async installUpdateAndQuit(info: ReleaseInfo): Promise<void> {
    const file = this.#verifiedFile(info)
    const path = this.#stagedPath(info, file)
    // The staged file sat on disk since download, so it is hashed again before it runs.
    if ((await sha256File(path).catch(() => undefined)) !== file.sha256) {
      await rm(path, { force: true })
      throw new Error('Staged update is missing or does not match its signed checksum; download it again')
    }
    const failure = await this.#options.open(path)
    if (failure) throw new Error(`Cannot open the update package: ${failure}`)
    this.#options.quit()
  }
}
