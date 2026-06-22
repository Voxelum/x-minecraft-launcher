import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getCurseforgeModLoaderTypeFromRuntime } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { getModrinthModLoaders } from '@/util/modrinth'
import { HashAlgo } from '@xmcl/curseforge'
import { InstanceFile, RuntimeVersions } from '@xmcl/instance'
import { InstanceInstallServiceKey } from '@xmcl/runtime-api'
import { kInstance } from './instance'
import { kInstanceFiles } from './instanceFiles'
import { kInstanceModsContext } from './instanceMods'
import { kModDependenciesCheck } from './modDependenciesCheck'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export type UnresolvedMatchSource = 'modrinth-hash' | 'modrinth-name' | 'curseforge-name' | 'dependency'

export interface UnresolvedFileEntry {
  /**
   * The original unresolved file. It only has `path` and `hashes` (and maybe size).
   */
  file: InstanceFile
  /**
   * The file name derived from the file path.
   */
  fileName: string
  /**
   * The resolved instance file with a usable download source, if a match was found.
   */
  resolved?: InstanceFile
  /**
   * How the match was found.
   */
  matchedBy?: UnresolvedMatchSource
  /**
   * A human readable name of the match (project/mod title).
   */
  matchName?: string
  /**
   * Whether the user selected this file to ignore (bypass).
   */
  ignore: boolean
}

function getFileName(path: string) {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.(jar|zip|litemod)$/i, '')
}

/**
 * Mod loader names that show up as a standalone token inside a jar file name.
 * They mark the boundary between the human readable mod name and the
 * loader/version metadata, so we stop collecting name tokens once we hit one.
 */
const LOADER_TOKENS = new Set([
  'fabric',
  'forge',
  'quilt',
  'neoforge',
  'neoforged',
  'fabricmod',
  'forgemod',
])

/**
 * Whether a file-name token marks the start of the version/loader metadata
 * (e.g. `fabric`, `1.20.1`, `0.0.9`, `26.1`, `mc1.20`). Tokens like `3d` are
 * intentionally NOT treated as versions so names such as `3d-skin-layers`
 * survive.
 */
function isMetadataToken(token: string): boolean {
  if (LOADER_TOKENS.has(token.toLowerCase())) return true
  if (/^v?\d+(\.\d+)+/.test(token)) return true // 1.20.1, 0.0.9, v2.3.4
  if (/^\d+$/.test(token)) return true // bare numeric version
  if (/^mc\d/i.test(token)) return true // mc1.20.1
  return false
}

/**
 * Split a CamelCase token into separate words (`PresenceFootsteps` ->
 * `Presence Footsteps`) so the marketplace full-text search can match it.
 */
function splitCamelCase(token: string): string {
  return token.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

/**
 * Turn a jar file name into a marketplace search query by keeping only the
 * leading mod-name tokens and dropping the loader/version suffix. Searching the
 * raw file name (e.g. `boatiview-fabric-0.0.9-26.1`) returns nothing because of
 * the version noise.
 */
function getSearchQuery(fileName: string): string {
  const base = stripExtension(fileName)
  const tokens = base.split(/[-_+\s]+/).filter(Boolean)
  const kept: string[] = []
  for (const token of tokens) {
    if (isMetadataToken(token)) break
    kept.push(token)
  }
  const chosen = kept.length > 0 ? kept : tokens.slice(0, 1)
  return chosen.map(splitCamelCase).join(' ').trim()
}

/**
 * Build a resolved {@link InstanceFile} that keeps the original target path but
 * carries a marketplace reference (and, for name matches, the marketplace
 * file's own hashes) so the backend can resolve a real download url and verify
 * it. When the match came from a name search the manifest sha1 is stale, so we
 * must validate against the matched file's hashes instead.
 */
function withSource(
  original: InstanceFile,
  source: {
    modrinth?: InstanceFile['modrinth']
    curseforge?: InstanceFile['curseforge']
    downloads?: string[]
    size?: number
    hashes?: InstanceFile['hashes']
  },
): InstanceFile {
  return {
    path: original.path,
    hashes: source.hashes ?? original.hashes,
    size: source.size ?? original.size,
    modrinth: source.modrinth,
    curseforge: source.curseforge,
    downloads: source.downloads,
  }
}

export function useUnresolvedFiles() {
  const { path, runtime } = injection(kInstance)
  const { unresolvedFiles } = injection(kInstanceFiles)
  const { mods } = injection(kInstanceModsContext)
  const dependenciesCheck = injection(kModDependenciesCheck)
  const { installInstanceFiles, dismissUnresolvedFiles } = useService(InstanceInstallServiceKey)

  const entries = ref([] as UnresolvedFileEntry[])

  // Rebuild the entry list whenever the unresolved files change, preserving any
  // resolution / ignore state the user already produced for the same path.
  watch(unresolvedFiles, (files) => {
    const previous = new Map(entries.value.map((e) => [e.file.path, e]))
    entries.value = (files ?? []).map((file) => {
      const prev = previous.get(file.path)
      return {
        file,
        fileName: getFileName(file.path),
        resolved: prev?.resolved,
        matchedBy: prev?.matchedBy,
        matchName: prev?.matchName,
        ignore: prev?.ignore ?? false,
      }
    })
  }, { immediate: true })

  async function matchByModrinthHash(targets: UnresolvedFileEntry[]) {
    const hashed = targets.filter((e) => !!e.file.hashes.sha1)
    if (hashed.length === 0) return
    const versions = await clientModrinthV2.getProjectVersionsByHash(
      hashed.map((e) => e.file.hashes.sha1),
      'sha1',
    ).catch(() => ({} as Record<string, any>))
    for (const entry of hashed) {
      const version = versions[entry.file.hashes.sha1]
      if (version) {
        entry.resolved = withSource(entry.file, {
          modrinth: { projectId: version.project_id, versionId: version.id },
        })
        entry.matchedBy = 'modrinth-hash'
        entry.matchName = version.name
      }
    }
  }

  async function matchByModrinthName(entry: UnresolvedFileEntry, runtimes: RuntimeVersions) {
    const query = getSearchQuery(entry.fileName)
    if (!query) return false
    const result = await clientModrinthV2.searchProjects({
      query,
      limit: 5,
    }).catch(() => undefined)
    const hits = result?.hits ?? []
    if (hits.length === 0) return false

    const loaders = getModrinthModLoaders(runtimes, false)
    const sha1 = entry.file.hashes.sha1
    const wantedName = entry.fileName.toLowerCase()

    // These files already failed the sha1 hash lookup, so we identify the right
    // version by an exact (case-insensitive) file name match. We deliberately do
    // NOT filter by minecraft version here: the file name uniquely identifies
    // the build, and odd/modpack-specific runtime versions would otherwise hide
    // valid matches.
    for (const hit of hits.slice(0, 5)) {
      const versions = await clientModrinthV2.getProjectVersions(hit.slug, {
        loaders: loaders.length > 0 ? loaders : undefined,
      }).catch(() => [])
      for (const v of versions) {
        const file = v.files.find(
          (f) => (sha1 && f.hashes.sha1 === sha1) || f.filename.toLowerCase() === wantedName,
        )
        if (file) {
          entry.resolved = withSource(entry.file, {
            modrinth: { projectId: v.project_id, versionId: v.id },
            hashes: file.hashes,
            size: file.size,
          })
          entry.matchedBy = 'modrinth-name'
          entry.matchName = hit.title
          return true
        }
      }
    }
    return false
  }

  async function matchByCurseforgeName(entry: UnresolvedFileEntry, runtimes: RuntimeVersions) {
    const query = getSearchQuery(entry.fileName)
    if (!query) return false
    const modLoaderType = getCurseforgeModLoaderTypeFromRuntime(runtimes)
    const search = await clientCurseforgeV1.searchMods({
      searchFilter: query,
      gameVersion: runtimes.minecraft,
      modLoaderType,
      pageSize: 10,
    }).catch(() => undefined)
    const candidates = search?.data ?? []
    if (candidates.length === 0) return false

    const sha1 = entry.file.hashes.sha1
    const wantedName = entry.fileName.toLowerCase()

    for (const mod of candidates.slice(0, 5)) {
      const { data: files } = await clientCurseforgeV1.getModFiles({
        modId: mod.id,
        modLoaderType,
        pageSize: 50,
      }).catch(() => ({ data: [] as Awaited<ReturnType<typeof clientCurseforgeV1.getFiles>> }))

      const matched = files.find((f) =>
        (sha1 && f.hashes.some((h) => h.algo === HashAlgo.Sha1 && h.value === sha1)) ||
        f.fileName.toLowerCase() === wantedName,
      )
      if (matched) {
        const matchedSha1 = matched.hashes.find((h) => h.algo === HashAlgo.Sha1)?.value
        entry.resolved = withSource(entry.file, {
          curseforge: { projectId: matched.modId, fileId: matched.id },
          hashes: matchedSha1 ? { sha1: matchedSha1 } : {},
          size: matched.fileLength,
        })
        entry.matchedBy = 'curseforge-name'
        entry.matchName = mod.name
        return true
      }
    }
    return false
  }

  function matchByDependencies(targets: UnresolvedFileEntry[]) {
    const installation = dependenciesCheck.installation.value
    if (installation.length === 0) return
    for (const entry of targets) {
      const sha1 = entry.file.hashes.sha1
      const dep = installation.find(([f]) =>
        getFileName(f.path) === entry.fileName ||
        (sha1 && f.hashes.sha1 === sha1),
      )
      if (dep) {
        const [depFile, sourceMod] = dep
        entry.resolved = withSource(entry.file, {
          modrinth: depFile.modrinth,
          curseforge: depFile.curseforge,
          downloads: depFile.downloads,
          hashes: depFile.hashes,
          size: depFile.size,
        })
        entry.matchedBy = 'dependency'
        entry.matchName = sourceMod.name
      }
    }
  }

  const { refresh: search, refreshing: searching, error: searchError } = useRefreshable(async () => {
    const runtimes = runtime.value
    const targets = entries.value.filter((e) => !e.resolved && !e.ignore)
    if (targets.length === 0) return

    // 1. Exact match by Modrinth sha1 hash (batched).
    await matchByModrinthHash(targets)

    // 2. Cross-check against the current mods' missing dependencies.
    await dependenciesCheck.refresh().catch(() => undefined)
    matchByDependencies(targets.filter((e) => !e.resolved))

    // 3. Fallback to name based search on Modrinth then CurseForge.
    const remaining = targets.filter((e) => !e.resolved)
    await Promise.allSettled(remaining.map(async (entry) => {
      if (await matchByModrinthName(entry, runtimes)) return
      await matchByCurseforgeName(entry, runtimes)
    }))

    // Trigger reactivity for the deep mutations above.
    entries.value = [...entries.value]
  })

  const matchedEntries = computed(() => entries.value.filter((e) => e.resolved && !e.ignore))
  const ignoredEntries = computed(() => entries.value.filter((e) => e.ignore))

  const { refresh: install, refreshing: installing, error: installError } = useRefreshable(async () => {
    const matched = matchedEntries.value
    if (matched.length === 0) return
    // Strip Vue reactivity: the resolved files live in a reactive ref, and
    // Electron's IPC cannot structured-clone reactive proxies ("An object could
    // not be cloned"). InstanceFile is flat data, so spreading each nested
    // field yields plain, cloneable objects.
    const files: InstanceFile[] = matched.map((e) => {
      const f = e.resolved!
      return {
        path: f.path,
        hashes: { ...f.hashes },
        size: f.size,
        modrinth: f.modrinth ? { ...f.modrinth } : undefined,
        curseforge: f.curseforge ? { ...f.curseforge } : undefined,
        downloads: f.downloads ? [...f.downloads] : undefined,
      }
    })
    // The backend reconciles `unresolved-files.json` after the install: files
    // that resolve successfully are dropped, ones that fail again are kept. So
    // no manual dismiss is needed here — the watcher will refresh the list.
    await installInstanceFiles({
      path: path.value,
      oldFiles: [],
      files,
    })
  })

  async function ignoreSelected() {
    const ignored = ignoredEntries.value.map((e) => e.file.path)
    if (ignored.length === 0) return
    await dismissUnresolvedFiles(path.value, ignored)
  }

  return {
    entries,
    search,
    searching,
    searchError,
    install,
    installing,
    installError,
    ignoreSelected,
    matchedEntries,
    ignoredEntries,
  }
}
