/* eslint-disable n/no-unsupported-features/node-builtins */
import { MinecraftFolder, MinecraftLocation, ResolvedLibrary, ResolvedVersion } from '@xmcl/core'
import { isNotNull } from '@xmcl/core/utils'
import { open, walkEntriesGenerator } from '@xmcl/unzip'
import { stat } from 'fs/promises'
import { join } from 'path'
import { diagnoseFile } from './diagnose'
import { type InstallFile } from './installManifest'
import { Tracker, WithDownload } from './tracker'
import { WithDiagnose } from './utils'
import { joinUrl, normalizeArray } from './utils.browser'

export interface LibrariesTrackerEvents {
  libraries: WithDownload<{ count: number }>
}

/**
 * The function to swap library host.
 */
export type LibraryHost = (library: ResolvedLibrary) => string | string[] | undefined

/**
 * Change the library host url
 */
export interface LibraryOptions extends WithDiagnose {
  /**
   * A more flexiable way to control library download url.
   * @see mavenHost
   */
  libraryHost?: LibraryHost
  /**
   * The alterative maven host to download library. It will try to use these host from the `[0]` to the `[maven.length - 1]`
   */
  mavenHost?: string | string[]
  /**
   * The tracker to track the install process
   */
  tracker?: Tracker<LibrariesTrackerEvents>
  /**
   * Custom checksum function for file validation
   */
  checksum?: (file: string, algorithm: string) => Promise<string>

  strict?: boolean

  signal?: AbortSignal
}

export type InstallLibraryVersion = Pick<ResolvedVersion, 'libraries' | 'minecraftDirectory'>

export function resolveLibraryInstallFiles(
  libraries: ResolvedLibrary[],
  minecraft: MinecraftFolder,
  options: LibraryOptions = {},
): InstallFile[] {
  return libraries.map((library) => {
    const urls = resolveLibraryDownloadUrls(library, options)
    return {
      path: join(minecraft.libraries, library.download.path),
      urls: urls.length > 2 ? urls.concat(urls) : urls,
      size: library.download.size,
      checksum: library.download.sha1
        ? { algorithm: 'sha1', value: library.download.sha1 }
        : undefined,
      validator: library.download.sha1 ? undefined : 'zip',
      validatedAt: options.timestamp,
    }
  })
}

/**
 * Install all the libraries of providing version
 * @param version The target version
 * @param options The library host swap option
 */

const DEFAULT_MAVENS = ['https://repo1.maven.org/maven2/']

/**
 * Resolve a library download urls with fallback.
 *
 * @param library The resolved library
 * @param libraryOptions The library install options
 */
export function resolveLibraryDownloadUrls(
  library: ResolvedLibrary,
  libraryOptions: LibraryOptions,
): string[] {
  const urls = libraryOptions.libraryHost?.(library) ?? [
    ...normalizeArray(libraryOptions.mavenHost).map((m) => joinUrl(m, library.download.path)),
    library.download.url,
    ...DEFAULT_MAVENS.map((m) => joinUrl(m, library.download.path)),
  ]

  return [...new Set(normalizeArray(urls))]
}

/**
 * Diagnose all libraries presented in this resolved version.
 *
 * @param libraries The libraries to check
 * @param minecraft The minecraft location
 * @returns List of problematic libraries
 */
export async function diagnoseLibraries(
  libraries: ResolvedLibrary[],
  minecraft: MinecraftFolder,
  options?: {
    signal?: AbortSignal
    strict?: boolean
    checksum?: (file: string, algorithm: string) => Promise<string>
    timestamp?: number
  },
): Promise<Array<ResolvedLibrary>> {
  const signal = options?.signal
  const issues = await Promise.all(
    libraries.map(async (lib) => {
      if (!lib.download.path) {
        throw new TypeError(`Cannot diagnose library without path! ${JSON.stringify(lib)}`)
      }
      const libPath = minecraft.getLibraryByPath(lib.download.path)
      if (!options?.strict) {
        if (lib.download.sha1) {
          const issue = await diagnoseFile(
            {
              file: libPath,
              expectedChecksum: lib.download.sha1,
              role: 'library',
              hint: 'Reinstall the library files.',
            },
            options,
          )
          if (issue) {
            return lib
          }
        } else {
          // ensure this is a wellformed zip file
          try {
            const zip = await open(libPath)
            try {
              for await (const _ of walkEntriesGenerator(zip)) {
              }
            } finally {
              zip.close()
            }
          } catch {
            return lib
          }
        }
      } else {
        // non-strict mode might be faster
        const size = lib.download.size
        const { size: realSize } = await stat(libPath).catch(() => ({ size: -1 }))
        if (signal?.aborted) return
        if (size !== -1 && realSize !== size) {
          const issue = await diagnoseFile(
            {
              file: libPath,
              expectedChecksum: lib.download.sha1,
              role: 'library',
              hint: 'Reinstall the library files.',
            },
            options,
          )
          if (issue) {
            return lib
          }
        }
      }
      return undefined
    }),
  )
  return issues.filter(isNotNull)
}
