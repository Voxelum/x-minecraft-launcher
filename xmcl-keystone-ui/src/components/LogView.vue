<template>
  <div class="log-view-container flex flex-col h-full">
    <div class="log-toolbar flex items-center gap-2 p-2 flex-shrink-0">
      <v-text-field
        v-model="searchText"
        :placeholder="t('logView.searchPlaceholder')"
        dense
        hide-details
        outlined
        clearable
        prepend-inner-icon="search"
        class="max-w-xs"
      />
      <v-btn-toggle
        v-model="viewMode"
        dense
        mandatory
      >
        <v-btn
          small
          value="default"
        >
          <v-icon small>
            view_agenda
          </v-icon>
        </v-btn>
        <v-btn
          small
          value="compact"
        >
          <v-icon small>
            view_list
          </v-icon>
        </v-btn>
      </v-btn-toggle>
    </div>
    <div
      ref="scroller" 
      class="visible-scroll rounded p-2 text-sm flex-grow overflow-auto"
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
          :key="displayLogs[virtualRow.index].raw + virtualRow.index"
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
            v-if="viewMode === 'compact'"
            :class="levelClasses[displayLogs[virtualRow.index].level]"
            class="log-record log-record-compact"
          >
            <span
              class="level level-compact"
            >{{ levelText[displayLogs[virtualRow.index].level] ? levelText[displayLogs[virtualRow.index].level] : displayLogs[virtualRow.index].level.toUpperCase() }}</span>
            <span v-if="displayLogs[virtualRow.index].date" class="date date-compact">{{ displayLogs[virtualRow.index].date }}</span>
            <span v-if="displayLogs[virtualRow.index].source" class="source source-compact">{{ displayLogs[virtualRow.index].source }}</span>
            <span v-if="displayLogs[virtualRow.index].groupCount && displayLogs[virtualRow.index].groupCount > 1" class="group-count">×{{ displayLogs[virtualRow.index].groupCount }}</span>
            <span class="content content-compact">{{ displayLogs[virtualRow.index].content }}</span>
          </div>
          <div
            v-else
            :class="levelClasses[displayLogs[virtualRow.index].level]"
            class="log-record"
          >
            <div class="">
              <span
                class="level"
              >{{ levelText[displayLogs[virtualRow.index].level] ? levelText[displayLogs[virtualRow.index].level] : displayLogs[virtualRow.index].level.toUpperCase() }}</span>
              <span v-if="displayLogs[virtualRow.index].date" class="date">{{ displayLogs[virtualRow.index].date }}</span>
              <span v-if="displayLogs[virtualRow.index].source" class="source">{{ displayLogs[virtualRow.index].source }}</span>
              <span v-if="displayLogs[virtualRow.index].groupCount && displayLogs[virtualRow.index].groupCount > 1" class="group-count">×{{ displayLogs[virtualRow.index].groupCount }}</span>
            </div>
            <span class="content">{{ displayLogs[virtualRow.index].content }}</span>
          </div>
        </div>
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
  </div>
</template>
<script lang="ts" setup>
import { injection } from '@/util/inject'
import { LogRecord } from '../util/log'
import { kTheme } from '@/composables/theme'
import { useScroll } from '@vueuse/core'
import { VirtualItem, VirtualizerOptions, useVirtualizer } from '@tanstack/vue-virtual'
import { filter as fuzzyFilter } from 'fuzzy'
import debounce from 'lodash.debounce'

interface DisplayLogRecord extends LogRecord {
  groupCount?: number
  _contentParts?: string[]
  _rawParts?: string[]
}

const props = defineProps<{ 
  logs: LogRecord[]
}>()
const { isDark } = injection(kTheme)

const container = ref<HTMLElement>()
const offsetTop = ref(0)
const scroller = ref<HTMLElement>()
const searchText = ref('')
const viewMode = ref<'default' | 'compact'>('default')

// Debounced search text for filtering
const debouncedSearchText = ref('')
const updateDebouncedSearch = debounce((val: string) => {
  debouncedSearchText.value = val
}, 200)
watch(searchText, updateDebouncedSearch)

// Filter logs based on search text using fuzzy search
const filteredLogs = computed(() => {
  if (!debouncedSearchText.value) {
    return props.logs
  }
  const results = fuzzyFilter(debouncedSearchText.value, props.logs, {
    extract: (log: LogRecord) => `${log.level} ${log.source} ${log.content}`
  })
  return results.filter(r => r.original != null).map(r => r.original!)
})

// Group consecutive logs with same metadata (level, date, source) in compact mode
const displayLogs = computed<DisplayLogRecord[]>(() => {
  const logs = filteredLogs.value
  if (viewMode.value !== 'compact' || logs.length === 0) {
    return logs
  }
  
  const result: DisplayLogRecord[] = []
  let currentGroup: DisplayLogRecord | null = null
  
  for (const log of logs) {
    if (currentGroup && 
        currentGroup.level === log.level && 
        currentGroup.date === log.date && 
        currentGroup.source === log.source) {
      // Same metadata - add to current group
      currentGroup.groupCount = (currentGroup.groupCount || 1) + 1
      // Use array collection for better performance with large datasets
      if (!currentGroup._contentParts) {
        currentGroup._contentParts = [currentGroup.content]
        currentGroup._rawParts = [currentGroup.raw]
      }
      currentGroup._contentParts.push(log.content)
      currentGroup._rawParts.push(log.raw)
      currentGroup.content = currentGroup._contentParts.join('\n')
      currentGroup.raw = currentGroup._rawParts.join('\n')
    } else {
      // Different metadata - start new group
      currentGroup = { ...log, groupCount: 1 }
      result.push(currentGroup)
    }
  }
  
  return result
})

watch(container, container => {
  if (container) {
    nextTick().then(() => { offsetTop.value = container.offsetTop })
  }
})
const virtualizerOptions = computed(() => ({
  count: displayLogs.value.length,
  getScrollElement: () => scroller.value || null,
  estimateSize: () => viewMode.value === 'compact' ? 32 : 56,
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

watch(() => displayLogs.value.length, () => {
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
  virtualizer.value.scrollToIndex(displayLogs.value.length - 1)
}

</script>

<style scoped>
.log-view-container {
  @apply relative;
}

.log-toolbar {
  @apply border-b border-gray-600;
}

.level {
  @apply select-none rounded border border-current border-solid p-1 mr-1;
}

.level-compact {
  @apply p-0.5 text-xs;
}

.source {
  @apply text-yellow-400 rounded border border-current border-dotted p-1 select-none rounded mr-1;
}

.source-compact {
  @apply p-0.5 text-xs;
}

.date {
  @apply p-1 text-gray-400 rounded border border-current border-dashed select-none rounded mr-1;
}

.date-compact {
  @apply p-0.5 text-xs;
}

.group-count {
  @apply text-purple-400 font-bold mr-1 select-none;
}

.content {
  @apply whitespace-pre-wrap break-words;
}

.content-compact {
  @apply ml-1;
}

.log-record {
  @apply px-2 leading-7 border-l-3 border-current;
}

.log-record-compact {
  @apply flex items-start leading-6 py-0.5;
}

.log-record:hover {
  @apply bg-[rgba(255,255,255,0.05)] cursor-text;
}

</style>
