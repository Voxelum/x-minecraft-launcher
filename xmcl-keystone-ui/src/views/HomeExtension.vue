<template>
  <div
    class="flex flex-1 flex-grow-0 flex-row items-center justify-start min-h-[52px]"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div
      class="flex flex-grow-0 flex-row items-center justify-center gap-3"
    >
      <template
        v-for="ver of versions"
        :key="ver.title"
      >
        <AvatarItem
          :avatar="ver.icon"
          :title="ver.title"
          responsive
          :text="ver.version"
        />
        <v-divider
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
    <!-- <AppExtensionRoutes
      :items="[
        { icon: 'settings', title: t('baseSetting.title', 2), to: '/base-setting' },
        { icon: 'extension', title: t('mod.name', 2), to: '/mods' },
        { icon: 'palette', title: t('resourcepack.name', 2), to: '/resourcepacks' },
        { icon: 'gradient', title: t('shaderPack.name', 2), to: '/shaderpacks' },
        { icon: 'map', title: t('save.name', 2), to: '/saves' }
      ]"
    /> -->
    <div class="flex-grow mr-2" />
    <transition name="fade-transition">
      <div
        v-if="!isInFocusMode || !(currentRoute.path === '/')"
        key="launch-button-group"
        class="flex items-center justify-end overflow-hidden"
      >
        <AvatarItem
          v-if="versionId"
          icon="fact_check"
          class="ml-2 p-1"
          :title="t('version.name', 2)"
          :text="currentVersion"
          @click="onShowLocalVersion"
        />
        <AvatarItem
          v-else
          color="warning"
          icon="fact_check"
          class="ml-2"
          :title="t('version.name', 2)"
          :text="currentVersion"
        />
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
import { useDateString } from '@/composables/date'
import { kInstance } from '@/composables/instance'
import { kLaunchTask } from '@/composables/launchTask'
import { kCompact } from '@/composables/scrollTop'
import { useInFocusMode } from '@/composables/uiLayout'
import { getHumanizeDuration, TimeUnit } from '@/util/date'
import { injection } from '@/util/inject'
import useSWRV from 'swrv'
import { getExtensionItemsFromRuntime } from '@/util/extensionItems'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { VersionServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables/service'

const { versionId } = injection(kInstanceVersion)
const currentVersion = computed(() => !versionId.value ? t('version.notInstalled') : versionId.value)
const { instance, runtime: version } = injection(kInstance)
const isInFocusMode = useInFocusMode()
const { total, progress, status, name: taskName } = injection(kLaunchTask)
const { currentRoute } = useRouter()

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

const { showVersionDirectory } = useService(VersionServiceKey)
const onShowLocalVersion = () => {
  if (versionId.value) {
    showVersionDirectory(versionId.value)
  }
}
</script>
