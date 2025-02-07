<template>
  <div
    ref="scroller" 
    class="visible-scroll flex flex-col gap-1 rounded p-2 text-sm"
    @wheel="onWheel"
  >
    <div
      ref="container"
      :style="{
        height: `${totalHeight}px`,
        position: 'relative',
        width: '100%',
        marginTop: `${-offsetTop}px`,
      }"  
    >
      <div
        v-for="virtualRow in virtualRows"
        :key="logs[virtualRow.index].raw"
        :ref="measureElement"
        :data-index="virtualRow.index"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualRow.start}px)`
        }"
      >
        <div
          :class="levelClasses[logs[virtualRow.index].level]"
          class="log-record"
        >
          <div class="">
            <span
              class="level"
            >{{ levelText[logs[virtualRow.index].level] ? levelText[logs[virtualRow.index].level] : logs[virtualRow.index].level.toUpperCase() }}</span>
            <span class="date">{{ logs[virtualRow.index].date }}</span>
            <span class="source">{{ logs[virtualRow.index].source }}</span>
          </div>
          <span class="content">{{ logs[virtualRow.index].content }}</span>
        </div>
      </div>
      <!-- <div
        v-for="(l, index) of logs"
        :key="index"
        :class="levelClasses[l.level]"
        class="log-record"
      >
        <div class="">
          <span
            class="level"
          >{{ levelText[l.level] ? levelText[l.level] : l.level.toUpperCase() }}</span>
          <span class="date">{{ l.date }}</span>
          <span class="source">{{ l.source }}</span>
        </div>
        <span class="content">{{ l.content }}</span>
      </div> -->
    </div>

    <v-fab-transition>

      <v-btn
      v-if="locked"
      class="z-10 absolute right-6 bottom-4"
      elevation="2"
      color="primary"
      fab
      @click="scrollToBottom"
      >
      <v-icon>arrow_downward</v-icon>
    </v-btn>
  </v-fab-transition>
  </div>
</template>
<script lang="ts" setup>
import { injection } from '@/util/inject'
import { LogRecord } from '../util/log'
import { kTheme } from '@/composables/theme'
import { useScroll } from '@vueuse/core';
import { VirtualItem, VirtualizerOptions, useVirtualizer } from '@tanstack/vue-virtual';

const props = defineProps<{ 
  logs: LogRecord[]
}>()
const { isDark } = injection(kTheme)

const container = ref<HTMLElement>()
const offsetTop = ref(0)
const scroller = ref<HTMLElement>()

watch(container, container => {
  if (container) {
    nextTick().then(() => { offsetTop.value = container.offsetTop })
  }
})
const virtualizerOptions = computed(() => ({
  count: props.logs.length,
  getScrollElement: () => scroller.value || null,
  estimateSize: () => 56,
  overscan: 10,
  paddingStart: offsetTop.value,
} satisfies Partial<VirtualizerOptions<HTMLElement, HTMLElement>>))
const totalHeight = computed(() => virtualizer.value.getTotalSize())
const virtualRows = computed(() => virtualizer.value.getVirtualItems() as (Omit<VirtualItem, 'key'> & { key: number })[])

const measureElement = (el: any) => {
  if (!el) return

  virtualizer.value.measureElement(el)
}

const { arrivedState } = useScroll(scroller)

const virtualizer = useVirtualizer(virtualizerOptions)

const { t } = useI18n()
const levelText: Record<string, string> = reactive({
  info: computed(() => t('logLevel.info')),
  error: computed(() => t('logLevel.error')),
  warn: computed(() => t('logLevel.warning')),
})
const levelClasses: Record<string, string> = reactive({
  info: computed(() => isDark.value ? 'text-gray-300' : 'text-black-500'),
  warn: computed(() => 'text-orange-600'),
  error: computed(() => 'text-rose-600'),
})

const locked = ref(true)
watch(computed(() => arrivedState.bottom), (bottom) => {
  if (bottom) {
    locked.value = true
  }
})

watch(() => props.logs.length, () => {
  if (locked.value) {
    nextTick(() => {
      scrollToBottom()
    })
  }
})

function onWheel(e: WheelEvent) {
  if (e.deltaY < 0) {
    locked.value = false
  }
}

function scrollToBottom() {
  virtualizer.value.scrollToIndex(props.logs.length - 1)
}

</script>

<style scoped>
.level {
  @apply select-none rounded border border-current border-solid p-1 mr-1;
}

.source {
  @apply text-yellow-400 rounded border border-current border-dotted p-1 select-none rounded mr-1;
}

.date {
  @apply p-1 text-gray-400 rounded border border-current border-dashed select-none rounded mr-1;
}

.content {
  @apply whitespace-pre-wrap break-words;
}

.log-record {
  @apply px-2 leading-7 border-l-3 border-current;
}

.log-record:hover {
  @apply bg-[rgba(255,255,255,0.05)] cursor-text;
}

</style>
