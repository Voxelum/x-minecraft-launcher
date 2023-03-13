<template>
  <div
    class="mb-0 flex flex-col flex-1 flex-grow-0 max-w-full transition-all header sticky"
    :class="{
      'backdrop-filter': !isInFocusMode,
      'backdrop-blur-sm': !isInFocusMode,
      compact,
      'pt-10': !compact,
      'pt-5': compact,
    }"
    @wheel.stop
  >
    <div
      class="flex w-full align-center max-h-20 flex-grow-0 flex-1 items-baseline pl-6 pr-6"
    >
      <span
        :style="{
          fontSize: headerFontSize
        }"
        class="text-shadow-lg transition-all whitespace-nowrap overflow-hidden overflow-ellipsis"
      >{{ name || `Minecraft ${version.minecraft}` }}</span>
      <router-view name="route" />
      <AvatarItem
        v-ripple
        :color="!localVersion.id ? 'warning' : 'primary'"
        icon="fact_check"
        class="cursor-pointer ml-2"
        :title="t('version.name', 2)"
        :text="currentVersion"
        @click="onShowLocalVersion"
      />
      <div class="flex-grow" />
      <router-view name="actions" />
    </div>
    <router-view
      name="extensions"
      class="pl-4 pr-6"
      :class="{
        'mt-5': !compact,
        'mt-3': compact,
      }"
    />

    <v-divider
      class="transition-all"
      :class="{
        'mx-4': !compact,
      }"
    />
  </div>
</template>

<script lang=ts setup>
import AvatarItem from '@/components/AvatarItem.vue'
import { useService } from '@/composables'
import { kInstanceContext } from '@/composables/instanceContext'
import { kCompact } from '@/composables/scrollTop'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import { VersionServiceKey } from '@xmcl/runtime-api'

const { path, name, version, localVersion } = injection(kInstanceContext)
const isInFocusMode = useInFocusMode()
const { t } = useI18n()
const { showVersionDirectory } = useService(VersionServiceKey)

const currentVersion = computed(() => !localVersion.value.id ? t('version.notInstalled') : localVersion.value.id)
const scrollTop = injection(kCompact)
const compact = computed(() => scrollTop.value)
const headerFontSize = computed(() => {
  if (compact.value) {
    return '1.8rem'
  }
  if (name.value && name.value.length > 30) {
    return '2rem'
  }
  return '2.425rem'
})

const onShowLocalVersion = () => {
  if (localVersion.value.id) {
    showVersionDirectory(localVersion.value.id)
  }
}

</script>
<style scoped>
.compact {
  background: rgba(0, 0, 0, 0.5);
}

</style>
