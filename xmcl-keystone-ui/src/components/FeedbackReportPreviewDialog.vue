<template>
  <v-dialog v-model="model" width="1100" max-width="96vw">
    <v-card class="flex flex-col max-h-[88vh] overflow-hidden rounded-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0 border-b border-white/5">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10">
            <v-icon size="22" color="primary">visibility</v-icon>
          </div>
          <div class="flex flex-col min-w-0">
            <div class="text-base font-bold">{{ t('feedback.previewTitle') }}</div>
            <div class="text-xs opacity-60">{{ t('feedback.previewSubtitle') }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <v-chip size="small" variant="tonal" :color="anonymized ? 'primary' : 'warning'" :prepend-icon="anonymized ? 'security' : 'lock_open'">
            {{ anonymized ? t('feedback.anonymizeIp') : t('feedback.notAnonymized') }}
          </v-chip>
          <v-btn icon="close" variant="text" size="small" @click="model = false" />
        </div>
      </div>

      <!-- Quick Metrics Bar -->
      <div v-if="report" class="px-6 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0 bg-black/10">
        <div v-for="m in metrics" :key="m.label" class="surface-panel p-2.5 rounded-lg flex items-center gap-2.5 min-w-0">
          <v-icon size="18" color="primary" class="flex-shrink-0">{{ m.icon }}</v-icon>
          <div class="flex flex-col min-w-0">
            <span class="text-[10px] opacity-60 uppercase font-bold">{{ m.label }}</span>
            <span class="text-xs font-semibold truncate">{{ m.val }}</span>
          </div>
        </div>
      </div>

      <!-- Main Split View -->
      <div v-if="report" class="flex flex-1 min-h-0 overflow-hidden">
        <!-- Sidebar: Catalog & Date Filter -->
        <div class="w-80 flex-shrink-0 flex flex-col border-r border-white/5 bg-black/15">
          <div class="p-3 flex flex-col gap-2 border-b border-white/5 flex-shrink-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <v-chip
                v-for="f in dateFilters"
                :key="f.key"
                size="small"
                :variant="selectedDate === f.key ? 'flat' : 'tonal'"
                :color="selectedDate === f.key ? 'primary' : undefined"
                class="cursor-pointer"
                @click="selectedDate = f.key"
              >
                {{ f.label }}
              </v-chip>
              <v-menu v-if="historyDates.length > 0">
                <template #activator="{ props: menuProps }">
                  <v-chip
                    v-bind="menuProps"
                    size="small"
                    :variant="isSpecificDate ? 'flat' : 'tonal'"
                    :color="isSpecificDate ? 'primary' : undefined"
                    append-icon="arrow_drop_down"
                    class="cursor-pointer"
                  >
                    {{ isSpecificDate ? selectedDate : t('feedback.filterByDate') }}
                  </v-chip>
                </template>
                <v-list density="compact" class="max-h-60 overflow-y-auto">
                  <v-list-item v-for="d in historyDates" :key="d" :active="selectedDate === d" @click="selectedDate = d">
                    <v-list-item-title class="text-xs">{{ d }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
            <v-text-field
              v-model="catalogSearch"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              prepend-inner-icon="search"
              :placeholder="t('feedback.searchCatalog')"
              class="text-xs"
            />
          </div>

          <!-- Catalog List -->
          <div class="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
            <div
              v-for="item in catalogItems"
              :key="item.id"
              class="flex items-center gap-2.5 p-2 rounded-xl cursor-pointer text-xs transition-colors"
              :class="selectedId === item.id ? 'bg-primary/20 text-primary font-semibold' : 'hover:bg-white/5 opacity-85'"
              @click="selectedId = item.id"
            >
              <v-icon size="18" :color="selectedId === item.id ? 'primary' : undefined">{{ item.icon }}</v-icon>
              <div class="flex flex-col min-w-0 flex-1">
                <span class="truncate">{{ item.title }}</span>
                <span class="text-[10px] opacity-60 truncate">{{ item.subtitle }}</span>
              </div>
              <v-chip v-if="item.size" size="x-small" variant="tonal" density="compact">{{ getExpectedSize(item.size) }}</v-chip>
            </div>
            <div v-if="catalogItems.length === 0" class="text-center py-8 opacity-60 text-xs">{{ t('feedback.noLogs') }}</div>
          </div>
        </div>

        <!-- Right Viewer -->
        <div class="flex-1 min-w-0 flex flex-col overflow-hidden p-4 gap-3 bg-black/5">
          <div class="flex items-center justify-between gap-3 flex-shrink-0">
            <div class="flex items-center gap-2.5 min-w-0">
              <v-icon size="20" color="primary">{{ activeItem?.icon || 'article' }}</v-icon>
              <div class="flex flex-col min-w-0">
                <div class="text-sm font-bold truncate">{{ activeItem?.title }}</div>
                <div class="text-[11px] opacity-60 truncate">{{ activeItem?.subtitle }}</div>
              </div>
              <v-chip v-if="activeItem?.size" size="x-small" variant="tonal" class="ml-1">{{ getExpectedSize(activeItem.size) }}</v-chip>
            </div>
            <div class="flex items-center gap-2">
              <v-text-field
                v-if="selectedId !== 'device'"
                v-model="lineSearch"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                prepend-inner-icon="search"
                :placeholder="t('feedback.previewSearchPlaceholder')"
                class="w-56 text-xs"
              />
              <span v-if="selectedId !== 'device'" class="text-xs opacity-60 whitespace-nowrap">
                {{ displayedLines.length }} / {{ totalLines }} {{ t('feedback.previewLines') }}
              </span>
              <v-btn variant="tonal" size="small" prepend-icon="content_copy" @click="copy(activeContent)">
                {{ t('feedback.copy') }}
              </v-btn>
            </div>
          </div>

          <pre class="flex-1 min-h-0 font-mono text-xs overflow-auto p-4 rounded-xl select-text leading-relaxed bg-black/30 border border-white/5 whitespace-pre-wrap break-all">{{ activeContent || t('feedback.previewNoContent') }}</pre>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3 border-t border-white/5 flex items-center justify-between flex-shrink-0">
        <v-btn color="error" variant="tonal" prepend-icon="delete_sweep" :loading="clearing" @click="onClear">
          {{ t('feedback.clearLogs') }}
        </v-btn>
        <v-btn variant="tonal" @click="model = false">{{ t('shared.close') }}</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { BaseServiceKey, ReportPreview } from '@xmcl/runtime-api'
import { getExpectedSize } from '@/util/size'
import { getLocalDateString } from '@/util/date'
import { useNotifier } from '@/composables/notifier'
import { useService } from '@/composables'

const props = defineProps<{ report: ReportPreview | null; anonymized: boolean }>()
const emit = defineEmits<{ (e: 'cleared'): void }>()
const model = defineModel<boolean>({ required: true })
const { t } = useI18n()
const { notify } = useNotifier()
const { clearLogs } = useService(BaseServiceKey)

const selectedId = ref('device')
const selectedDate = ref('all')
const catalogSearch = ref('')
const lineSearch = ref('')
const clearing = ref(false)

const todayStr = computed(() => new Date().toISOString().split('T')[0])
const isSpecificDate = computed(() => selectedDate.value !== 'all' && selectedDate.value !== 'today')

const dateFilters = computed(() => [
  { key: 'all', label: t('feedback.filterDateAll') },
  { key: 'today', label: t('feedback.filterDateToday') },
])

const formattedDate = computed(() => props.report ? getLocalDateString(props.report.timestamp, { dateStyle: 'medium', timeStyle: 'medium' }) : '')
const deviceJson = computed(() => props.report ? JSON.stringify(props.report.device, null, 2) : '')

const metrics = computed(() => [
  { icon: 'calendar_today', label: t('feedback.previewTimestamp'), val: formattedDate.value },
  { icon: 'computer', label: t('feedback.previewPlatform'), val: `${props.report?.device.platform} (${props.report?.device.arch})` },
  { icon: 'info', label: t('feedback.previewOsRelease'), val: props.report?.device.release },
  { icon: 'description', label: t('feedback.previewFiles'), val: `${(props.report?.files.length ?? 0) + 1} ${t('feedback.previewFilesCount')}` },
])

const parsedFiles = computed(() => {
  if (!props.report) return []
  return props.report.files.map((f, i) => {
    const zip = f.name.match(/(\d{4}-\d{2}-\d{2})T(\d{2})[!:](\d{2})[!:](\d{2}).*?\.zip \((.*?)\)/)
    return {
      id: `file-${i}`,
      title: zip ? `${zip[1].slice(5)} ${zip[2]}:${zip[3]} · ${zip[5]}` : f.name,
      subtitle: zip ? `${zip[1]} ${zip[2]}:${zip[3]}:${zip[4]}` : (f.date || t('feedback.currentLogs')),
      icon: f.category === 'archive' ? 'folder_zip' : 'article',
      raw: f,
    }
  })
})

const historyDates = computed(() =>
  [...new Set(parsedFiles.value.map((f) => f.raw.date).filter((d): d is string => !!d && d !== todayStr.value))].sort().reverse(),
)

const catalogItems = computed(() => {
  const q = catalogSearch.value.trim().toLowerCase()
  const matchQ = (s: string) => !q || s.toLowerCase().includes(q)

  const list: Array<{ id: string; title: string; subtitle: string; icon: string; size?: number }> = []
  if (matchQ('device.json')) {
    list.push({ id: 'device', title: 'device.json', subtitle: t('feedback.previewDevice'), icon: 'settings_suggest' })
  }

  for (const f of parsedFiles.value) {
    const matchDate = selectedDate.value === 'all' ||
      (selectedDate.value === 'today' ? f.raw.category === 'current' || f.raw.date === todayStr.value : f.raw.date === selectedDate.value)
    if (matchDate && (matchQ(f.title) || matchQ(f.raw.name))) {
      list.push({ id: f.id, title: f.title, subtitle: f.subtitle, icon: f.icon, size: f.raw.size })
    }
  }
  return list
})

const activeFile = computed(() => parsedFiles.value.find((f) => f.id === selectedId.value)?.raw)
const activeItem = computed(() => catalogItems.value.find((item) => item.id === selectedId.value) || catalogItems.value[0])

const totalLines = computed(() => activeFile.value?.content.split('\n').length ?? 0)

const displayedLines = computed(() => {
  if (!activeFile.value) return []
  const lines = activeFile.value.content.split('\n')
  const q = lineSearch.value.trim().toLowerCase()
  return q ? lines.filter((l) => l.toLowerCase().includes(q)) : lines
})

const activeContent = computed(() => (selectedId.value === 'device' ? deviceJson.value : displayedLines.value.join('\n')))

watch(selectedId, () => { lineSearch.value = '' })

async function onClear() {
  clearing.value = true
  try {
    await clearLogs()
    emit('cleared')
    selectedId.value = 'device'
    notify({ level: 'success', title: t('feedback.logsCleared') })
  } finally {
    clearing.value = false
  }
}

async function copy(text: string) {
  if (!text) return
  await navigator.clipboard.writeText(text).catch(() => {})
  notify({ level: 'success', title: t('shared.copied') })
}
</script>

<style scoped>
pre::-webkit-scrollbar { width: 8px; height: 8px; }
pre::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }
</style>
