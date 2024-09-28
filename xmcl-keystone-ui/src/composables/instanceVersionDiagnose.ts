import { injection } from '@/util/inject'
import { getExpectVersion } from '@xmcl/runtime-api'
import { kInstanceVersionInstall } from './instanceVersionInstall'
import { LaunchMenuItem } from './launchButton'

export function useInstanceVersionDiagnose() {
  const { instruction } = injection(kInstanceVersionInstall)
  const { t } = useI18n()
  const launcMenuItems = computed(() => {
    const items = [] as LaunchMenuItem[]

    const i = instruction.value
    if (!i) return items

    if (!i.resolvedVersion) {
      items.push(reactive({
        title: computed(() => t('diagnosis.missingVersion.name', { version: getExpectVersion(i.runtime) })),
        description: computed(() => t('diagnosis.missingVersion.message')),
      }))
    }
    if (i.java) {
      items.push({
        title: t('diagnosis.missingJava.name'),
        description: t('diagnosis.missingJava.message'),
      })
    }
    if (i.profile) {
      items.push(reactive({
        title: computed(() => t('diagnosis.badInstall.name', { version: i.resolvedVersion })),
        description: computed(() => t('diagnosis.badInstall.message')),
      }))
    }
    if (i.jar) {
      items.push(i.jar.type === 'corrupted'
        ? reactive({
          title: computed(() => t('diagnosis.corruptedVersionJar.name', { version: i.jar!.version })),
          description: computed(() => t('diagnosis.corruptedVersionJar.message')),
        })
        : reactive({
          title: computed(() => t('diagnosis.missingVersionJar.name', { version: i.jar!.version })),
          description: computed(() => t('diagnosis.missingVersionJar.message')),
        }))
    }
    if (i.libriares) {
      const libs = i.libriares
      const options = { count: libs.length, name: libs[0].library.path }
      items.push(libs.some(v => v.type === 'corrupted')
        ? reactive({
          title: computed(() => t('diagnosis.corruptedLibraries.name', options, libs.length)),
          description: computed(() => t('diagnosis.corruptedLibraries.message')),
        })
        : reactive({
          title: computed(() => t('diagnosis.missingLibraries.name', options, libs.length)),
          description: computed(() => t('diagnosis.missingLibraries.message')),
        }))
    }
    if (i.assets) {
      const assets = i.assets
      const count = assets.length
      const name = assets[0]?.asset.name ?? ''
      items.push(assets.some(v => v.type === 'corrupted')
        ? reactive({
          title: computed(() => t('diagnosis.corruptedAssets.name', { count, name })),
          description: computed(() => t('diagnosis.corruptedAssets.message')),
        })
        : reactive({
          title: computed(() => t('diagnosis.missingAssets.name', { count, name })),
          description: computed(() => t('diagnosis.missingAssets.message')),
        }))
    }
    if (i.assetIndex) {
      items.push(i.assetIndex.type === 'corrupted'
        ? reactive({
          title: computed(() => t('diagnosis.corruptedAssetsIndex.name', { version: i.assetIndex!.version })),
          description: computed(() => t('diagnosis.corruptedAssetsIndex.message')),
        })
        : reactive({
          title: computed(() => t('diagnosis.missingAssetsIndex.name', { version: i.assetIndex!.version })),
          description: computed(() => t('diagnosis.missingAssetsIndex.message')),
        }))
    }
    if (i.forge) {
      items.push(reactive({
        title: computed(() => t('diagnosis.badInstall.name')),
        description: computed(() => t('diagnosis.badInstall.message')),
      }))
    }
    if (i.optifine) {
      items.push(reactive({
        title: computed(() => t('diagnosis.badInstall.name')),
        description: computed(() => t('diagnosis.badInstall.message')),
      }))
    }

    return items
  })

  return launcMenuItems
}
