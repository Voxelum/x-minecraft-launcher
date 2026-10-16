import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { BuiltinImages } from '@/constant'
import { clientModrinthV2 } from '@/util/clients'

export interface ModloaderVersion {
  version: string
  stable?: boolean
  fileUrl?: string
  fileName?: string
  loaders?: string[]
  gameVersions?: string[]
  size?: number
  sha1?: string
}

export interface ModloaderItem {
  id: string
  name: string
  icon: string
  apiUrl?: string
  builtin?: boolean
  versions?: ModloaderVersion[]
  gameVersions?: string[]
  projectType?: 'mod' | 'loader'
  targetLoaders?: string[]
}

export const KNOWN_LOADER_ICONS: Record<string, string> = {
  babric: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="%23d32f2f"/><path d="M15 11h11a7 7 0 0 1 0 14h-11z M15 23h12a7 7 0 0 1 0 14h-12z" fill="%23ffffff" fill-rule="evenodd"/><circle cx="24" cy="24" r="3" fill="%23ffffff"/></svg>',
  'legacy-fabric': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="%23e67e22"/><path d="M14 12v24h6v-18h12v-6z M26 22v14h6v-8h8v-6z" fill="%23ffffff"/></svg>',
  ornithe: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="%2316a085"/><circle cx="24" cy="24" r="14" fill="none" stroke="%23ffffff" stroke-width="6"/></svg>',
  cleanroom: 'https://avatars.githubusercontent.com/u/96911867?v=4',
  liteloader: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%233498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3.924 21.537s3.561-1.111 8.076-6.365c2.544-2.959 2.311-1.986 4-4.172"/><path d="m7.778 19s1.208-0.48 4.222 0c2.283 0.364 6.037-4.602 6.825-6.702 1.939-5.165 0.894-10.431 0.894-10.431s-4.277 4.936-6.855 7.133c-5.105 4.352-6.509 11-6.509 11"/></svg>',
}

export const KNOWN_LOADER_METAS: Record<string, { apiUrl: string; gameVersions: string[]; name: string; defaultVersion?: string }> = {
  babric: {
    apiUrl: 'https://meta.babric.glass-launcher.net/v2/versions/loader',
    gameVersions: ['b1.7.3', 'b1.7.2'],
    name: 'Babric',
    defaultVersion: '0.19.5',
  },
  cleanroom: {
    apiUrl: 'https://api.github.com/repos/CleanroomMC/Cleanroom/releases',
    gameVersions: ['1.12.2'],
    name: 'Cleanroom',
    defaultVersion: '0.7.6-alpha',
  },
  liteloader: {
    apiUrl: 'https://dl.liteloader.com/versions/versions.json',
    gameVersions: [
      '1.12.2', '1.12.1', '1.12',
      '1.11.2', '1.11',
      '1.10.2', '1.10',
      '1.9.4', '1.9',
      '1.8.9', '1.8',
      '1.7.10', '1.7.2',
      '1.6.4', '1.6.2',
      '1.5.2',
    ],
    name: 'LiteLoader',
    defaultVersion: '1.12.2-SNAPSHOT',
  },
  'legacy-fabric': {
    apiUrl: 'https://meta.legacyfabric.net/v2/versions/loader',
    gameVersions: [
      '1.13.2', '1.13.1', '1.13',
      '1.12.2', '1.12.1', '1.12',
      '1.11.2', '1.11.1', '1.11',
      '1.10.2', '1.10.1', '1.10',
      '1.9.4', '1.9.3', '1.9.2', '1.9.1', '1.9',
      '1.8.9', '1.8.8', '1.8',
      '1.7.10', '1.7.9', '1.7.2',
      '1.6.4', '1.5.2', '1.4.7', '1.3.2',
    ],
    name: 'Legacy Fabric',
    defaultVersion: '0.16.14',
  },
  ornithe: {
    apiUrl: 'https://meta.ornithemc.net/v3/versions/loader',
    gameVersions: [
      '1.13.2', '1.12.2', '1.8.9', '1.7.10', '1.6.4', '1.5.2', '1.4.7', '1.3.2', '1.2.5', '1.1', '1.0.0',
      'b1.8.1', 'b1.7.3', 'b1.6.6', 'b1.5_01', 'b1.4_01', 'b1.3_01', 'b1.2_02', 'b1.1_02',
      'a1.2.6', 'a1.1.2_01', 'a1.0.17_04',
      'c0.30_01c', 'c0.0.13a_03', 'rd-132211',
    ],
    name: 'Ornithe',
    defaultVersion: '0.16.10',
  },
}

export const KNOWN_LOADER_GAMES: Record<string, string[]> = {
  'legacy-fabric': KNOWN_LOADER_METAS['legacy-fabric'].gameVersions,
  babric: KNOWN_LOADER_METAS['babric'].gameVersions,
  ornithe: KNOWN_LOADER_METAS['ornithe'].gameVersions,
  cleanroom: KNOWN_LOADER_METAS['cleanroom'].gameVersions,
  liteloader: KNOWN_LOADER_METAS['liteloader'].gameVersions,
}

export function resolveFabricCustomLoader(minecraft?: string, loaderVersion?: string, icon?: string, versionId?: string): { name: string; icon?: string } | undefined {
  if (!minecraft) return undefined

  if (icon === KNOWN_LOADER_ICONS.ornithe || versionId === 'ornithe' || versionId?.includes('ornithe')) {
    return { name: 'Ornithe', icon: KNOWN_LOADER_ICONS.ornithe }
  }
  if (icon === KNOWN_LOADER_ICONS.babric || versionId === 'babric' || versionId?.includes('babric')) {
    return { name: 'Babric', icon: KNOWN_LOADER_ICONS.babric }
  }
  if (icon === KNOWN_LOADER_ICONS['legacy-fabric'] || versionId === 'legacy-fabric' || versionId?.includes('legacy-fabric')) {
    return { name: 'Legacy Fabric', icon: KNOWN_LOADER_ICONS['legacy-fabric'] }
  }

  // 1. Babric is ONLY for b1.7.3 and b1.7.2
  if (minecraft === 'b1.7.3' || minecraft === 'b1.7.2') {
    return { name: 'Babric', icon: KNOWN_LOADER_ICONS['babric'] }
  }

  // 2. Game versions specific to either Legacy Fabric or Ornithe
  const isOrnithe = KNOWN_LOADER_METAS.ornithe.gameVersions.includes(minecraft)
  const isLegacy = KNOWN_LOADER_METAS['legacy-fabric'].gameVersions.includes(minecraft)
  if (isOrnithe && !isLegacy) {
    return { name: 'Ornithe', icon: KNOWN_LOADER_ICONS['ornithe'] }
  }
  if (isLegacy && !isOrnithe) {
    return { name: 'Legacy Fabric', icon: KNOWN_LOADER_ICONS['legacy-fabric'] }
  }
  if (isLegacy) {
    return { name: 'Legacy Fabric', icon: KNOWN_LOADER_ICONS['legacy-fabric'] }
  }

  // 4. Other custom modloaders from localStorage:
  // MUST be a custom loader fork (NOT a mod like Sinytra Connector),
  // and MUST match both gameVersion AND the custom loader version!
  let customList: ModloaderItem[] = []
  try {
    const storage = typeof window !== 'undefined' && window.localStorage
      ? window.localStorage
      : (typeof globalThis !== 'undefined' && (globalThis as any).localStorage
        ? (globalThis as any).localStorage
        : (typeof localStorage !== 'undefined' ? localStorage : undefined))
    const raw = storage
      ? (storage.getItem('xmcl_user_custom_modloaders') || storage.getItem('modloaders_custom_v1'))
      : null
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        customList = parsed
      }
    }
  } catch {}

  const match = customList.find((l) =>
    l.id &&
    !DEFAULT_LOADER_IDS.includes(l.id) &&
    l.projectType !== 'mod' &&
    !l.id.toLowerCase().includes('connector') &&
    l.gameVersions &&
    l.gameVersions.length > 0 &&
    l.gameVersions.includes(minecraft) &&
    loaderVersion &&
    l.versions &&
    l.versions.some((v) => v.version === loaderVersion)
  )
  if (match) {
    return {
      name: match.name || match.id,
      icon: match.icon && match.icon !== BuiltinImages.craftingTable ? match.icon : KNOWN_LOADER_ICONS[match.id],
    }
  }

  // Official Minecraft (1.14, 1.16, 1.20, 1.21, etc.) with Fabric -> Standard Fabric (NOT custom)
  return undefined
}

export function resolveCustomLoaderFromInstance(
  instance: { icon?: string; version?: string; name?: string; runtime?: { minecraft?: string; fabricLoader?: string } },
  allLoaders: ModloaderItem[]
): { name: string; icon?: string; version?: string } | undefined {
  if (instance.runtime?.fabricLoader) {
    const f = resolveFabricCustomLoader(instance.runtime.minecraft, instance.runtime.fabricLoader)
    if (f) return f
  }
  const customList = allLoaders.filter((c) => !DEFAULT_LOADER_IDS.includes(c.id))
  // 1. By icon
  if (instance.icon) {
    const byIcon = customList.find((c) => c.icon === instance.icon || KNOWN_LOADER_ICONS[c.id] === instance.icon)
    if (byIcon) {
      let verStr: string | undefined
      if (instance.version) {
        const parts = instance.version.split('-')
        verStr = parts.length > 1 ? parts[parts.length - 1] : instance.version
      }
      return { name: byIcon.name, icon: byIcon.icon, version: verStr }
    }
  }
  // 2. By version
  if (instance.version) {
    const byVer = customList.find((c) =>
      (!c.gameVersions || c.gameVersions.length === 0 || !instance.runtime?.minecraft || c.gameVersions.includes(instance.runtime.minecraft)) &&
      (c.versions?.some((v) => v.version === instance.version) ||
       instance.version!.toLowerCase().includes(c.id.toLowerCase()) ||
       instance.version!.toLowerCase().includes(c.name.toLowerCase()))
    )
    if (byVer) {
      const parts = instance.version.split('-')
      const verStr = parts.length > 1 ? parts[parts.length - 1] : instance.version
      return { name: byVer.name, icon: byVer.icon, version: verStr }
    }
  }
  // 3. By name
  if (instance.name) {
    const byName = customList.find((c) =>
      instance.name!.toLowerCase().includes(c.id.toLowerCase()) ||
      instance.name!.toLowerCase().includes(c.name.toLowerCase())
    )
    if (byName) return { name: byName.name, icon: byName.icon }
  }
  return undefined
}

export async function fetchGameVersionsFromApi(loaderApiUrl: string): Promise<string[]> {
  try {
    if (loaderApiUrl.includes('liteloader')) {
      const res = await fetch(loaderApiUrl)
      if (res.ok) {
        const data = await res.json()
        if (data.versions && typeof data.versions === 'object') {
          return Object.keys(data.versions)
        }
      }
    }
    let gameUrl = ''
    if (loaderApiUrl.includes('/loader')) {
      gameUrl = loaderApiUrl.replace(/\/loader(\/)?$/, '/game')
    } else if (loaderApiUrl.includes('/fabric-loader')) {
      gameUrl = loaderApiUrl.replace(/\/fabric-loader(\/)?$/, '/game')
    }
    if (gameUrl) {
      const res = await fetch(gameUrl)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          const list = data
            .map((item: any) => item?.version || item?.id || (typeof item === 'string' ? item : null))
            .filter((x): x is string => Boolean(x))
          if (list.length > 0) return list
        }
      }
    }
  } catch {
    // ignore
  }
  return []
}

export const BUILTIN_LOADERS: ModloaderItem[] = [
  { id: 'forge', name: 'Forge', icon: BuiltinImages.forge, builtin: true },
  { id: 'fabric', name: 'Fabric', icon: BuiltinImages.fabric, builtin: true },
  { id: 'quilt', name: 'Quilt', icon: BuiltinImages.quilt, builtin: true },
  { id: 'neoforge', name: 'NeoForged', icon: BuiltinImages.neoForged, builtin: true },
  { id: 'optifine', name: 'OptiFine', icon: BuiltinImages.optifine, builtin: true },
  { id: 'labymod', name: 'LabyMod', icon: BuiltinImages.labyMod, builtin: true },
]

export const DEFAULT_LOADER_IDS = BUILTIN_LOADERS.map((b) => b.id)

export function parseVersionsFromApiResponse(data: any): ModloaderVersion[] {
  const versions: ModloaderVersion[] = []
  if (Array.isArray(data)) {
    for (const item of data) {
      const ver = item?.loader?.version || item?.version || item?.tag_name || item?.name || item?.id
      const stable = item?.loader?.stable ?? item?.stable ?? !item?.prerelease
      if (ver) {
        const asset = item?.assets?.find((a: any) => a.name.endsWith('installer.jar')) ||
          item?.assets?.find((a: any) => a.name.endsWith('universal.jar')) ||
          item?.assets?.find((a: any) => a.name.endsWith('.jar'))
        versions.push({
          version: String(ver),
          stable: Boolean(stable),
          ...(asset ? { fileUrl: asset.browser_download_url, fileName: asset.name, size: asset.size } : {}),
        })
      }
    }
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.versions)) {
      for (const v of data.versions) {
        versions.push({
          version: typeof v === 'string' ? v : String(v.version || v.tag_name || v.name || v.id),
          stable: v.stable ?? !v.prerelease,
        })
      }
    } else if (data.versions && typeof data.versions === 'object') {
      for (const [mc, mcData] of Object.entries<any>(data.versions)) {
        const art = mcData?.artefacts?.['com.mumfrey:liteloader'] || mcData?.snapshots?.['com.mumfrey:liteloader']
        if (art && typeof art === 'object') {
          const seen = new Set<string>()
          for (const item of Object.values<any>(art)) {
            if (item && item.version && !seen.has(item.version)) {
              seen.add(item.version)
              const file = item.file || `liteloader-${item.version}.jar`
              const folder = mcData.repo?.type === 'ivy' ? mc : item.version
              const fileUrl = `https://dl.liteloader.com/versions/com/mumfrey/liteloader/${folder}/${file}`
              versions.push({
                version: item.version,
                stable: item.stream === 'RELEASE',
                gameVersions: [mc],
                fileName: file,
                fileUrl,
              })
            }
          }
        }
      }
    }
  }
  return versions
}

function svgToDataUri(svg: string): string {
  if (!svg) return ''
  if (svg.startsWith('http') || svg.startsWith('data:')) return svg
  let content = svg.trim()
  if (!content.includes('xmlns=')) {
    content = content.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  }
  content = content.replace(/currentColor/g, '#e0e0e0')
  try {
    const base64 = btoa(unescape(encodeURIComponent(content)))
    return `data:image/svg+xml;base64,${base64}`
  } catch {
    return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`
  }
}

export function useModloadersCustom() {
  const customLoaders = useLocalStorage<ModloaderItem[]>('xmcl_user_custom_modloaders', () => {
    try {
      const old = localStorage.getItem('modloaders_custom_v1')
      if (old) {
        const parsed = JSON.parse(old)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((l) => l && l.id && !DEFAULT_LOADER_IDS.includes(l.id))
        }
      }
    } catch {}
    return []
  })
  const hiddenLoaderIds = useLocalStorage<string[]>('xmcl_hidden_builtin_loaders', [])

  // Immediately purge any built-in loader IDs that might have been saved in customLoaders
  if (customLoaders.value.some((l) => DEFAULT_LOADER_IDS.includes(l.id))) {
    customLoaders.value = customLoaders.value.filter((l) => !DEFAULT_LOADER_IDS.includes(l.id))
  }

  // All loaders: ONLY the 6 classic built-ins plus user-added API loaders
  const allLoaders = computed<ModloaderItem[]>(() => {
    const list = customLoaders.value
      .filter((loader) => loader && loader.id && !DEFAULT_LOADER_IDS.includes(loader.id))
      .map((loader) => {
      const known = KNOWN_LOADER_METAS[loader.id] ||
        (loader.apiUrl ? Object.values(KNOWN_LOADER_METAS).find((k) => loader.apiUrl?.includes(k.apiUrl) || (loader.name && k.name.toLowerCase() === loader.name.toLowerCase())) : undefined)
      if (known) {
        const icon = loader.icon && loader.icon !== BuiltinImages.craftingTable ? loader.icon : (KNOWN_LOADER_ICONS[loader.id] || loader.icon)
        const versions = loader.versions && loader.versions.length > 0
          ? loader.versions
          : (known.defaultVersion ? [{ version: known.defaultVersion, stable: true }] : [])
        return {
          ...loader,
          apiUrl: (loader.apiUrl && loader.apiUrl.startsWith('http')) ? loader.apiUrl : known.apiUrl,
          gameVersions: loader.gameVersions && loader.gameVersions.length > 0 ? loader.gameVersions : [...known.gameVersions],
          name: loader.name || known.name,
          icon,
          versions,
        }
      }
      return loader
    })
    return [...BUILTIN_LOADERS, ...list]
  })

  // Visible loaders shown in the launcher selector
  const visibleLoaders = computed<ModloaderItem[]>(() => {
    return allLoaders.value.filter((l) => !hiddenLoaderIds.value.includes(l.id))
  })

  function isLoaderEnabled(id: string) {
    return !hiddenLoaderIds.value.includes(id)
  }

  function setLoaderEnabled(id: string, enabled: boolean) {
    if (enabled) {
      hiddenLoaderIds.value = hiddenLoaderIds.value.filter((i) => i !== id)
    } else {
      if (!hiddenLoaderIds.value.includes(id)) {
        hiddenLoaderIds.value = [...hiddenLoaderIds.value, id]
      }
    }
  }

  function removeLoader(id: string) {
    const isBuiltin = BUILTIN_LOADERS.some((b) => b.id === id)
    if (isBuiltin) {
      setLoaderEnabled(id, false)
    } else {
      customLoaders.value = customLoaders.value.filter((l) => l.id !== id)
      hiddenLoaderIds.value = hiddenLoaderIds.value.filter((i) => i !== id)
    }
  }

  async function addLoaderFromApi(input: string): Promise<ModloaderItem> {
    let trimmed = input.trim()
    if (!trimmed) throw new Error('Empty URL')

    const lower = trimmed.toLowerCase()
    if (DEFAULT_LOADER_IDS.includes(lower)) {
      throw new Error(`Cannot add built-in loader "${trimmed}" as a custom loader.`)
    }
    // Disallow passing the whole Modrinth catalog endpoint as a loader
    if (lower === 'https://api.modrinth.com/v2/tag/loader' || lower === 'https://api.modrinth.com/v2/tag/loader/') {
      throw new Error('This is a catalog endpoint of all loaders. Please specify a specific loader URL or identifier.')
    }

    let name = ''
    let icon = BuiltinImages.craftingTable
    let id = ''
    let versions: ModloaderVersion[] = []

    // 1. Determine slug intelligently from URL hostname, pathname or raw slug/ID
    let slug = ''
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const u = new URL(trimmed)
        if (u.hostname.includes('modrinth.com')) {
          const match = u.pathname.match(/\/(?:mod|plugin|datapack|modpack|project)\/([^/?#]+)/)
          if (match) {
            slug = match[1].toLowerCase()
          }
        } else {
          const parts = u.pathname.split('/').filter(Boolean)
          const lastPart = parts[parts.length - 1]?.toLowerCase() || ''
          if (lastPart && lastPart !== 'loader' && lastPart !== 'loaders' && lastPart !== 'modloader') {
            slug = lastPart
          } else if (u.hostname.includes('legacyfabric')) {
            slug = 'legacy-fabric'
          } else if (u.hostname.includes('ornithe')) {
            slug = 'ornithe'
          } else if (u.hostname.includes('babric')) {
            slug = 'babric'
          } else if (u.hostname.includes('liteloader')) {
            slug = 'liteloader'
          } else {
            const hostParts = u.hostname.split('.')
            slug = hostParts[0] === 'meta' || hostParts[0] === 'api' ? hostParts[1] || '' : hostParts[0] || ''
          }
        }
      } catch {
        // ignore
      }
    } else {
      slug = trimmed.toLowerCase()
    }

    let gameVersions: string[] = []
    let proj: any = undefined

    if (slug && KNOWN_LOADER_METAS[slug]) {
      const known = KNOWN_LOADER_METAS[slug]
      if (!name) name = known.name
      if (!id) id = slug
      if (!trimmed.startsWith('http')) {
        trimmed = known.apiUrl
      }
      if (gameVersions.length === 0) {
        gameVersions = [...known.gameVersions]
      }
      if (KNOWN_LOADER_ICONS[slug] && (!icon || icon === BuiltinImages.craftingTable)) {
        icon = KNOWN_LOADER_ICONS[slug]
      }
    }

    // 2. If it's a Modrinth project slug or ID, try fetching the project and its versions
    if (slug && !trimmed.startsWith('http://') && !trimmed.startsWith('https://') || trimmed.includes('modrinth.com')) {
      try {
        const projRes = await fetch(`https://api.modrinth.com/v2/project/${slug}`)
        if (projRes.ok) {
          proj = await projRes.json()
          if (proj && proj.title) {
            name = proj.title
            id = (proj.slug || proj.id || slug).toLowerCase()
            if (proj.icon_url) {
              icon = proj.icon_url
            }
            if (Array.isArray(proj.game_versions) && proj.game_versions.length > 0) {
              gameVersions = proj.game_versions
            }
            const verRes = await fetch(`https://api.modrinth.com/v2/project/${proj.id || slug}/version`)
            if (verRes.ok) {
              const verData = await verRes.json()
              if (Array.isArray(verData)) {
                versions = verData.map((v: any) => {
                  const primaryFile = v.files?.find((f: any) => f.primary) || v.files?.[0]
                  return {
                    version: String(v.version_number || v.name || v.id),
                    stable: v.version_type === 'release',
                    fileUrl: primaryFile?.url,
                    fileName: primaryFile?.filename,
                    loaders: v.loaders,
                    gameVersions: v.game_versions,
                    size: primaryFile?.size,
                    sha1: primaryFile?.hashes?.sha1,
                  }
                })
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Try to match loader in Modrinth loader tags to get its icon & canonical name
    if (slug && !name) {
      try {
        const loaders = await clientModrinthV2.getLoaderTags()
        // Exact match first, or prefix match (e.g. legacy-fabric, ornithe, babric)
        const matched = loaders.find((l) => l.name.toLowerCase() === slug) ||
          loaders.find((l) => slug.length > 3 && l.name.toLowerCase().includes(slug))
        if (matched) {
          id = matched.name.toLowerCase()
          name = matched.name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          if (matched.icon) {
            icon = svgToDataUri(matched.icon)
          }
        }
      } catch {
        // offline or not on modrinth
      }
    }
    // 3. If direct HTTP URL was provided, fetch versions or metadata
    const ghMatch = trimmed.match(/^https?:\/\/(?:api\.)?github\.com\/(?:repos\/)?([^/]+)\/([^/#?]+)/i)
    if (ghMatch) {
      const owner = ghMatch[1]
      const repo = ghMatch[2].replace(/\.git$/, '')
      try {
        const [repoRes, relRes] = await Promise.all([
          fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'XMCL' },
          }),
          fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
            headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'XMCL' },
          }),
        ])

        if (repoRes.ok) {
          const repoData = await repoRes.json()
          name = repoData.name || repo
          id = repo.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
          if (repoData.owner?.avatar_url) {
            icon = repoData.owner.avatar_url
          }
        }

        if (relRes.ok) {
          const relData = await relRes.json()
          if (Array.isArray(relData) && relData.length > 0) {
            versions = relData.map((r: any) => {
              const asset =
                r.assets?.find((a: any) => a.name.endsWith('installer.jar')) ||
                r.assets?.find((a: any) => a.name.endsWith('universal.jar')) ||
                r.assets?.find((a: any) => a.name.endsWith('.jar'))
              return {
                version: r.tag_name || r.name,
                stable: !r.prerelease,
                fileUrl: asset?.browser_download_url,
                fileName: asset?.name,
                size: asset?.size,
              }
            })
          }
        }

        if (id.includes('cleanroom')) {
          gameVersions = ['1.12.2']
        }
      } catch (err: any) {
        throw new Error(`Failed to fetch from GitHub API (${err?.message || err})`)
      }
    } else if (!proj && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
      try {
        const res = await fetch(trimmed)
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        const text = await res.text()
        const trimmedText = text.trim()
        if (trimmedText.startsWith('<!DOCTYPE') || trimmedText.startsWith('<html') || trimmedText.startsWith('<?xml')) {
          throw new Error('This URL returned a web page (HTML) instead of a JSON API endpoint. For GitHub repositories, please enter the repository link (e.g. https://github.com/owner/repo), or provide a direct JSON API URL (like a Fabric meta endpoint).')
        }
        let data: any
        try {
          data = JSON.parse(trimmedText)
        } catch {
          throw new Error('The API response is not valid JSON.')
        }
        versions = parseVersionsFromApiResponse(data)

        if (Array.isArray(data)) {
          // If name wasn't resolved yet
          if (!name && data[0]?.name && typeof data[0].name === 'string') {
            name = data[0].name
            id = data[0].name.toLowerCase()
          }
        } else if (data && typeof data === 'object') {
          if (!name && (data.name || data.id)) {
            name = data.name || data.id
            id = (data.id || data.name).toLowerCase()
          }
          if (data.icon && !icon) {
            icon = svgToDataUri(data.icon)
          }
        }

        const fetchedGames = await fetchGameVersionsFromApi(trimmed)
        if (fetchedGames.length > 0) {
          gameVersions = fetchedGames
        }
      } catch (err: any) {
        throw new Error(`Failed to fetch from API URL (${err?.message || err})`)
      }
    }

    // 4. Fallback name/id if still not found
    if (!name) {
      name = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : trimmed
      id = (slug || trimmed).toLowerCase().replace(/[^a-z0-9]/g, '_')
    }
    if (!id) {
      id = `custom_${Date.now()}`
    }

    if (gameVersions.length === 0 && slug && KNOWN_LOADER_GAMES[slug]) {
      gameVersions = KNOWN_LOADER_GAMES[slug]
    }
    if (gameVersions.length === 0 && id && KNOWN_LOADER_GAMES[id]) {
      gameVersions = KNOWN_LOADER_GAMES[id]
    }

    if (DEFAULT_LOADER_IDS.includes(id) || (slug && DEFAULT_LOADER_IDS.includes(slug))) {
      throw new Error(`Cannot add or override built-in loader: ${id || slug}`)
    }

    const isModProject = proj?.project_type === 'mod'
    const newItem: ModloaderItem = {
      id,
      name,
      icon,
      apiUrl: trimmed,
      builtin: false,
      versions: versions.length > 0 ? versions : undefined,
      gameVersions: gameVersions.length > 0 ? gameVersions : undefined,
      projectType: isModProject ? 'mod' : 'loader',
      targetLoaders: proj?.loaders || versions[0]?.loaders,
    }

    const existingIndex = customLoaders.value.findIndex((l) => l.id === id)
    if (existingIndex >= 0) {
      customLoaders.value[existingIndex] = newItem
    } else {
      customLoaders.value = [...customLoaders.value, newItem]
    }

    setLoaderEnabled(id, true)
    return newItem
  }

  async function refreshLoaderVersions(id: string) {
    const loader = customLoaders.value.find((l) => l.id === id)
    if (!loader) return
    let changed = false
    if (!loader.gameVersions || loader.gameVersions.length === 0) {
      if (KNOWN_LOADER_GAMES[loader.id]) {
        loader.gameVersions = KNOWN_LOADER_GAMES[loader.id]
        changed = true
      }
    }

    const slug = loader.id
    if (slug && (!loader.versions || loader.versions.length === 0 || !loader.versions[0]?.fileUrl)) {
      try {
        const verRes = await fetch(`https://api.modrinth.com/v2/project/${slug}/version`)
        if (verRes.ok) {
          const verData = await verRes.json()
          if (Array.isArray(verData) && verData.length > 0) {
            loader.versions = verData.map((v: any) => {
              const primaryFile = v.files?.find((f: any) => f.primary) || v.files?.[0]
              return {
                version: String(v.version_number || v.name || v.id),
                stable: v.version_type === 'release',
                fileUrl: primaryFile?.url,
                fileName: primaryFile?.filename,
                loaders: v.loaders,
                gameVersions: v.game_versions,
                size: primaryFile?.size,
                sha1: primaryFile?.hashes?.sha1,
              }
            })
            if (!loader.gameVersions || loader.gameVersions.length === 0) {
              const allGames = Array.from(new Set(verData.flatMap((v: any) => v.game_versions || [])))
              if (allGames.length > 0) {
                loader.gameVersions = allGames as string[]
              }
            }
            changed = true
          }
        }
      } catch {
        // ignore
      }
    }

    if (loader.apiUrl && loader.apiUrl.startsWith('http') && !loader.apiUrl.includes('modrinth.com')) {
      try {
        const res = await fetch(loader.apiUrl)
        if (res.ok) {
          const data = await res.json()
          const vers = parseVersionsFromApiResponse(data)
          if (vers.length > 0) {
            loader.versions = vers
            changed = true
          }
        }
        if (!loader.gameVersions || loader.gameVersions.length === 0) {
          const games = await fetchGameVersionsFromApi(loader.apiUrl)
          if (games.length > 0) {
            loader.gameVersions = games
            changed = true
          }
        }
      } catch {
        // ignore
      }
    }
    if (changed) {
      customLoaders.value = [...customLoaders.value]
    }
  }

  // Auto-refresh any existing custom loader that lacks versions or gameVersions
  for (const loader of customLoaders.value) {
    if (KNOWN_LOADER_METAS[loader.id]) {
      const meta = KNOWN_LOADER_METAS[loader.id]
      if (!loader.apiUrl || !loader.apiUrl.startsWith('http')) {
        loader.apiUrl = meta.apiUrl
      }
      if (!loader.gameVersions || loader.gameVersions.length === 0 || (loader.id === 'babric' && !loader.gameVersions.includes('b1.7.3')) || (loader.id === 'liteloader' && !loader.gameVersions.includes('1.12.2')) || (loader.id === 'cleanroom' && !loader.gameVersions.includes('1.12.2'))) {
        loader.gameVersions = [...meta.gameVersions]
      }
      if (!loader.name || loader.name.toLowerCase() === loader.id) {
        loader.name = meta.name
      }
      if (KNOWN_LOADER_ICONS[loader.id] && (!loader.icon || loader.icon === BuiltinImages.craftingTable)) {
        loader.icon = KNOWN_LOADER_ICONS[loader.id]
      }
    } else if (!loader.gameVersions || loader.gameVersions.length === 0) {
      if (KNOWN_LOADER_GAMES[loader.id]) {
        loader.gameVersions = KNOWN_LOADER_GAMES[loader.id]
      }
    }
    if (loader.apiUrl && loader.apiUrl.startsWith('http') && (!loader.versions || loader.versions.length === 0 || !loader.gameVersions || loader.gameVersions.length === 0 || (loader.id === 'liteloader' && loader.versions?.some((v) => v.fileUrl?.includes('repo.mumfrey.com'))))) {
      refreshLoaderVersions(loader.id)
    }
  }

  function resetToDefaults() {
    hiddenLoaderIds.value = []
    customLoaders.value = []
  }

  return {
    allLoaders,
    visibleLoaders,
    isLoaderEnabled,
    setLoaderEnabled,
    removeLoader,
    addLoaderFromApi,
    refreshLoaderVersions,
    resetToDefaults,
  }
}
