import type { InstanceFile } from '@xmcl/instance'
import type { ModFile } from '@/util/mod'
import { normalizeModFileName } from '@xmcl/runtime-api'

export type ModDependencyInstallation = [InstanceFile, ModFile]

const LOADER_OR_VERSION_BOUNDARY = /[-_+. ](?:v?\d|mc\d|fabric|forge|neoforge|quilt|liteloader|rift)/i

function canonicalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function extractModNameStem(filePath: string): string {
  const fileName = normalizeModFileName(filePath).replace(/\.jar$/i, '')
  const match = fileName.search(LOADER_OR_VERSION_BOUNDARY)
  const base = match > 0 ? fileName.slice(0, match) : fileName
  return canonicalizeToken(base)
}

export function getModDependencyIdentity(file: InstanceFile): string {
  if (file.modrinth) return `modrinth:${file.modrinth.projectId}`
  if (file.curseforge) return `curseforge:${file.curseforge.projectId}`
  return `path:${normalizeModFileName(file.path).toLocaleLowerCase()}`
}

function collectInstalledModIndex(installedMods: readonly ModFile[], enabled = true) {
  const hashes = new Set<string>()
  const modrinthIds = new Set<string>()
  const curseforgeIds = new Set<number>()
  const fileNames = new Set<string>()
  const stems = new Set<string>()

  installedMods.forEach((mod) => {
    if (mod.enabled !== enabled) return
    if (mod.hash) hashes.add(mod.hash.toLowerCase())
    if (mod.modrinth?.projectId) modrinthIds.add(mod.modrinth.projectId)
    if (mod.curseforge?.projectId) curseforgeIds.add(mod.curseforge.projectId)
    fileNames.add(normalizeModFileName(mod.path).toLowerCase())

    const tokens = [
      mod.modId ? canonicalizeToken(mod.modId) : '',
      extractModNameStem(mod.fileName || mod.path),
      ...Object.keys(mod.provideRuntime ?? {}).map(canonicalizeToken),
    ]
    tokens.filter(t => t.length >= 4).forEach(t => stems.add(t))
  })

  return { hashes, modrinthIds, curseforgeIds, fileNames, stems }
}

/** A possible disabled match blocks unattended installation, but never satisfies a dependency. */
export function hasDisabledModDependencyMatch(file: InstanceFile, mods: readonly ModFile[]): boolean {
  return matchesInstalledMod(file, collectInstalledModIndex(mods, false))
}

function matchesInstalledMod(file: InstanceFile, index: ReturnType<typeof collectInstalledModIndex>): boolean {
  const sha1 = file.hashes?.sha1?.toLowerCase()
  const fileName = normalizeModFileName(file.path).toLowerCase()
  const stem = extractModNameStem(file.path)

  return Boolean(
    (sha1 && index.hashes.has(sha1)) ||
    (file.modrinth?.projectId && index.modrinthIds.has(file.modrinth.projectId)) ||
    (file.curseforge?.projectId && index.curseforgeIds.has(file.curseforge.projectId)) ||
    index.fileNames.has(fileName) ||
    (stem.length >= 4 && index.stems.has(stem)),
  )
}

export function deduplicateModDependencyInstallations(
  installations: ModDependencyInstallation[],
  installedMods: readonly ModFile[] = [],
): ModDependencyInstallation[] {
  const installedIndex = collectInstalledModIndex(installedMods)
  const seenIdentities = new Set<string>()
  const seenHashes = new Set<string>()
  const seenFileNames = new Set<string>()
  const seenStems = new Set<string>()

  return installations.filter(([file]) => {
    const identity = getModDependencyIdentity(file)
    const sha1 = file.hashes?.sha1?.toLowerCase()
    const fileName = normalizeModFileName(file.path).toLowerCase()
    const stem = extractModNameStem(file.path)

    const alreadyInstalled = matchesInstalledMod(file, installedIndex)

    const alreadyQueued = Boolean(
      seenIdentities.has(identity) ||
      (sha1 && seenHashes.has(sha1)) ||
      seenFileNames.has(fileName) ||
      (stem.length >= 4 && seenStems.has(stem)),
    )

    if (alreadyInstalled || alreadyQueued) return false

    seenIdentities.add(identity)
    if (sha1) seenHashes.add(sha1)
    seenFileNames.add(fileName)
    if (stem.length >= 4) seenStems.add(stem)
    return true
  })
}
