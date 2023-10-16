<template>
  <div
    class="flex flex-1 flex-grow-0 flex-row items-center justify-center"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div
      class="flex flex-grow-0 flex-row items-center justify-center gap-1"
    >
      <template v-for="ver of versions">
        <AvatarItem
          :key="ver.title"
          :avatar="ver.icon"
          :title="ver.title"
          responsive
          :text="ver.version"
        />
        <v-divider
          :key="`${ver.title}-divider`"
          vertical
        />
      </template>
      <AvatarItem
        icon="schedule"
        :title="t('instance.playtime')"
        responsive
        :text="playTimeText"
      />
      <v-divider
        vertical
      />
      <AvatarItem
        icon="update"
        :title="t('instance.lastPlayed')"
        responsive
        :text="lastPlayedText"
      />
    </div>
    <div class="flex-grow" />
    <div
      v-if="!isInFocusMode"
      class="align-end flex flex-1 flex-grow-0 gap-7"
    >
      <HomeHeaderInstallStatus
        v-if="status === 1 || status === 3"
        :name="taskName"
        :total="total"
        :progress="progress"
      />
      <HomeLaunchButton
        :compact="compact"
      />
    </div>
  </div>
</template>

<script lang=ts setup>
import AvatarItem from '@/components/AvatarItem.vue'
import { kCompact } from '@/composables/scrollTop'
import { useInFocusMode } from '@/composables/uiLayout'
import { getAgoOrDate, getHumanizeDuration, TimeUnit } from '@/util/date'
import { injection } from '@/util/inject'
import HomeHeaderInstallStatus from './HomeHeaderInstallStatus.vue'
import HomeLaunchButton from './HomeLaunchButton.vue'
import useSWRV from 'swrv'
import { kInstance } from '@/composables/instance'
import { kLaunchTask } from '@/composables/launchTask'

const { instance, runtime: version } = injection(kInstance)
const isInFocusMode = useInFocusMode()
const { total, progress, status, name: taskName } = injection(kLaunchTask)
const { t } = useI18n()

const compact = injection(kCompact)
const versions = computed(() => {
  const ver = version.value
  const result: Array<{icon: string; title: string; version: string}> = []
  if (ver.minecraft) {
    result.push({
      icon: 'image://builtin/minecraft',
      title: 'Minecraft',
      version: ver.minecraft,
    })
  }
  if (ver.forge) {
    result.push({
      icon: 'image://builtin/forge',
      title: 'Forge',
      version: ver.forge,
    })
  }
  if (ver.neoForged) {
    result.push({
      icon: 'image://builtin/neoForged',
      title: 'NeoForged',
      version: ver.neoForged,
    })
  }
  if (ver.fabricLoader) {
    result.push({
      icon: 'image://builtin/fabric',
      title: 'Fabric',
      version: ver.fabricLoader,
    })
  }
  if (ver.quiltLoader) {
    result.push({
      icon: 'image://builtin/quilt',
      title: 'Quilt',
      version: ver.quiltLoader,
    })
  }
  if (ver.optifine) {
    result.push({
      icon: 'image://builtin/optifine',
      title: 'Optifine',
      version: ver.optifine,
    })
  }
  if (ver.labyMod) {
    result.push({
      icon: 'image://builtin/labyMod',
      title: 'LabyMod',
      version: ver.labyMod,
    })
  }
  return result
})
const { data: lastPlayedText } = useSWRV(computed(() => `${instance.value.path}/lastPlay`), () => {
  const i = instance.value
  const date = i.lastPlayedDate
  if (!date) {
    return t('instance.neverPlayed')
  }
  const result = getAgoOrDate(date)
  if (typeof result === 'string') {
    return result
  }
  const [ago, unit] = result
  switch (unit) {
    case TimeUnit.Hour:
      return t('ago.hour', { duration: ago }, { plural: ago })
    case TimeUnit.Minute:
      return t('ago.minute', { duration: ago }, { plural: ago })
    case TimeUnit.Second:
      return t('ago.second', { duration: ago }, { plural: ago })
    case TimeUnit.Day:
      return t('ago.day', { duration: ago }, { plural: ago })
  }
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
      return t('duration.day', { duration: text }, { plural: value })
  }
})

</script>
