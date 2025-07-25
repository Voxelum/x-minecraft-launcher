<template>
  <div
    class="flex flex-1 flex-grow-0 flex-row items-center justify-start min-h-[52px]"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div class="w-full h-30% fixed left-0 bottom-0 header-overlay opacity-20 dark:opacity-80 pointer-events-none" :style="{
      'background-image': `linear-gradient(to top, ${appBarColor}, transparent)`
    }" />
    <div
      class="flex flex-grow-0 flex-col gap-4 fixed bottom-7.5 z-2 -ml-1"
    >
      <!-- <div class="text-sm text-secondary overflow-hidden overflow-ellipsis whitespace-nowrap transition-all mt-5 text-white/50 flex items-center">
        <v-icon class="!text-inherit ml-1 mr-5">schedule</v-icon> 3天前 / 132小时
      </div> -->
      <template
        v-for="ver of versions"
      >
        <div class="flex items-center gap-4">
          <AvatarItem
            :key="ver.title"
            :avatar="ver.icon"
            :title="ver.title"
            responsive
            :text="ver.version"
          />
          <v-icon v-if="ver.title !== 'Minecraft'" size="20" class="opacity-90 dark:opacity-60 cursor-pointer hover:opacity-100">launch</v-icon>
          <!-- <div v-if="ver.title !== 'Minecraft'" class="opacity-50 flex items-center gap-2 text-sm">
            <v-icon size="16">launch</v-icon>
            安装模组
          </div> -->
        </div>
        <!-- <v-divider
          :key="`${ver.title}-divider`"
          vertical
        /> -->
      </template>
      <AvatarItem
        icon="schedule"
        title="总时长 / 上次启动"
        responsive
        text="132小时 / 3天前"
        icon-class="opacity-70"
      />
      <!-- <AvatarItem
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
      /> -->
    </div>
    <div class="flex-grow mr-2" />
    <transition name="fade-transition">
      <div
        key="launch-button-group"
        class="flex items-center justify-end overflow-hidden"
        v-if="!isInFocusMode || !(router.currentRoute.path === '/')"
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
          class="ml-4"
          :compact="compact"
          @mouseenter="active = true"
          @mouseleave="active = false"
        />
      </div>
    </transition>
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
import { kTheme } from '@/composables/theme'

const { instance, runtime: version } = injection(kInstance)
const isInFocusMode = useInFocusMode()
const { total, progress, status, name: taskName } = injection(kLaunchTask)
const router = useRouter()

const { appBarColor } = injection(kTheme)
const headerHeight = ref(0)
provide('headerHeight', headerHeight)

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
