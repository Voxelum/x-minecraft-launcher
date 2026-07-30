import { constants } from 'fs'
import { access, chmod } from 'fs-extra'
import { open, type FileHandle } from 'fs/promises'
import { isSystemError } from '@xmcl/utils'
import { ENOENT_ERROR, EPERM_ERROR } from '../util/fs'
import { isNonnull } from '../util/object'
import { Platform } from '@xmcl/runtime-api'
import { join } from 'path'

export enum JavaValidation {
  Okay,
  NotExisted,
  NoPermission,
}

/**
 * The phase at which an internal default-Java install failed, derived from
 * filesystem probes after `resolveJava` could not resolve the binary. Used to
 * make `InstallDefaultJavaError` telemetry actionable (download vs parse).
 */
export type JavaInstallFailurePhase = 'download-or-extract' | 'permission' | 'parse-or-spawn'

export interface JavaInstallFailureProbe {
  /** Whether the `java`/`java.exe` binary exists on disk after install. */
  exeExists: boolean
  /** `validateJavaPath` result for the binary, if it could be computed. */
  validation: JavaValidation | undefined
}

/**
 * A 32-bit Node/Electron process on 64-bit Windows reports `ia32`. Windows
 * exposes the native host architecture through PROCESSOR_ARCHITEW6432 under
 * WOW64, which lets default-Java selection avoid choosing an unsupported x86
 * runtime when Mojang does not publish one.
 */
export function getWindowsNativeArchForIa32(
  platform = process.platform,
  arch = process.arch,
  environment = process.env,
): 'x64' | 'arm64' | undefined {
  if (platform !== 'win32' || arch !== 'ia32') return undefined
  switch (environment.PROCESSOR_ARCHITEW6432?.toUpperCase()) {
    case 'AMD64': return 'x64'
    case 'ARM64': return 'arm64'
    default: return undefined
  }
}

/**
 * Keep Java process output actionable without sending the user's home path or
 * an unbounded native-loader dump to telemetry.
 */
export function sanitizeJavaResolveOutput(output: string | undefined) {
  if (!output) return undefined
  return output
    .replace(/(?:[A-Za-z]:[\\/]|\/(?:home|Users)\/)[^\r\n]*/g, '<path>')
    .slice(0, 1024)
}

/**
 * Classify why an internal Java install produced an unresolvable binary.
 *
 * - `download-or-extract`: the installer resolved without throwing yet no
 *   binary landed — the archive never downloaded or extracted to the expected
 *   layout.
 * - `permission`: the binary exists but lacks exec permission.
 * - `parse-or-spawn`: the binary exists and is accessible but the JVM cannot
 *   be spawned or its version parsed (corrupt download, wrong arch, missing
 *   native deps).
 */
export function classifyJavaInstallFailure({ exeExists, validation }: JavaInstallFailureProbe): JavaInstallFailurePhase {
  if (!exeExists) {
    return 'download-or-extract'
  }
  if (validation === JavaValidation.NoPermission) {
    return 'permission'
  }
  return 'parse-or-spawn'
}

export function getJavaExeFilePath(javaPath: string, platform: Platform) {
  return platform.os === 'osx' && !javaPath.endsWith('zulu')
    ? join(javaPath, 'jre.bundle', 'Contents', 'Home', 'bin', 'java')
    : join(javaPath, 'bin',
      platform.os === 'windows' ? 'java.exe' : 'java')
}

export async function validateJavaPath(javaPath: string): Promise<JavaValidation> {
  try {
    await access(javaPath, constants.X_OK)
    return JavaValidation.Okay
  } catch (e) {
    if (isSystemError(e)) {
      if (e.code === ENOENT_ERROR) {
        return JavaValidation.NotExisted
      } else if (e.code === EPERM_ERROR || e.code === 'EACCES') {
        try {
          return await chmod(javaPath, 0o765).then(() => JavaValidation.Okay, () => JavaValidation.NoPermission)
        } catch {
          return JavaValidation.NoPermission
        }
      }
    }
    throw e
  }
}

/**
 * Detect the C library an ELF executable is dynamically linked against by
 * reading the absolute path of the dynamic loader baked into its `PT_INTERP`
 * program header — a `ld-musl-*` interpreter means musl, a `ld-linux*` /
 * `ld.so` interpreter means glibc.
 *
 * This lets us spot a musl-vs-glibc mismatch (e.g. a musl-linked JRE resolved
 * on a glibc host, or vice versa) *without* spawning the binary, which would
 * otherwise fail with a cryptic `ENOENT` because the loader referenced here is
 * absent on the host. Returns `undefined` for non-ELF files, statically linked
 * binaries (no `PT_INTERP`), or when the header cannot be read.
 */
export async function detectExecutableLibc(exePath: string): Promise<'musl' | 'glibc' | undefined> {
  let handle: FileHandle | undefined
  try {
    handle = await open(exePath, 'r')

    const header = Buffer.alloc(64)
    const { bytesRead } = await handle.read(header, 0, 64, 0)
    if (bytesRead < 64) return undefined
    // ELF magic: 0x7F 'E' 'L' 'F'
    if (header[0] !== 0x7f || header[1] !== 0x45 || header[2] !== 0x4c || header[3] !== 0x46) {
      return undefined
    }

    const is64 = header[4] === 2
    const isLE = header[5] === 1
    const readUInt = (buf: Buffer, offset: number, size: 2 | 4 | 8): number => {
      if (size === 8) return Number(isLE ? buf.readBigUInt64LE(offset) : buf.readBigUInt64BE(offset))
      if (size === 4) return isLE ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset)
      return isLE ? buf.readUInt16LE(offset) : buf.readUInt16BE(offset)
    }

    const phoff = is64 ? readUInt(header, 0x20, 8) : readUInt(header, 0x1c, 4)
    const phentsize = is64 ? readUInt(header, 0x36, 2) : readUInt(header, 0x2a, 2)
    const phnum = is64 ? readUInt(header, 0x38, 2) : readUInt(header, 0x2c, 2)
    // Guard against corrupt/huge headers so we never allocate wildly.
    if (!phoff || !phentsize || !phnum || phnum > 128) return undefined

    const phTable = Buffer.alloc(phentsize * phnum)
    const { bytesRead: phRead } = await handle.read(phTable, 0, phTable.length, phoff)
    if (phRead < phTable.length) return undefined

    const PT_INTERP = 3
    for (let i = 0; i < phnum; i++) {
      const base = i * phentsize
      if (readUInt(phTable, base, 4) !== PT_INTERP) continue
      const pOffset = is64 ? readUInt(phTable, base + 8, 8) : readUInt(phTable, base + 4, 4)
      const pFilesz = is64 ? readUInt(phTable, base + 32, 8) : readUInt(phTable, base + 16, 4)
      if (!pFilesz || pFilesz > 4096) return undefined

      const interp = Buffer.alloc(pFilesz)
      const { bytesRead: iRead } = await handle.read(interp, 0, pFilesz, pOffset)
      if (iRead < pFilesz) return undefined
      const nulIndex = interp.indexOf(0)
      const interpStr = interp.toString('utf-8', 0, nulIndex >= 0 ? nulIndex : pFilesz)

      if (interpStr.includes('ld-musl')) return 'musl'
      if (interpStr.includes('ld-linux') || interpStr.includes('/ld.so') || interpStr.includes('ld64.so')) return 'glibc'
      return undefined
    }
    return undefined
  } catch {
    return undefined
  } finally {
    await handle?.close().catch(() => {})
  }
}

export interface TsingHuaJreTarget {
  fileName: string
  /**
     * Url to download
     */
  url: string
  /**
     * The sha256 url of the download
     */
  sha256Url?: string
}

export function parseTsingHuaAdoptOpenJDKFileList(fileList: string[], os: 'linux' | 'windows' | 'unknown' | 'mac', arch: '32' | '64'): TsingHuaJreTarget | undefined {
  const list = fileList.map(l => l.split('/').slice(5))
  const zipFile = list.find(l => l[0] === 'jre' &&
    l[1] === `x${arch}` &&
    l[2] === os &&
    (l[3].endsWith('.zip') || l[3].endsWith('.tar.gz')))
  if (zipFile) {
    const sha256File = list.find(l => l[3] === `${zipFile[3]}.sha256.txt`)
    return {
      fileName: zipFile[zipFile.length - 1],
      url: `https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/${zipFile.join('/')}`,
      sha256Url: sha256File ? `https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/${sha256File?.join('/')}` : undefined,
    }
  }
  return undefined
}

export function parseTsingHuaAdpotOpenJDKHotspotArchive(pageText: string, baseUrl: string): TsingHuaJreTarget | undefined {
  const exp = /<a href="([a-zA-Z0-9-._]+)" title="([a-zA-Z0-9-._]+)">/g
  const result = pageText.match(exp)

  const targets = result?.map((r) => new RegExp(exp).exec(r))
    .filter(isNonnull)
    .map((a) => a[1]) ?? []

  const target = targets.find((target) => (target.indexOf('hotspot') !== -1 && target.endsWith('.zip')) || target.endsWith('.tar.gz'))
  if (target) {
    return {
      fileName: target,
      url: `${baseUrl}${target}`,
    }
  }

  return undefined
}

export function getTsingHuaAdpotOponJDKPageUrl(os: 'linux' | 'windows' | 'unknown' | 'mac', arch: '32' | '64', java: '8' | '9' | '11' | '12' | '13' | '14' | '15' | '16') {
  return `https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/${java}/jre/x${arch}/${os}/`
}
