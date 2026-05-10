import { DownloadBaseOptions, DownloadMultipleOption, downloadMultiple } from '@xmcl/file-transfer'
import { Tracker, onDownloadMultiple } from '@xmcl/installer'
import { InstanceFile } from '@xmcl/instance'
import { InstallInstanceTrackerEvents } from '@xmcl/runtime-api'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { unlink } from 'fs-extra'
import { pipeline } from 'stream/promises'

/**
 * Hash algorithms we know how to verify post-download.
 *
 * Order matters: stronger algorithms are checked first when more than
 * one is available, but a single match against any of them is enough.
 */
const VERIFIABLE_ALGORITHMS = ['sha512', 'sha256', 'sha1'] as const
type VerifiableAlgorithm = (typeof VERIFIABLE_ALGORITHMS)[number]

/**
 * Hostnames whose HTTPS responses we trust enough to skip the
 * post-download streaming hash check. These are operationally
 * trusted CDNs that vend file URLs returned by the corresponding
 * mod-distribution APIs.
 *
 * The skip is gated on BOTH the hostname being on this list AND the
 * connection being HTTPS — without HTTPS, an in-flight MITM could
 * still replace bytes regardless of who operates the host.
 */
export const DEFAULT_TRUSTED_DOWNLOAD_HOSTS: ReadonlySet<string> = new Set([
  'edge.forgecdn.net',
  'mediafilez.forgecdn.net',
  'media.forgecdn.net',
  'cdn.modrinth.com',
])

export interface TrustedHostsConfig {
  /**
   * Hostnames to trust for the integrity-check skip.  Defaults to
   * {@link DEFAULT_TRUSTED_DOWNLOAD_HOSTS}.
   */
  hosts?: ReadonlySet<string>
  /**
   * Test-only escape hatch: also accept `http:` URLs from the trusted
   * host set.  Production code MUST leave this `false` — without
   * HTTPS, the byte stream is mutable in flight.
   */
  allowInsecureForTests?: boolean
}

function isTrustedUrl(url: string, cfg: Required<TrustedHostsConfig>): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const allowedProtocols = cfg.allowInsecureForTests
    ? ['https:', 'http:']
    : ['https:']
  if (!allowedProtocols.includes(parsed.protocol)) return false
  return cfg.hosts.has(parsed.hostname)
}

/**
 * A download is "trusted" when every candidate URL is on the trusted
 * host list. We must check every URL because `download()` falls back
 * through them in order and we don't know from outside which one
 * succeeded.
 */
function isTrustedDownload(
  url: string | string[],
  cfg: Required<TrustedHostsConfig>,
): boolean {
  const arr = typeof url === 'string' ? [url] : url
  if (arr.length === 0) return false
  return arr.every((u) => isTrustedUrl(u, cfg))
}

/**
 * Compute the digest of a file on disk in streaming fashion.
 */
async function computeFileHash(path: string, algorithm: VerifiableAlgorithm): Promise<string> {
  const hash = createHash(algorithm)
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

/**
 * Verify a freshly-downloaded file matches the manifest's declared
 * hash. Returns the algorithm that was checked, or `undefined` if the
 * manifest had no algorithm we know how to verify.
 *
 * Throws a `ChecksumNotMatchError`-shaped error on mismatch — caller
 * is responsible for unlinking the bad file.
 */
async function verifyDownloadedFile(
  file: InstanceFile,
  destination: string,
): Promise<VerifiableAlgorithm | undefined> {
  for (const alg of VERIFIABLE_ALGORITHMS) {
    const expected = file.hashes[alg]
    if (!expected) continue
    const actual = await computeFileHash(destination, alg)
    if (actual !== expected) {
      const e = new Error(
        `Checksum mismatch for ${file.path}: expected ${alg}=${expected}, got ${actual}`,
      ) as Error & { name: string; file: string; expect: string; actual: string; algorithm: string }
      e.name = 'ChecksumNotMatchError'
      e.file = destination
      e.expect = expected
      e.actual = actual
      e.algorithm = alg
      throw e
    }
    return alg
  }
  return undefined
}

/**
 * Maximum number of times a failed instance file download will be retried
 * before its error is propagated to the caller.
 */
const MAX_RETRY_COUNT = 3

function toDownloadOptions(opt: { options: DownloadMultipleOption; file: InstanceFile }) {
  return {
    url: opt.options.url,
    destination: opt.options.destination,
    headers: opt.options.headers,
    expectedTotal: (
      typeof opt.options.url === 'string'
        ? opt.options.url.includes('edge.forgecdn.net')
        : opt.options.url.some((u) => u.includes('edge.forgecdn.net'))
    )
      ? undefined
      : opt.options.expectedTotal,
  }
}

/**
 * Download instance files with progress tracking.
 *
 * Failed downloads (transport failures or post-download hash
 * verification failures) are retried up to {@link MAX_RETRY_COUNT}
 * times before their errors are aggregated and thrown.
 */
export async function downloadInstanceFiles(
  options: Array<{ options: DownloadMultipleOption; file: InstanceFile }>,
  finished: Set<string>,
  signal: AbortSignal,
  downloadOptions: DownloadBaseOptions,
  tracker?: Tracker<InstallInstanceTrackerEvents>,
  trustedHosts?: TrustedHostsConfig,
): Promise<void> {
  const trustCfg: Required<TrustedHostsConfig> = {
    hosts: trustedHosts?.hosts ?? DEFAULT_TRUSTED_DOWNLOAD_HOSTS,
    allowInsecureForTests: trustedHosts?.allowInsecureForTests ?? false,
  }
  const parent = onDownloadMultiple(tracker, 'install-instance.download', { count: options.length })

  // Run a single download + verification pass over the provided
  // options, returning the errors and the subset of options that
  // failed (so they can be retried).
  //
  // For each successfully-downloaded file, verify its content matches
  // the manifest's declared hash. The underlying file-transfer download
  // primitive does NOT enforce the `validator` field, so we re-check
  // here. Without this step a poisoned mirror, MITM, or compromised
  // CDN can replace any modpack file with arbitrary code and the
  // launcher will install it without complaint.
  //
  // We skip the check for files that were fetched from a trusted host
  // set (HTTPS-only) — on a multi-GB modpack with hundreds of small
  // mods on edge.forgecdn.net this avoids a full second-pass disk
  // read + hash for each file.
  const runPass = async (
    pass: Array<{ options: DownloadMultipleOption; file: InstanceFile }>,
  ) => {
    const results = await downloadMultiple({
      options: pass.map(toDownloadOptions),
      signal: signal,
      tracker: parent,
      ...downloadOptions,
    })

    const passErrors: Error[] = []
    const passPending: typeof pass = []
    await Promise.all(
      results.map(async (result, i) => {
        if (result.status === 'rejected') {
          passErrors.push(result.reason)
          passPending.push(pass[i])
          return
        }
        const { file, options: opts } = pass[i]
        try {
          if (!isTrustedDownload(opts.url, trustCfg)) {
            await verifyDownloadedFile(file, opts.destination)
          }
          finished.add(file.path)
        } catch (e) {
          // Bad content must NOT remain on disk where it could be picked
          // up by a later resume that thinks the file is good.
          await unlink(opts.destination).catch(() => undefined)
          passErrors.push(e as Error)
          passPending.push(pass[i])
        }
      }),
    )

    return { errors: passErrors, pending: passPending }
  }

  let { errors, pending } = await runPass(options)

  for (let attempt = 0; attempt < MAX_RETRY_COUNT && pending.length > 0; attempt++) {
    signal.throwIfAborted()
    const next = await runPass(pending)
    errors = next.errors
    pending = next.pending
  }

  if (errors.length > 0) {
    throw new AggregateError(errors)
  }
}
