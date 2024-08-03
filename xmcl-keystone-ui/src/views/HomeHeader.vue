<template>
  <div
    class="header sticky max-w-full select-none transition-all"
    :class="{
      'backdrop-filter': !isInFocusMode,
      'backdrop-blur-sm': !isInFocusMode,
      compact,
      'pt-10': !compact,
      'pt-5': compact,
    }"
    @transitionstart="onTransitionStart"
    @transitionend="onTransitionEnd"
    @transitioncancel="onTransitionEnd"
    @wheel.stop
  >
    <div
      class="flex flex-col header-content"
      style="margin: auto"
    >
      <div
        class="align-center flex max-h-20 flex-1 flex-grow-0 items-baseline px-6"
      >
        <span
          :style="{
            fontSize: headerFontSize
          }"
          class="overflow-hidden overflow-ellipsis whitespace-nowrap transition-all"
        >{{ name || `Minecraft ${version.minecraft}` }}</span>
        <router-view name="route" />
        <AvatarItem
          v-if="versionId"
          v-ripple
          icon="fact_check"
          class="ml-2 cursor-pointer"
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
        <div class="flex-grow" />
        <transition
          name="slide-x-transition"
          mode="out-in"
        >
          <router-view name="actions" />
        </transition>
      </div>
      <transition
        name="slide-y-reverse-transition"
        mode="out-in"
      >
        <router-view
          name="extensions"
          class="pl-4 pr-6"
          :class="{
            'mt-5': !compact,
            'mt-3': compact,
          }"
        />
      </transition>
    </div>
    <v-divider
      class="transition-all divider"
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
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kCompact } from '@/composables/scrollTop'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import { VersionServiceKey } from '@xmcl/runtime-api'

const { name, runtime: version } = injection(kInstance)
const { versionId } = injection(kInstanceVersion)
const isInFocusMode = useInFocusMode()
const { t } = useI18n()
const { showVersionDirectory } = useService(VersionServiceKey)

const transitioning = ref(false)
provide('transitioning', transitioning)

const onTransitionStart = (e: TransitionEvent) => {
  if (e.propertyName !== 'transform') return
  transitioning.value = true
}
const onTransitionEnd = (e: TransitionEvent) => {
  if (e.propertyName !== 'transform') return
  transitioning.value = false
}

const currentVersion = computed(() => !versionId.value ? t('version.notInstalled') : versionId.value)
const compact = injection(kCompact)
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
  if (versionId.value) {
    showVersionDirectory(versionId.value)
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

/* .header-content {
  max-width: 1300px;
  width: 1220px;
}

.divider {
  margin-top: 10px;
}

@media screen and (max-width: 1300px) {
  .header-content {
    max-width: 100%;
  }

  .divider {
    margin-top: 0px;
  }
} */
</style>
