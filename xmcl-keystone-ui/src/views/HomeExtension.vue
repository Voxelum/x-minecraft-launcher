<template>
  <div
    class="flex flex-grow-0 flex-1 flex-row items-center justify-center"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div
      class="flex flex-row items-center gap-1 flex-grow-0 justify-center"
    >
      <AvatarItem
        :avatar="'image://builtin/minecraft'"
        title="Minecraft"
        responsive
        :text="`${version.minecraft}`"
      />
      <v-divider vertical />
      <AvatarItem
        v-if="version.forge"
        :avatar="'image://builtin/forge'"
        responsive
        title="Forge"
        :text="`${version.forge}`"
      />
      <v-divider
        v-if="version.forge"
        vertical
      />
      <AvatarItem
        v-if="version.fabricLoader"
        :avatar="'image://builtin/fabric'"
        responsive
        title="Fabric"
        :text="`${version.fabricLoader}`"
      />
      <v-divider
        v-if="version.fabricLoader"
        vertical
      />
      <AvatarItem
        v-if="version.quiltLoader"
        :avatar="'image://builtin/quilt'"
        responsive
        title="Quilt"
        :text="`${version.quiltLoader}`"
      />
      <v-divider
        v-if="version.quiltLoader"
        vertical
      />
      <AvatarItem
        v-if="version.optifine"
        :avatar="'image://builtin/optifine'"
        responsive
        title="Optifine"
        :text="`${version.optifine}`"
      />
      <v-divider
        v-if="version.optifine"
        vertical
      />
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
      class="flex align-end gap-7 flex-1 flex-grow-0"
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
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kLaunchTask } from '@/composables/launchTask'

const { instance, runtime: version } = injection(kInstance)
const isInFocusMode = useInFocusMode()
const { total, progress, status, name: taskName } = injection(kLaunchTask)
const { t } = useI18n()

const compact = injection(kCompact)
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
