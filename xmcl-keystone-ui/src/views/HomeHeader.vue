<template>
  <div
    class="header sticky max-w-full select-none transition-all px-2"
    :style="{
      '--app-bar-color': appBarColor,
      '--app-bar-blur': blurAppBar + 'px',
    }"
    :class="{
      compact,
    }"
    @transitionstart="onTransitionStart"
    @transitionend="onTransitionEnd"
    @transitioncancel="onTransitionEnd"
    @wheel.stop
  >
    <div
      class="flex flex-col header-content"
      style="margin: auto"
      :style="{
        opacity: dragover ? 0 : '',
      }"
    >
      <div
        class="align-center flex max-h-20 flex-1 flex-grow-0 items-baseline pl-6 pr-2 gap-1"
      >
        <span
          :style="{
            fontSize: headerFontSize
          }"
          class="home-title overflow-hidden overflow-ellipsis whitespace-nowrap transition-all"
        >{{ name || `Minecraft ${version.minecraft}` }}</span>
        <router-view name="route" />
        <div class="flex-grow" />
        <router-view name="actions" v-slot="{ Component }">
          <transition
            name="slide-x-transition"
            mode="out-in"
          >
            <component :is="Component" class="flex-shrink-0" />
          </transition>
        </router-view>
      </div>
      <router-view name="extensions" v-slot="{ Component }">
        <transition
          name="slide-y-reverse-transition"
          mode="out-in"
        >
          <component
            :is="Component"
            class="px-4"
            :class="{
              'mt-5': !compact,
              'mt-3': compact,
            }"
          />
        </transition>
      </router-view>
    </div>
    <div
      v-if="dragover"
      class="w-full h-full flex top-0 p-5"
      style="position: absolute;"
      @dragenter="overcount++"
      @dragleave="overcount--"
      @drop="overcount = 0; onDropModpack($event)"
    >
      <Hint
        :text="t('modpack.dropHint')"
        icon="save_alt"
        class="rounded transition-all"
        :class="{
          dragover,
          yellow: overcount > 0,
          'darken-2': overcount > 0,
        }"
        :style="{
          transform: overcount > 0 ? 'scale(1.0125)' : ''
        }"
      />
    </div>
  </div>
</template>

<script lang=ts setup>
import Hint from '@/components/Hint.vue'
import { useDialog } from '@/composables/dialog'
import { kDropHandler } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kCompact } from '@/composables/scrollTop'
import { kTheme } from '@/composables/theme'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'

const { name, runtime: version } = injection(kInstance)
const isInFocusMode = useInFocusMode()
const { blurAppBar, appBarColor } = injection(kTheme)
const { t } = useI18n()

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

const { dragover } = injection(kDropHandler)
const { show } = useDialog(AddInstanceDialogKey)
const onDropModpack = (e: DragEvent) => {
  e.preventDefault()
  const file = e.dataTransfer?.files.item(0)
  if (file) {
    show({
      format: 'modpack',
      path: file.path,
    })
  }
}

const overcount = ref(0)
</script>
<style scoped>

.header {
  padding-top: 2.5rem;
}

/*
 * Faded backdrop so content scrolling underneath the sticky header is masked
 * instead of bleeding through the (otherwise transparent) header. The gradient
 * matches the global app-bar overlay color and lives in the header's own
 * stacking context (z-20), so it sits above the scrolling page content while
 * staying behind the header text (z-index: -1). The backdrop blur is masked
 * with the same gradient so it fades out smoothly instead of cutting off.
 */
.header::before {
  content: '';
  position: absolute;
  inset: 0;
  bottom: -70px;
  z-index: -1;
  pointer-events: none;
  background-image: linear-gradient(var(--app-bar-color, transparent), transparent);
  -webkit-backdrop-filter: blur(var(--app-bar-blur, 0));
  backdrop-filter: blur(var(--app-bar-blur, 0));
  -webkit-mask-image: linear-gradient(black 40%, transparent);
  mask-image: linear-gradient(black 40%, transparent);
}

.header.compact::before {
  bottom: -30px;
}

.header.compact {
  padding-top: 1.25rem;
  padding-bottom: 1.25rem;
}

</style>
