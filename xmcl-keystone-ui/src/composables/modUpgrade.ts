import { basename } from '@/util/basename'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getCurseforgeModLoaderTypeFromRuntime } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { getModrinthModLoaders, getModrinthVersionKey } from '@/util/modrinth'
import { swrvGet } from '@/util/swrvGet'
import { notNullish, useLocalStorage } from '@vueuse/core'
import { File, FileModLoaderType } from '@xmcl/curseforge'
import { InstanceFile, RuntimeVersions } from '@xmcl/instance'
import { ProjectVersion } from '@xmcl/modrinth'
import { InjectionKey, Ref } from 'vue'
import { useDialog } from './dialog'
import { useErrorHandler } from './exception'
import { InstanceInstallDialog } from './instanceUpdate'
import { useRefreshable } from './refreshable'
import { kSWRVConfig } from './swrvConfig'
import { buildModUpgradeManifest } from './modUpgradeManifest'
import { useInstanceInstallOperation } from './instanceInstallOperation'

export type UpgradePlan = {
  /**
   * The curseforge file
   */
  file: File

  mod: ModFile

  updating: boolean
  /**
   * Relative filepath to the instance
   */
  filePath: string
} | {
  /**
   * The modrinth version
   */
  version: ProjectVersion

  mod: ModFile

  updating: boolean
  /**
   * Relative filepath to the instance
   */
  filePath: string
}

export const kModUpgrade: InjectionKey<ReturnType<typeof useModUpgrade>> = Symbol('kModUpgrade')

export function useModUpgrade(
  path: Ref<string>,
  runtime: Ref<RuntimeVersions>,
  instanceMods: Ref<any[]>,
  updateMetadata: () => Promise<void>,
  destinationPrefix: 'mods' | 'resourcepacks' | 'shaderpacks' = 'mods',
) {
  const { cache, dedupingInterval } = injection(kSWRVConfig)
  const plans = shallowRef({} as Record<string, UpgradePlan>)
  const checked = ref(false)
  const { show } = useDialog(InstanceInstallDialog)
  const operation = useInstanceInstallOperation(path, () => {
    plans.value = {}
  })

  const skipVersion = useLocalStorage(computed(() => `${destinationPrefix}UpgradeSkipVersion:${path.value}`), false, { writeDefaults: false })
  // Default to ignoring alpha/beta versions so mods upgrade to the latest stable release,
  // keeping clients in sync with launchers that only ship stable updates.
  const releaseOnly = useLocalStorage(computed(() => `${destinationPrefix}UpgradeIgnoreAlphaBeta:${path.value}`), true, { writeDefaults: false })
  const upgradePolicy = useLocalStorage<'modrinth' | 'curseforge' | 'curseforgeOnly' | 'modrinthOnly'>(computed(() => `${destinationPrefix}UpgradePolicy:${path.value}`), 'modrinth', { writeDefaults: false })

  useErrorHandler((e) => {
    if (e instanceof Error && 'instanceInstallErrorId' in e && e.instanceInstallErrorId === operation.id.value) {
      error.value = e
      return true
    }
    return false
  })

  watch([path, runtime], () => {
    checked.value = false
    plans.value = {}
    operation.reset()
    error.value = null
  })

  async function checkCurseforgeUpgrade(mods: ModFile[], runtime: RuntimeVersions, skipVersion: boolean, releaseOnly: boolean, result: Record<string, UpgradePlan>) {
    const fileIds = mods.map(m => m.curseforge?.fileId).filter(notNullish)
    if (skipVersion) {
      const minecraft = runtime.minecraft
      const files = await clientCurseforgeV1.getFiles(fileIds)
      const shouldIgnored = new Set<number>()
      for (const f of files) {
        if (!f.gameVersions.includes(minecraft)) {
          shouldIgnored.add(f.id)
        }
      }
      mods = mods.filter(m => !shouldIgnored.has(m.curseforge!.projectId))
    }

    // batch 8 curseforge requests each time
    const batch = 8
    for (let i = 0; i < mods.length; i += batch) {
      await Promise.allSettled(mods.slice(i, i + batch).map(async (mod) => {
        const gameVersion = runtime.minecraft
        const modLoaderType = destinationPrefix === 'mods' ? getCurseforgeModLoaderTypeFromRuntime(runtime) : FileModLoaderType.Any
        // this is a curseforge project and installed
        const files = await swrvGet(`/curseforge/${mod.curseforge!.projectId}/files?gameVersion=${gameVersion}&modLoaderType=${modLoaderType}&index=0`, () => clientCurseforgeV1.getModFiles({
          modId: mod.curseforge!.projectId!,
          gameVersion,
          modLoaderType,
        }), cache, dedupingInterval)
        // releaseType: 1 = release, 2 = beta, 3 = alpha
        const candidates = releaseOnly ? files.data.filter(f => f.releaseType === 1) : files.data
        if (candidates.length > 0) {
          const file = markRaw(candidates[0])
          const current = mod
          if (file.id !== current.curseforge?.fileId) {
            // this is the new version
            if (!result[mod.curseforge!.projectId]) {
              result[mod.curseforge!.projectId] = {
                file,
                mod,
                updating: false,
                filePath: basename(current.path),
              }
            }
          }
        }
      }))
    }
  }

  async function checkModrinthUpgrade(modrinthTarget: ModFile[], runtimes: RuntimeVersions, skipVersion: boolean, releaseOnly: boolean, result: Record<string, UpgradePlan>) {
    if (modrinthTarget.length === 0) {
      return modrinthTarget
    }

    let hashes = modrinthTarget.map(m => m.hash)
    if (skipVersion) {
      const minecraft = runtimes.minecraft
      const vers = await clientModrinthV2.getProjectVersionsByHash(hashes)
      const shouldIgnored = new Set<string>()
      for (const v of Object.values(vers)) {
        if (!v.game_versions.includes(minecraft)) {
          shouldIgnored.add(v.project_id)
        }
      }
      modrinthTarget = modrinthTarget.filter(m => !shouldIgnored.has(m.modrinth!.projectId))
      hashes = modrinthTarget.map(m => m.hash)
    }

    if (hashes.length === 0) {
      return modrinthTarget
    }

    const loaders = destinationPrefix === 'mods' ? getModrinthModLoaders(runtimes) : undefined
    const gameVersions = [runtimes.minecraft]
    const modrinthByProjectId = new Map(modrinthTarget.map(m => [m.modrinth!.projectId, m]))
    const updates = await clientModrinthV2.getLatestVersionsFromHashes(hashes, {
      algorithm: 'sha1',
      gameVersions,
      loaders,
    })
    // Modrinth's update endpoint returns the single latest version regardless of
    // its release channel. When releaseOnly is set, fall back to the project's
    // version list to pick the latest stable (version_type === 'release') version.
    const resolveReleaseVersion = async (mod: ModFile, candidate: ProjectVersion): Promise<ProjectVersion | undefined> => {
      if (!releaseOnly || candidate.version_type === 'release') {
        return candidate
      }
      const versions = await swrvGet(getModrinthVersionKey(mod.modrinth!.projectId, undefined, loaders, gameVersions),
        () => clientModrinthV2.getProjectVersions(mod.modrinth!.projectId, { loaders, gameVersions }), cache, dedupingInterval)
      return versions.find(v => v.version_type === 'release')
    }
    await Promise.allSettled(Object.values(updates).map(async (version) => {
      const mod = modrinthByProjectId.get(version.project_id)
      if (!mod) return
      const resolved = await resolveReleaseVersion(mod, version)
      if (resolved && resolved.id !== mod.modrinth?.versionId) {
        // this is the new version
        result[mod.modrinth!.projectId] = {
          version: markRaw(resolved),
          mod,
          updating: false,
          filePath: basename(mod.path),
        }
      }
    }))

    return modrinthTarget
  }

  function select(mods: Set<ModFile>, isValid: (mod: ModFile) => boolean) {
    const result = [] as ModFile[]
    for (const mod of mods) {
      if (isValid(mod)) {
        result.push(mod)
        mods.delete(mod)
      }
    }
    return result
  }

  const { refresh, refreshing, error } = useRefreshable<{ skipVersion: boolean; releaseOnly?: boolean; policy: 'curseforge' | 'modrinth' | 'curseforgeOnly' | 'modrinthOnly' }>(async ({ skipVersion, releaseOnly: releaseOnlyOpt, policy }) => {
    // Refresh the mod platform metadata (modrinth/curseforge ids) first so that
    // mods which haven't been resolved yet can be matched against the providers.
    // Without this, a click on "check update" finds nothing and returns instantly.
    await updateMetadata()

    const onlyRelease = releaseOnlyOpt ?? releaseOnly.value
    const result: Record<string, UpgradePlan> = {}

    // Skip manually disabled mods (.disabled), but include incompatible mods (.incompatible)
    // so they can be re-enabled if an update becomes available
    const mods = new Set(instanceMods.value.filter(m => !m.path.endsWith('.disabled')))
    const runtimes = runtime.value
    const _path = path.value

    async function doCheckModrinthUpgrade() {
      const modrinthTargets = select(mods, m => !!m.modrinth?.projectId)
      await checkModrinthUpgrade(modrinthTargets, runtimes, skipVersion, onlyRelease, result)
    }

    async function doCurseforgeUpgrade() {
      const curseforgeTargets = select(mods, m => !!m.curseforge?.projectId)
      await checkCurseforgeUpgrade(curseforgeTargets, runtimes, skipVersion, onlyRelease, result)
    }

    if (policy === 'curseforge') {
      await doCurseforgeUpgrade()
      await doCheckModrinthUpgrade()
    } else if (policy === 'modrinth') {
      await doCheckModrinthUpgrade()
      await doCurseforgeUpgrade()
    } else if (policy === 'curseforgeOnly') {
      await doCurseforgeUpgrade()
    } else if (policy === 'modrinthOnly') {
      await doCheckModrinthUpgrade()
    }

    plans.value = result
    checked.value = true
    operation.begin(_path)
  })

  watch(instanceMods, (mods) => {
    const modsPaths = new Set(mods.map(m => basename(m.path)))
    const plansItems = Object.entries(plans.value)
    const filtered = plansItems.filter(([_, plan]) => modsPaths.has(plan.filePath))

    plans.value = Object.fromEntries(filtered)
    checked.value = false
  })


  function prepareUpgradeManifest() {
    return buildModUpgradeManifest(Object.values(plans.value), destinationPrefix)
  }

  function upgrade() {
    const { oldFiles, files } = prepareUpgradeManifest()
    show({
      type: 'updates',
      oldFiles,
      files,
      id: operation.id.value,
    })
  }

  /**
   * Get the list of enabled mod file paths that don't have an available upgrade plan.
   * Used to disable mods without updates when switching MC versions.
   */
  function getModsWithoutUpgrade(): string[] {
    const plansModPaths = new Set(
      Object.values(plans.value).map(p => p.mod.path),
    )
    return instanceMods.value
      .filter(m => m.enabled && !plansModPaths.has(m.path))
      .map(m => m.path)
  }

  return {
    refresh,
    refreshing,
    skipVersion,
    releaseOnly,
    upgradePolicy,
    error,
    plans,
    checked,
    upgrade,
    prepareUpgradeManifest,
    upgrading: computed(() => !!operation.task.value),
    getModsWithoutUpgrade,
  }
}
