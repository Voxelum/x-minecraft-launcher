import { AvatarItemProps } from '@/components/AvatarItem.vue'
import { BuiltinImages } from '@/constant'
import { TimeUnit, getHumanizeDuration } from '@/util/date'
import { Instance } from '@xmcl/instance'
import { VersionHeader, VersionServiceKey, getExpectVersion } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { useDateString } from './date'
import { useService } from './service'

export function useExtensionItemsGamePlay(instance: Ref<Instance>) {
  const { t } = useI18n()
  const { getDateString } = useDateString()
  const { data: lastPlayedText } = useSWRV(computed(() => `${instance.value.path}/lastPlay`), () => {
    const i = instance.value
    const date = i.lastPlayedDate
    if (!date) {
      return t('instance.neverPlayed')
    }
    const result = getDateString(date)
    return result
  }, { revalidateOnFocus: true })

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
  const onShowLocalVersion = () => {
    if (versionHeader.value?.id) {
      showVersionDirectory(versionHeader.value.id)
    }
  }
  const items = computed(() => {
    const items: AvatarItemProps[] = []
    const runtime = instance.value.runtime
    const icon = runtime.forge ? BuiltinImages.forge : runtime.fabricLoader ? BuiltinImages.fabric : runtime.quiltLoader
      ? BuiltinImages.quilt : runtime.neoForged ? BuiltinImages.neoForged : runtime.optifine ? BuiltinImages.optifine : runtime.labyMod ? BuiltinImages.labyMod : BuiltinImages.minecraft
    if (versionHeader.value) {
      items.push({
        avatar: icon,
        title: t('version.name') as string,
        text: versionHeader.value.id,
        onclick: () => onShowLocalVersion()
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
