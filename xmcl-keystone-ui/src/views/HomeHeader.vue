<template>
  <div
    class="header sticky mb-0 flex max-w-full flex-1 flex-grow-0 flex-col transition-all"
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
      class="align-center flex max-h-20 w-full flex-1 flex-grow-0 items-baseline px-6"
    >
      <span
        :style="{
          fontSize: headerFontSize
        }"
        class="text-shadow-lg overflow-hidden overflow-ellipsis whitespace-nowrap transition-all"
      >{{ name || `Minecraft ${version.minecraft}` }}</span>
      <router-view name="route" />
      <AvatarItem
        v-ripple
        :color="!isResolvedVersion(resolvedVersion) ? 'warning' : 'primary'"
        icon="fact_check"
        class="ml-2 cursor-pointer"
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
import { kInstance } from '@/composables/instance'
import { isResolvedVersion, kInstanceVersion } from '@/composables/instanceVersion'
import { kCompact } from '@/composables/scrollTop'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import { VersionServiceKey } from '@xmcl/runtime-api'

const { name, runtime: version } = injection(kInstance)
const { resolvedVersion } = injection(kInstanceVersion)
const isInFocusMode = useInFocusMode()
const { t } = useI18n()
const { showVersionDirectory } = useService(VersionServiceKey)

const currentVersion = computed(() => !isResolvedVersion(resolvedVersion.value) ? t('version.notInstalled') : resolvedVersion.value.id)
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
  if (isResolvedVersion(resolvedVersion.value)) {
    showVersionDirectory(resolvedVersion.value?.id)
  }
}

</script>
<style scoped>

.compact {
  background: rgba(255, 255, 255, 0.5);
}
.dark .compact {
  background: rgba(0, 0, 0, 0.5);
}

</style>
