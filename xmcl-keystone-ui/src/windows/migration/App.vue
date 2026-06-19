<template>
  <v-app class="migration-app">
    <div class="migration-window">
      <header class="moveable title-bar">
        <div class="brand">
          <v-icon
            size="18"
            color="primary"
          >
            sync_alt
          </v-icon>
          <span>{{ t('migrationWindow.title') }}</span>
        </div>
        <v-spacer />
        <v-btn
          icon
          size="x-small"
          variant="text"
          class="non-moveable"
          @click="hide"
        >
          <v-icon size="18">close</v-icon>
        </v-btn>
      </header>

      <main class="migration-body">
        <template v-if="errorRef">
          <div class="status-icon error">
            <v-icon
              size="40"
              color="error"
            >
              error_outline
            </v-icon>
          </div>
          <h1 class="headline">
            {{ t('migrationWindow.error') }}
          </h1>
          <div class="paths">
            <span
              class="path-chip"
              :title="errorFile"
            >{{ errorFileName }}</span>
          </div>
          <pre class="error-detail">{{ errorMessage }}</pre>
        </template>

        <template v-else>
          <div
            class="status-icon"
            :class="{ done: isDone }"
          >
            <v-icon
              size="40"
              :color="isDone ? 'success' : 'primary'"
            >
              {{ isDone ? 'check_circle' : 'drive_file_move' }}
            </v-icon>
          </div>

          <h1 class="headline">
            {{ headline }}
          </h1>

          <div class="paths">
            <span
              class="path-chip"
              :title="fromPath"
            >{{ fromName }}</span>
            <v-icon
              size="16"
              class="path-arrow"
            >
              arrow_forward
            </v-icon>
            <span
              class="path-chip"
              :title="toPath"
            >{{ toName }}</span>
          </div>

          <div class="progress-block">
            <v-progress-linear
              :model-value="percent"
              :indeterminate="isScanning"
              :height="8"
              rounded
              color="primary"
              bg-opacity="0.15"
            />
            <div class="progress-meta">
              <span class="percent">
                {{ isScanning ? t('migrationWindow.scanning') : `${Math.floor(percent)}%` }}
              </span>
              <v-spacer />
              <span
                v-if="!isScanning"
                class="counts"
              >
                {{ copiedSize }} / {{ totalSize }}
                <template v-if="totalFiles"> · {{ copiedFiles }} / {{ totalFiles }} {{ t('migrationWindow.files') }}</template>
              </span>
            </div>
          </div>

          <div
            v-if="!isDone"
            class="current-file"
          >
            <v-icon
              size="14"
              class="current-file__icon"
            >
              {{ isScanning ? 'search' : 'description' }}
            </v-icon>
            <span class="current-file__name">{{ currentFileName || '—' }}</span>
            <span
              v-if="!isScanning && speed > 0"
              class="current-file__speed"
            >{{ speedText }}</span>
          </div>

          <div
            v-if="!isDone"
            class="warning"
          >
            <v-icon
              size="16"
              color="warning"
            >
              warning
            </v-icon>
            <span>{{ t('migrationWindow.warning') }}</span>
          </div>
        </template>
      </main>
    </div>
  </v-app>
</template>

<script lang="ts" setup>
import { Migration, MigrationProgress } from '@xmcl/runtime-api'
import { basename } from '@/util/basename'
import { getExpectedSize } from '@/util/size'
import '@/assets/common.css'

const { t } = useI18n()
const { hide } = windowController

declare const migration: Migration

const errorRef = ref<any | null>(null)
const errorFile = ref('')
const progressRef = shallowRef<MigrationProgress | undefined>(undefined)

// Smoothed copy speed (bytes/s). Sampled from the byte counter so the user can
// see throughput on slow cross-volume copies (the common pain point).
const speed = ref(0)
let lastSample: { time: number; bytes: number } | undefined

function sampleSpeed(p: MigrationProgress) {
  const now = Date.now()
  if (!lastSample || p.copiedBytes < lastSample.bytes) {
    lastSample = { time: now, bytes: p.copiedBytes }
    return
  }
  const dt = (now - lastSample.time) / 1000
  if (dt >= 0.25) {
    const inst = (p.copiedBytes - lastSample.bytes) / dt
    speed.value = speed.value ? speed.value * 0.6 + inst * 0.4 : inst
    lastSample = { time: now, bytes: p.copiedBytes }
  }
}

const phase = computed(() => progressRef.value?.phase ?? 'scanning')
const isScanning = computed(() => phase.value === 'scanning')
const isDone = computed(() => phase.value === 'done')

const percent = computed(() => {
  const p = progressRef.value
  if (!p || p.totalBytes <= 0) return 0
  return Math.min(100, (p.copiedBytes / p.totalBytes) * 100)
})

const fromPath = computed(() => progressRef.value?.from ?? '')
const toPath = computed(() => progressRef.value?.to ?? '')
const fromName = computed(() => (fromPath.value ? basename(fromPath.value) || fromPath.value : ''))
const toName = computed(() => (toPath.value ? basename(toPath.value) || toPath.value : ''))

const copiedFiles = computed(() => progressRef.value?.copiedFiles ?? 0)
const totalFiles = computed(() => progressRef.value?.totalFiles ?? 0)
const copiedSize = computed(() => getExpectedSize(progressRef.value?.copiedBytes ?? 0))
const totalSize = computed(() => getExpectedSize(progressRef.value?.totalBytes ?? 0))
const speedText = computed(() => `${getExpectedSize(speed.value)}/s`)
const currentFileName = computed(() => (progressRef.value?.file ? basename(progressRef.value.file) : ''))

const headline = computed(() => {
  if (isDone.value) return t('migrationWindow.done')
  if (isScanning.value) return t('migrationWindow.preparing')
  return t('migrationWindow.migrating')
})

const errorMessage = computed(() => {
  const e = errorRef.value
  if (!e) return ''
  return e.message || e.code || String(e)
})
const errorFileName = computed(() => (errorFile.value ? basename(errorFile.value) : ''))

onMounted(() => {
  migration.getProgress().then((progress) => {
    progressRef.value = progress
  })
  migration.on('progress', (payload) => {
    progressRef.value = payload
    sampleSpeed(payload)
  })
  migration.on('error', ({ file, error }) => {
    errorFile.value = file
    errorRef.value = error
  })
})
</script>

<style scoped>
.migration-app {
  height: 100%;
  max-height: 100vh;
  overflow: hidden;
}

.migration-window {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.title-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 8px 0 14px;
  flex: 0 0 auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  opacity: 0.9;
}

.migration-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 8px 32px 28px;
  text-align: center;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.12);
  animation: pulse 2.4s ease-in-out infinite;
}

.status-icon.done {
  background: rgba(var(--v-theme-success), 0.14);
  animation: none;
}

.status-icon.error {
  background: rgba(var(--v-theme-error), 0.14);
  animation: none;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0.18);
  }
  50% {
    transform: scale(1.04);
    box-shadow: 0 0 0 12px rgba(var(--v-theme-primary), 0);
  }
}

.headline {
  font-size: 19px;
  font-weight: 600;
  margin: 0;
}

.paths {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
}

.path-chip {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.path-arrow {
  opacity: 0.6;
  flex: 0 0 auto;
}

.progress-block {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-meta {
  display: flex;
  align-items: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.percent {
  font-weight: 600;
}

.counts {
  opacity: 0.7;
}

.current-file {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 420px;
  width: 100%;
  font-size: 12px;
  opacity: 0.8;
}

.current-file__icon {
  flex: 0 0 auto;
  opacity: 0.7;
}

.current-file__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 auto;
  text-align: left;
}

.current-file__speed {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.warning {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.4;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(var(--v-theme-warning), 0.1);
  color: rgba(var(--v-theme-warning), 0.95);
  max-width: 420px;
}

.error-detail {
  max-width: 420px;
  max-height: 120px;
  overflow: auto;
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(var(--v-theme-error), 0.08);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}
</style>

<style>
.moveable {
  -webkit-app-region: drag;
  user-select: none;
}

.non-moveable {
  -webkit-app-region: no-drag;
}
</style>
