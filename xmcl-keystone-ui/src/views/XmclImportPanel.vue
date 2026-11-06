<template>
  <div data-testid="xmcl-import-panel">
    <div class="flex items-center gap-2 font-medium">
      <v-icon size="small" color="primary">drive_file_move</v-icon>
      {{ t('setting.xmclImport.title') }}
    </div>
    <div class="mt-1 text-sm opacity-70">{{ t('setting.xmclImport.description') }}</div>

    <template v-if="phase === 'idle' && preview">
      <dl class="mt-3 text-sm" data-testid="xmcl-import-preview">
        <dt class="opacity-70">{{ t('setting.xmclImport.source') }}</dt>
        <dd class="break-all">{{ preview.sourceProfile }}</dd>
        <dt class="mt-1 opacity-70">{{ t('setting.xmclImport.gameRoot') }}</dt>
        <dd class="break-all">{{ preview.sourceRoot }}</dd>
        <dt class="mt-1 opacity-70">{{ t('setting.xmclImport.destination') }}</dt>
        <dd class="break-all">{{ preview.destination }}</dd>
      </dl>
      <div class="mt-2 text-sm">
        {{ t('setting.xmclImport.summary', { instances: preview.instances, accounts: preview.accounts, files: preview.files, size: getExpectedSize(preview.bytes) }) }}
      </div>
      <div class="mt-1 text-sm opacity-70">{{ t('setting.xmclImport.closeXmcl') }}</div>
    </template>

    <div v-else-if="phase === 'copying'" class="mt-3 text-sm">
      {{ t('setting.xmclImport.copying', { files: status?.copiedFiles ?? 0, total: status?.totalFiles ?? 0 }) }}
      <v-progress-linear class="mt-2" color="primary" :model-value="progress" />
    </div>

    <div v-else-if="message" class="mt-3 text-sm">{{ message }}</div>

    <div v-if="notFound" class="mt-3 text-sm">{{ t('setting.xmclImport.notFound') }}</div>
    <div v-if="error" class="mt-3 text-sm text-error" data-testid="xmcl-import-error">{{ error }}</div>

    <div class="mt-3 flex flex-wrap gap-2">
      <template v-if="phase === 'idle' && preview">
        <v-btn color="primary" :disabled="busy" data-testid="xmcl-import-start" @click="start">{{ t('setting.xmclImport.start') }}</v-btn>
        <v-btn variant="text" :disabled="busy" @click="preview = undefined">{{ t('setting.xmclImport.close') }}</v-btn>
      </template>
      <template v-else-if="phase === 'idle'">
        <v-btn color="primary" :loading="busy" data-testid="xmcl-import-preview-button" @click="load()">{{ t('setting.xmclImport.preview') }}</v-btn>
        <v-btn variant="text" :disabled="busy" @click="choose">{{ t('setting.xmclImport.choose') }}</v-btn>
      </template>
      <v-btn v-else-if="phase === 'copying'" variant="text" data-testid="xmcl-import-cancel" @click="cancel">{{ t('setting.xmclImport.cancel') }}</v-btn>
      <v-btn v-else-if="phase === 'cancelled' || phase === 'failed'" color="primary" :disabled="busy" data-testid="xmcl-import-retry" @click="start">{{ t('setting.xmclImport.retry') }}</v-btn>
      <v-btn v-else-if="phase === 'ready'" color="primary" :loading="busy" data-testid="xmcl-import-activate" @click="restartAfter(activate)">{{ t('setting.xmclImport.activate') }}</v-btn>
      <v-btn v-else-if="phase === 'applied'" variant="text" :loading="busy" data-testid="xmcl-import-undo" @click="restartAfter(rollback)">{{ t('setting.xmclImport.undo') }}</v-btn>
      <v-btn v-else-if="waitingForRestart" color="primary" :loading="busy" data-testid="xmcl-import-restart" @click="restartAfter()">{{ t('setting.xmclImport.restart') }}</v-btn>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { getExpectedSize } from '@/util/size'
import type { XmclImportPreview, XmclImportStatus } from '@xmcl/runtime-api'

const { t } = useI18n()
const { showOpenDialog } = windowController
const { cancel, activate, rollback } = bootstrap.xmclImport

const status = ref<XmclImportStatus>()
const preview = ref<XmclImportPreview>()
const notFound = ref(false)
const error = ref('')
const busy = ref(false)
const copying = ref(false)

const phase = computed(() => status.value?.phase ?? 'idle')
const waitingForRestart = computed(() => ['activate-pending', 'applying', 'rollback-pending'].includes(phase.value))
const progress = computed(() => {
  const { copiedBytes = 0, totalBytes = 0 } = status.value ?? {}
  return totalBytes ? copiedBytes / totalBytes * 100 : 0
})
const message = computed(() => {
  switch (phase.value) {
    case 'cancelled': return t('setting.xmclImport.cancelled')
    case 'failed': return t('setting.xmclImport.failed')
    case 'ready': return t('setting.xmclImport.ready')
    case 'applied': return t('setting.xmclImport.applied')
    case 'rolled-back': return t('setting.xmclImport.rolledBack')
    default: return waitingForRestart.value ? t('setting.xmclImport.pending') : ''
  }
})

async function refresh() {
  status.value = await bootstrap.xmclImport.status()
}

async function run(action: () => Promise<unknown>) {
  error.value = ''
  busy.value = true
  try {
    await action()
  } catch (e) {
    // Electron prefixes errors crossing IPC with the channel name.
    error.value = (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
  } finally {
    busy.value = false
    await refresh().catch(() => {})
  }
}

function load(source?: string) {
  notFound.value = false
  return run(async () => {
    preview.value = await bootstrap.xmclImport.preview(source)
    notFound.value = !preview.value
  })
}

async function choose() {
  const { filePaths } = await showOpenDialog({
    title: t('setting.xmclImport.choose'),
    properties: ['openDirectory'],
  })
  if (filePaths?.length) await load(filePaths[0])
}

async function start() {
  copying.value = true
  await run(() => bootstrap.xmclImport.copy())
  copying.value = false
}

function restartAfter(action?: () => Promise<void>) {
  return run(async () => {
    await action?.()
    await bootstrap.xmclImport.restart()
  })
}

// The copy outlives this view, so a reopened panel resumes showing its progress.
let timer: ReturnType<typeof setInterval> | undefined
watch(() => copying.value || phase.value === 'copying', (active) => {
  clearInterval(timer)
  if (active) timer = setInterval(() => { refresh().catch(() => {}) }, 500)
})
onUnmounted(() => clearInterval(timer))

refresh().catch(() => {})
</script>
