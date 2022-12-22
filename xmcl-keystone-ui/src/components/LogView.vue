<template>
  <div class="flex flex-col gap-1 p-2 rounded text-sm visible-scroll">
    <div
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
    </div>
  </div>
</template>
<script lang="ts" setup>

import { useTheme } from '../composables'
import { LogRecord } from '../util/log'

defineProps<{ logs: LogRecord[] }>()
const { darkTheme } = useTheme()

const { t } = useI18n()
const levelText: Record<string, string> = reactive({
  info: computed(() => t('logLevel.info')),
  error: computed(() => t('logLevel.error')),
  warn: computed(() => t('logLevel.warning')),
})
const levelClasses: Record<string, string> = reactive({
  info: computed(() => darkTheme.value ? 'text-gray-300' : 'text-black-500'),
  warn: computed(() => 'text-orange-600'),
  error: computed(() => 'text-rose-600'),
})
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
  content-visibility: auto;
}

.log-record:hover {
  @apply bg-[rgba(255,255,255,0.05)] cursor-text;
}

</style>
