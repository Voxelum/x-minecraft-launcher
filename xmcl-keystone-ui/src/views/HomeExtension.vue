<template>
  <div
    class="flex flex-1 flex-grow-0 flex-row items-center justify-start"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div
      class="flex flex-grow-0 flex-row items-center justify-center gap-1"
    >
      <template
        v-for="ver of versions"
      >
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
    <template
      v-if="!isInFocusMode"
    >
      <HomeHeaderInstallStatus
        v-if="status === 1 || status === 3"
        class="mr-2"
        :name="taskName"
        :total="total"
        :progress="progress"
      />
      <HomeLaunchButtonStatus
        v-else
        :active="active"
      />
      <HomeLaunchButton
        :compact="compact"
        @mouseenter="active = true"
        @mouseleave="active = false"
      />
    </template>
  </div>
</template>

<script lang=ts setup>
import AvatarItem from '@/components/AvatarItem.vue'
import { useDateString } from '@/composables/date'
import { kInstance } from '@/composables/instance'
import { kLaunchTask } from '@/composables/launchTask'
import { kCompact } from '@/composables/scrollTop'
import { useInFocusMode } from '@/composables/uiLayout'
import { getHumanizeDuration, TimeUnit } from '@/util/date'
import { injection } from '@/util/inject'
import useSWRV from 'swrv'
import HomeHeaderInstallStatus from './HomeHeaderInstallStatus.vue'
import HomeLaunchButton from './HomeLaunchButton.vue'
import HomeLaunchButtonStatus from './HomeLaunchButtonStatus.vue'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'

const { instance, runtime: version } = injection(kInstance)
const isInFocusMode = useInFocusMode()
const { total, progress, status, name: taskName } = injection(kLaunchTask)

const active = ref(false)

const { t } = useI18n()

const compact = injection(kCompact)
const versions = computed(() => {
  const ver = version.value
  const items = getExtensionItemsFromRuntime(ver)
  return items.map(i => ({
    icon: i.avatar,
    title: i.title,
    version: i.text,
  }))
})
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

</script>
