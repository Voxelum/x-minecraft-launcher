import { AvatarItemProps } from '@/components/AvatarItem.vue'
import { BuiltinImages } from '@/constant'
import { TimeUnit, getHumanizeDuration } from '@/util/date'
import { Instance } from '@xmcl/instance'
import { VersionHeader, VersionServiceKey, getExpectVersion, BedrockServiceKey } from '@xmcl/runtime-api'
import { useDateString } from './date'
import { useService } from './service'
import { useModloadersCustom, resolveFabricCustomLoader, resolveCustomLoaderFromInstance, DEFAULT_LOADER_IDS } from './modloaderCustom'

export function useExtensionItemsGamePlay(instance: Ref<Instance>) {
  const { t } = useI18n()
  const { getDateString } = useDateString()
  const lastPlayedText = computed(() => {
    const i = instance.value
    const date = i.lastPlayedDate
    if (!date) {
      return t('instance.neverPlayed')
    }
    const result = getDateString(date)
    return result
  })

  const playTimeText = computed(() => {
    if (!instance.value.playtime) {
      return t('instance.neverPlayed')
    }
    const [text, value, unit] = getHumanizeDuration(instance.value.playtime)

    switch (unit) {
      case TimeUnit.Hour:
        return t('duration.hour', { duration: text }, { plural: value })
      case TimeUnit.Minute:
        return t('duration.minute', { duration: text }, { plural: value })
      case TimeUnit.Second:
        return t('duration.second', { duration: text }, { plural: value })
      case TimeUnit.Day:
      default:
        return t('duration.day', { duration: text }, { plural: value })
    }
  })

  const items = computed(() => {
    const items: AvatarItemProps[] = []
    items.push({
      icon: 'schedule',
      title: t('instance.playtime'),
      responsive: true,
      text: playTimeText.value,
    }, {
      icon: 'update',
      title: t('instance.lastPlayed'),
      responsive: true,
      text: lastPlayedText.value,
    })
    return items as AvatarItemProps[]
  })

  return items
}

export function useExtensionItemsVersion(instance: Ref<Instance>, versionHeader: Ref<VersionHeader | undefined>) {
  const { t } = useI18n()
  const { showVersionDirectory } = useService(VersionServiceKey)
  const { getInstallation } = useService(BedrockServiceKey)
  const { allLoaders } = useModloadersCustom()

  const bedrockVersion = ref('')
  const bedrockInstalled = ref(false)

  const updateBedrockStatus = async () => {
    try {
      const status = await getInstallation()
      bedrockInstalled.value = status.installed
      bedrockVersion.value = status.version
    } catch {
      bedrockInstalled.value = false
      bedrockVersion.value = ''
    }
  }

  watch(instance, () => {
    if (instance.value.edition === 'bedrock') {
      updateBedrockStatus()
    }
  }, { immediate: true })

  const onShowLocalVersion = () => {
    if (versionHeader.value?.id) {
      showVersionDirectory(versionHeader.value.id)
    }
  }
  const items = computed(() => {
    const items: AvatarItemProps[] = []
    const runtime = instance.value.runtime

    if (instance.value.edition === 'bedrock') {
      items.push({
        avatar: BuiltinImages.bedrock,
        title: bedrockInstalled.value ? t('instances.editionBedrock') : t('version.notInstalled'),
        text: bedrockInstalled.value ? bedrockVersion.value : 'Bedrock',
      })
      return items
    }

    let custom: { name: string; icon?: string; version?: string } | undefined
    if (runtime.fabricLoader) {
      custom = resolveFabricCustomLoader(runtime.minecraft, runtime.fabricLoader)
    } else if (!runtime.forge && !runtime.neoForged && !runtime.quiltLoader && !runtime.optifine && !runtime.labyMod) {
      custom = resolveCustomLoaderFromInstance(instance.value, allLoaders.value)
    }

    const icon = custom?.icon || (runtime.forge ? BuiltinImages.forge : runtime.fabricLoader ? BuiltinImages.fabric : runtime.quiltLoader
      ? BuiltinImages.quilt : runtime.neoForged ? BuiltinImages.neoForged : runtime.optifine ? BuiltinImages.optifine : runtime.labyMod ? BuiltinImages.labyMod : BuiltinImages.minecraft)
    if (versionHeader.value) {
      items.push({
        avatar: icon,
        title: t('version.name') as string,
        text: versionHeader.value.id,
        onclick: () => onShowLocalVersion()
      })
    } else {
      let expect = getExpectVersion(runtime)
      if (instance.value.version && expect === runtime.minecraft) {
        expect = `${expect} (${custom?.name || instance.value.version})`
      }
      items.push({
        avatar: icon,
        title: t('version.notInstalled') as string,
        text: expect,
      })
    }
    return items as AvatarItemProps[]
  })

  return items
}

export function useExtensionItemsModLoader(instance: Ref<Instance>) {
  const { t } = useI18n()
  const { allLoaders } = useModloadersCustom()

  const item = computed<AvatarItemProps>(() => {
    const runtime = instance.value.runtime
    const loader = [
      ['NeoForge', runtime.neoForged, BuiltinImages.neoForged],
      ['Forge', runtime.forge, BuiltinImages.forge],
      ['Fabric', runtime.fabricLoader, BuiltinImages.fabric],
      ['Quilt', runtime.quiltLoader, BuiltinImages.quilt],
      ['OptiFine', runtime.optifine, BuiltinImages.optifine],
      ['LabyMod', runtime.labyMod, BuiltinImages.labyMod],
    ].find(([, value]) => value)

    let custom: { name: string; icon?: string; version?: string } | undefined
    if (runtime.fabricLoader) {
      custom = resolveFabricCustomLoader(runtime.minecraft, runtime.fabricLoader)
    }

    if (!loader && !custom) {
      custom = resolveCustomLoaderFromInstance(instance.value, allLoaders.value)
    }

    let loaderText = t('baseSetting.info.vanilla')
    let avatar: string | undefined

    if (custom) {
      const verText = (loader ? loader[1] : '') || custom.version || instance.value.version
      loaderText = verText ? `${custom.name} ${verText}` : custom.name
      avatar = custom.icon
    } else if (loader) {
      loaderText = `${loader[0]} ${loader[1]}`
      avatar = loader[2] as string
    } else if (instance.value.version) {
      loaderText = instance.value.version
    }

    return {
      icon: avatar ? undefined : 'extension',
      avatar,
      title: t('baseSetting.info.modLoader'),
      text: loaderText,
      responsive: true,
    }
  })

  return item
}
