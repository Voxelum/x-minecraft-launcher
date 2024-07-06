import { getSWRV } from '@/util/swrvGet'
import type { LibraryIssue } from '@xmcl/core'
import { DiagnoseServiceKey, InstallServiceKey, InstanceServiceKey, LocalVersionHeader, ReadWriteLock, RuntimeVersions, getExpectVersion, parseOptifineVersion } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { InstanceResolveVersion } from './instanceVersion'
import { useInstanceVersionInstall } from './instanceVersionInstall'
import { LaunchMenuItem } from './launchButton'
import { useService } from './service'
import { kSWRVConfig } from './swrvConfig'
import { getMinecraftVersionsModel } from './version'

export const kInstanceVersionDiagnose: InjectionKey<ReturnType<typeof useInstanceVersionDiagnose>> = Symbol('InstanceVersionDiagnose')

export function useInstanceVersionDiagnose(path: Ref<string>, runtime: Ref<RuntimeVersions>, resolvedVersion: Ref<InstanceResolveVersion | undefined>, versions: Ref<LocalVersionHeader[]>) {
  const { diagnoseAssetIndex, diagnoseAssets, diagnoseJar, diagnoseLibraries, diagnoseProfile } = useService(DiagnoseServiceKey)
  const issueItems = ref([] as LaunchMenuItem[])
  const { t } = useI18n()
  const { install } = useInstanceVersionInstall(versions)
  const { installAssetsForVersion, installForge, installAssets, installLibraries, installNeoForged, installDependencies, installOptifine, installByProfile } = useService(InstallServiceKey)
  const { editInstance } = useService(InstanceServiceKey)

  let operation = undefined as undefined | (() => Promise<void>)
  let abortController = new AbortController()
  let pendingFix = false

  const lock = new ReadWriteLock()

  const loading = ref(false)

  async function _update(version: InstanceResolveVersion | undefined) {
    if (!version) return
    abortController.abort()
    abortController = new AbortController()
    abortController.signal.addEventListener('abort', () => {
      loading.value = false
    })
    try {
      loading.value = true
      await lock.read(() => update(version))
    } finally {
      loading.value = false
    }
  }
  async function update(version: InstanceResolveVersion) {
    console.log('update version diagnose')

    const abortSignal = abortController.signal
    // invalidate operation
    operation = () => Promise.resolve()

    if ('requirements' in version) {
      const runtime = version.requirements
      operation = async () => {
        const version = await install(runtime)
        if (version) {
          await installDependencies(version)
        }
        await editInstance({
          instancePath: path.value,
          version,
        })
      }
      issueItems.value = [reactive({
        title: computed(() => t('diagnosis.missingVersion.name', { version: getExpectVersion(runtime) })),
        description: computed(() => t('diagnosis.missingVersion.message')),
      })]
      return
    }

    const items: LaunchMenuItem[] = []
    const operations: Array<() => Promise<void>> = []
    const jarIssue = await diagnoseJar(version)
    if (abortSignal.aborted) { return }

    if (jarIssue) {
      const options = { version: jarIssue.version }
      operations.push(async () => {
        const version = await install(runtime.value, true)
        if (version) {
          await installDependencies(version)
        }
      })
      items.push(jarIssue.type === 'corrupted'
        ? reactive({
          title: computed(() => t('diagnosis.corruptedVersionJar.name', options)),
          description: computed(() => t('diagnosis.corruptedVersionJar.message')),
        })
        : reactive({
          title: computed(() => t('diagnosis.missingVersionJar.name', options)),
          description: computed(() => t('diagnosis.missingVersionJar.message')),
        }))
    }

    const profileIssue = await diagnoseProfile(version.id)
    if (abortSignal.aborted) { return }
    if (profileIssue) {
      console.log(profileIssue)
      if (runtime.value.forge) {
        operations.push(async () => {
          await installForge({
            mcversion: version.minecraftVersion,
            version: runtime.value.forge!,
          })
        })
      } else if (runtime.value.neoForged) {
        operations.push(async () => {
          await installNeoForged({
            minecraft: version.minecraftVersion,
            version: runtime.value.neoForged!,
          })
        })
      } else {
        operations.push(async () => {
          await installByProfile(profileIssue.installProfile)
        })
      }

      items.push(reactive({
        title: computed(() => t('diagnosis.badInstall.name', { version: version.id })),
        description: computed(() => t('diagnosis.badInstall.message')),
      }))
    }

    if (!profileIssue) {
      const librariesIssue = await diagnoseLibraries(version)
      if (abortSignal.aborted) { return }

      if (librariesIssue.length > 0) {
        const optifinesIssues = [] as LibraryIssue[]
        const forgeIssues = [] as LibraryIssue[]
        const commonIssues = [] as LibraryIssue[]
        for (const i of librariesIssue) {
          if (i.library.groupId === 'optifine') {
            optifinesIssues.push(i)
          } else if (i.library.groupId === 'net.minecraftforge' && i.library.artifactId === 'forge' && (i.library.classifier === 'client' || !i.library.classifier)) {
            forgeIssues.push(i)
          } else {
            commonIssues.push(i)
          }
        }
        if (commonIssues.length > 0) {
          const options = { count: commonIssues.length, name: commonIssues[0].library.path }
          operations.push(async () => {
            await installLibraries(commonIssues.map(v => v.library), version.id, commonIssues.length < 15)
          })
          items.push(commonIssues.some(v => v.type === 'corrupted')
            ? reactive({
              title: computed(() => t('diagnosis.corruptedLibraries.name', options, { plural: commonIssues.length })),
              description: computed(() => t('diagnosis.corruptedLibraries.message')),
            })
            : reactive({
              title: computed(() => t('diagnosis.missingLibraries.name', options, { plural: commonIssues.length })),
              description: computed(() => t('diagnosis.missingLibraries.message')),
            }))
        }
        if (optifinesIssues.length > 0) {
          items.push(reactive({
            title: computed(() => t('diagnosis.badInstall.name')),
            description: computed(() => t('diagnosis.badInstall.message')),
          }))
          const { type, patch } = parseOptifineVersion(runtime.value.optifine!)
          operations.push(async () => {
            await installOptifine({
              mcversion: runtime.value.minecraft,
              type,
              patch,
            })
          })
        }
        if (forgeIssues.length > 0) {
          items.push(reactive({
            title: computed(() => t('diagnosis.badInstall.name')),
            description: computed(() => t('diagnosis.badInstall.message')),
          }))
          operations.push(async () => {
            await installForge({
              mcversion: runtime.value.minecraft,
              version: runtime.value.forge!,
            })
          })
        }
      }
    }

    const assetIndexIssue = await diagnoseAssetIndex(version)
    if (abortSignal.aborted) { return }

    if (assetIndexIssue) {
      operations.push(async () => {
        const list = await getSWRV(getMinecraftVersionsModel(), inject(kSWRVConfig))
        await installAssetsForVersion(version.id, list.versions.filter(v => v.id === version.minecraftVersion || v.id === version.assets))
      })
      items.push(assetIndexIssue.type === 'corrupted'
        ? reactive({
          title: computed(() => t('diagnosis.corruptedAssetsIndex.name', { version: assetIndexIssue.version })),
          description: computed(() => t('diagnosis.corruptedAssetsIndex.message')),
        })
        : reactive({
          title: computed(() => t('diagnosis.missingAssetsIndex.name', { version: assetIndexIssue.version })),
          description: computed(() => t('diagnosis.missingAssetsIndex.message')),
        }))
    }

    if (!assetIndexIssue) {
      const assetsIssue = await diagnoseAssets(version)
      if (abortSignal.aborted) { return }
      if (assetsIssue.length > 0) {
        const options = { count: assetsIssue.length, name: assetsIssue[0]?.asset.name }
        operations.push(async () => {
          await installAssets(assetsIssue.map(v => v.asset), version.id, assetsIssue.length < 15)
        })
        items.push(assetsIssue.some(v => v.type === 'corrupted')
          ? reactive({
            title: computed(() => t('diagnosis.corruptedAssets.name', options, 2)),
            description: computed(() => t('diagnosis.corruptedAssets.message')),
          })
          : reactive({
            title: computed(() => t('diagnosis.missingAssets.name', options, 2)),
            description: computed(() => t('diagnosis.missingAssets.message')),
          }),
        )
      }
    }

    // TODO: handle error
    issueItems.value = items
    if (operations.length > 0) {
      operation = async () => {
        pendingFix = false
        for (const o of operations) {
          await o()
        }
      }
      if (pendingFix) {
        operation()
      }
    }
  }

  async function fix() {
    if (operation) {
      await lock.write(operation)
      await _update(resolvedVersion.value)
    } else {
      pendingFix = true
    }
  }

  watch(resolvedVersion, _update)
  onMounted(() => {
    _update(resolvedVersion.value)
  })

  return {
    issues: issueItems,
    fix,
    loading,
  }
}
