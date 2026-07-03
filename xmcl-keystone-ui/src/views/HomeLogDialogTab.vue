<template>
  <div class="min-h-[420px]">
    <Transition name="fade-transition" mode="out-in">
      <v-virtual-scroll
        v-if="content === '' && files.length !== 0"
        :key="0"
        class="visible-scroll v-list h-full max-h-[70vh] overflow-auto select-none"
        :bench="10"
        :items="files.map((name, index) => ({ name, id: `${name}-${index}` }))"
        :item-height="60"
      >
        <template #default="{ item }">
          <HomeLogDialogTabItem
            :source="item"
            :open-file="openFile"
            :remove-file="removeFile"
            :show-file="showFile"
            :disabled="pending"
          />
        </template>
      </v-virtual-scroll>
      <div v-else-if="content === '' && files.length === 0" :key="2" style="height: 420px">
        <div class="flex h-full items-center justify-center">
          <h1 v-if="!pending" class="opacity-60">
            {{ t('logsCrashes.placeholder') }}
          </h1>
          <v-progress-circular v-else :size="80" color="primary" indeterminate />
        </div>
      </div>
      <div
        v-else
        :key="1"
        class="log-viewer flex flex-col overflow-hidden"
      >
        <div class="log-viewer__header flex items-center gap-2 px-4 py-2">
          <v-btn
            v-shared-tooltip="() => t('shared.back')"
            icon="arrow_back"
            variant="text"
            size="small"
            @click="goBack"
          />
          <v-icon class="opacity-70">{{ log ? 'description' : 'bug_report' }}</v-icon>
          <span class="font-medium truncate flex-1">{{ showedFile }}</span>
          <v-btn
            v-shared-tooltip="() => copied ? t('shared.copied') : t('shared.copy')"
            :icon="copied ? 'check' : 'content_copy'"
            variant="text"
            size="small"
            :color="copied ? 'success' : undefined"
            @click="copyContent"
          />
        </div>
        <v-divider />
        <LogView v-if="log" class="visible-scroll max-h-[60vh] overflow-auto" :logs="logs" />
        <div v-else class="grid grid-cols-12 gap-4 p-4 h-[60vh] overflow-hidden">
          <pre
            class="visible-scroll surface-rounded-item col-span-12 lg:col-span-8 overflow-auto p-4 m-0 text-xs leading-relaxed log-pre min-w-0 min-h-0 max-h-full"
            >{{ content }}</pre
          >
          <div class="visible-scroll col-span-12 lg:col-span-4 min-w-0 min-h-0 max-h-full overflow-auto">
            <AppCrashAIHint :useCNAI="useCNAI" :getPrompt="getPrompt" :getAgentPrompt="getAgentPrompt" @close="hideDialog" />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { parseLog } from '@/util/log'
import LogView from '@/components/LogView.vue'
import HomeLogDialogTabItem from './HomeLogDialogTabItem.vue'
import AppCrashAIHint from '@/components/AppCrashAIHint.vue'
import { kEnvironment } from '@/composables/environment'
import { kInstance } from '@/composables/instance'
import { kSettingsState } from '@/composables/setting'
import { useDialog } from '@/composables/dialog'
import { getCrashPrompt, getCrashAgentPrompt, toVirtualInstancePath } from '@/util/crashPrompt'
import { injection } from '@/util/inject'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const props = defineProps<{
  files: string[]
  log?: boolean
  getFileContent(file: string): Promise<string>
  removeFile(file: string): Promise<void>
  showFile(file: string): void
  visible: boolean
  refreshing: boolean
}>()

const { t } = useI18n()
const { hide: hideDialog } = useDialog('log')
const { path } = injection(kInstance)
const content = ref('')
const loading = ref(false)
const showedFile = ref('')
const goBack = () => {
  content.value = ''
  showedFile.value = ''
}
const openFile = async (name: string) => {
  loading.value = true
  showedFile.value = name
  content.value = await props.getFileContent(name).finally(() => {
    loading.value = false
  })
}
const pending = computed(() => props.refreshing || loading.value)
const logs = computed(() => {
  const lines = content.value.split(/[\r?\n]/g)
  const logLines = [] as string[]
  for (const line of lines) {
    if (line.startsWith('[')) {
      logLines.push(line)
    } else {
      logLines[logLines.length - 1] += '\n' + line
    }
  }
  return logLines.map(parseLog)
})

const copied = ref(false)
function copyContent() {
  windowController.writeClipboard(content.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

const env = injection(kEnvironment)
const useCNAI = computed(() => {
  return env.value?.gfw || env.value?.region === 'zh-CN'
})

const { state } = injection(kSettingsState)
function getPrompt(raw?: boolean) {
  if (raw) {
    return content.value
  }
  return getCrashPrompt(useCNAI.value, content.value, '', state.value?.locale || 'en-US')
}
function getAgentPrompt() {
  const currentPath = showedFile.value || ''
  if (!currentPath) return getCrashAgentPrompt(content.value, '')

  const virtualDir = props.log
    ? 'logs'
    : currentPath.startsWith('xmcl-abnormal-exit-')
      ? 'launch-failures'
      : 'crash-reports'

  const currentFilePath = toVirtualInstancePath(`${path.value}/${currentPath}`, path.value)
  const virtualPath = currentFilePath === currentPath
    ? `${virtualDir}/${currentPath}`
    : currentFilePath

  return getCrashAgentPrompt(content.value, '', virtualPath)
}

watch(
  () => props.visible,
  (v) => {
    if (!v) {
      goBack()
    }
  },
)
</script>

<style scoped>
.log-viewer__header {
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.log-pre {
  background: rgba(var(--v-theme-on-surface), 0.05);
  white-space: pre-wrap;
  word-break: break-word;
}
.log-pre:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
</style>
