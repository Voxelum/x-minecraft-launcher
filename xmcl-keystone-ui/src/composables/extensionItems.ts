import { AvatarItemProps } from '@/components/AvatarItem.vue'
import { BuiltinImages } from '@/constant'
import { Instance } from '@xmcl/instance'
import {
  VersionHeader,
  VersionServiceKey,
  getExpectVersion,
  BedrockServiceKey,
} from '@xmcl/runtime-api'
import { useDateString } from './date'
import { useService } from './service'

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
    const playtime = instance.value.playtime

    if (!playtime) {
      return t('instance.neverPlayed')
    }

    const totalSeconds = Math.floor(playtime / 1000)
    const totalMinutes = Math.floor(totalSeconds / 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    const parts: string[] = []

    if (hours > 0) {
      parts.push(t('duration.hour', { duration: hours }, { plural: hours }))
    }

    if (minutes > 0) {
      parts.push(t('duration.minute', { duration: minutes }, { plural: minutes }))
    }

    if (parts.length === 0) {
      parts.push(t('duration.second', { duration: totalSeconds }, { plural: totalSeconds }))
    }

    return parts.join(' ')
  })

  const items = computed(() => {
    const items: AvatarItemProps[] = []
    items.push(
      {
        icon: 'schedule',
        title: t('instance.playtime'),
        responsive: true,
        text: playTimeText.value,
      },
      {
        icon: 'update',
        title: t('instance.lastPlayed'),
        responsive: true,
        text: lastPlayedText.value,
      },
    )
    return items as AvatarItemProps[]
  })

  return items
}

export function useExtensionItemsVersion(
  instance: Ref<Instance>,
  versionHeader: Ref<VersionHeader | undefined>,
) {
  const { t } = useI18n()
  const { showVersionDirectory } = useService(VersionServiceKey)
  const { getInstallation } = useService(BedrockServiceKey)

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

  watch(
    instance,
    () => {
      if (instance.value.edition === 'bedrock') {
        updateBedrockStatus()
      }
    },
    { immediate: true },
  )

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

    const icon = runtime.forge
      ? BuiltinImages.forge
      : runtime.fabricLoader
        ? BuiltinImages.fabric
        : runtime.quiltLoader
          ? BuiltinImages.quilt
          : runtime.neoForged
            ? BuiltinImages.neoForged
            : runtime.optifine
              ? BuiltinImages.optifine
              : runtime.labyMod
                ? BuiltinImages.labyMod
                : BuiltinImages.minecraft
    if (versionHeader.value) {
      items.push({
        avatar: icon,
        title: t('version.name') as string,
        text: versionHeader.value.id,
        onclick: () => onShowLocalVersion(),
      })
    } else {
      items.push({
        avatar: icon,
        title: t('version.notInstalled') as string,
        text: getExpectVersion(runtime),
      })
    }
    return items as AvatarItemProps[]
  })
  return items
}
