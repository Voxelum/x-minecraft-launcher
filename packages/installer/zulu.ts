import { WithDownload, WithProgress } from './tracker'

/**
 * Tracker events for Zulu Java installation
 */
export interface ZuluTrackerEvents {
  'zulu-java.download': WithDownload<{   }>
  'zulu-java.extract': WithProgress<{ url: string }>
}

/**
 * Zulu JRE download information
 */
export interface ZuluJRE {
  /**
   * Features of this JRE build (e.g., javafx, musl, crac)
   */
  features: string[]
  /**
   * Target architecture (e.g., x64, arm64, ia32)
   */
  architecture: string
  /**
   * Target operating system (e.g., win32, linux, darwin)
   */
  os: string
  /**
   * SHA256 hash of the download file
   */
  sha256: string
  /**
   * Size of the download file in bytes
   */
  size: number
  /**
   * Download URL for the JRE
   */
  url: string
}

/**
 * Detect whether the current Linux host uses the musl C library (Alpine and
 * similar) rather than glibc. A musl-linked JRE only runs on musl systems and
 * a glibc-linked JRE only runs on glibc systems; picking the wrong one makes
 * the `java` binary fail to `exec` with `ENOENT` (its dynamic loader, e.g.
 * `/lib/ld-musl-x86-64.so.1`, is absent). See the launch `launchInvalidJavaPath`
 * failures reported by users on non-musl distros.
 *
 * Uses the Node.js diagnostic report: glibc builds expose
 * `header.glibcVersionRuntime`, musl builds do not (and their loaded shared
 * objects reference `ld-musl`/`libc.musl`).
 */
export function detectLibc(platform: string = process.platform): 'musl' | 'glibc' {
  if (platform !== 'linux') return 'glibc'
  try {
    const report: any =
      typeof (process as any).report?.getReport === 'function'
        ? (process as any).report.getReport()
        : undefined
    if (report) {
      if (report.header && report.header.glibcVersionRuntime) {
        return 'glibc'
      }
      const shared: string[] = Array.isArray(report.sharedObjects) ? report.sharedObjects : []
      if (shared.some((s) => /ld-musl-|libc\.musl-/.test(s))) {
        return 'musl'
      }
      // On glibc the report always carries glibcVersionRuntime; its absence
      // together with no musl shared objects is inconclusive, so fall through.
      if (report.header && 'glibcVersionRuntime' in report.header) {
        return 'glibc'
      }
    }
  } catch {
    // ignore and fall back to the safe default below
  }
  // Default to glibc: it is by far the most common desktop libc, and shipping a
  // glibc JRE to a musl host is the rarer, opt-in case.
  return 'glibc'
}

/**
 * Select the best Zulu JRE from an array of options based on current platform and preferences
 * @param jres Array of available Zulu JRE options
 * @param platform Target platform (defaults to current platform)
 * @param arch Target architecture (defaults to current architecture)
 * @param libc Target C library on Linux (defaults to auto-detecting the host)
 * @returns The best matching Zulu JRE or undefined if none found
 */
export function selectZuluJRE(
  jres: ZuluJRE[],
  platform: string = process.platform,
  arch: string = process.arch,
  libc: 'musl' | 'glibc' = detectLibc(platform),
): ZuluJRE | undefined {
  // Normalize platform names
  const normalizedPlatform =
    platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : 'linux'

  // Normalize architecture names
  const normalizedArch =
    arch === 'x64'
      ? 'x64'
      : arch === 'arm64'
        ? 'arm64'
        : arch === 'ia32' || arch === 'x86'
          ? 'ia32'
          : arch

  // Filter by platform and architecture
  const targets = jres.filter(
    (jre) => jre.os === normalizedPlatform && jre.architecture === normalizedArch,
  )

  if (targets.length === 0) {
    return undefined
  }

  // musl and glibc builds are not interchangeable. On Linux, keep only the
  // builds matching the host libc so we never hand a musl JRE to a glibc
  // system (or vice versa), which would fail to exec. On non-Linux platforms
  // musl is irrelevant, so simply drop any musl-tagged entries.
  let candidates = targets
  if (normalizedPlatform === 'linux') {
    const matching = targets.filter((jre) =>
      libc === 'musl' ? jre.features.includes('musl') : !jre.features.includes('musl'),
    )
    // Only narrow when at least one compatible build exists; otherwise fall
    // back to the full set so we still return something rather than undefined.
    if (matching.length > 0) {
      candidates = matching
    }
  } else {
    const nonMusl = targets.filter((jre) => !jre.features.includes('musl'))
    if (nonMusl.length > 0) {
      candidates = nonMusl
    }
  }

  // Preference order among compatible builds: javafx > default
  const withJavafx = candidates.find((jre) => jre.features.includes('javafx'))
  if (withJavafx) {
    return withJavafx
  }

  // Return the first available option
  return candidates[0]
}
