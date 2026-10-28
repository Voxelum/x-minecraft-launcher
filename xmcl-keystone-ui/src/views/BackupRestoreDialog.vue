<template>
  <v-dialog
    v-model="isShown"
    max-width="780"
    scrollable
    persistent
    transition="dialog-transition"
  >
    <v-card class="rounded-xl overflow-hidden backup-card">
      <v-toolbar color="surface" density="comfortable" class="px-5 border-b">
        <v-avatar size="32" :color="dialogMode === 'done' ? 'success' : 'primary'" class="mr-3" variant="tonal">
          <v-icon size="20">
            {{ dialogMode === 'done' ? 'check_circle' : dialogMode === 'working' ? 'sync' : 'unarchive' }}
          </v-icon>
        </v-avatar>
        <v-toolbar-title class="text-subtitle-1 font-weight-bold">
          {{ dialogMode === 'done' ? t('backup.restoreDone') : dialogMode === 'working' ? t('backup.restoringTitle') : t('backup.restoreTitle') }}
        </v-toolbar-title>
        <v-spacer />
        <v-btn
          v-if="dialogMode !== 'working'"
          icon
          variant="text"
          size="small"
          @click="hide"
        >
          <v-icon>close</v-icon>
        </v-btn>
      </v-toolbar>

      <!-- MODE 1: CONFIGURATION / FILE PICKING -->
      <v-card-text v-if="dialogMode === 'config'" class="pa-5 overflow-y-auto">
        <!-- Step 1: Pick File -->
        <div v-if="!manifest" class="d-flex flex-column align-center justify-center py-10 px-4">
          <v-avatar size="80" color="primary" variant="tonal" class="mb-4">
            <v-icon size="40">inventory_2</v-icon>
          </v-avatar>
          <div class="text-h6 font-weight-bold mb-1 text-center">
            {{ t('backup.selectBackupFilePrompt') }}
          </div>
          <div class="text-body-2 text-medium-emphasis mb-6 text-center" style="max-width: 480px;">
            {{ t('backup.selectBackupFileDescription') }}
          </div>
          <v-btn
            color="primary"
            size="large"
            variant="flat"
            class="px-8 font-weight-bold"
            :loading="isLoadingManifest"
            @click="browseBackupFile"
          >
            <v-icon start>file_open</v-icon>
            {{ t('backup.selectFile') }}
          </v-btn>
        </div>

        <!-- Step 2: Manifest Loaded -->
        <div v-else>
          <!-- Backup file details banner -->
          <v-card variant="tonal" color="primary" class="pa-4 mb-5 rounded-xl">
            <div class="d-flex align-center justify-space-between flex-wrap gap-2">
              <div class="d-flex align-center gap-3">
                <v-avatar size="38" color="primary" variant="tonal" rounded="lg">
                  <v-icon size="22">archive</v-icon>
                </v-avatar>
                <div>
                  <div class="text-subtitle-2 font-weight-bold">
                    {{ backupFileName }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ t('backup.createdOn', { date: formattedDate }) }} · XMCL v{{ manifest.appVersion }}
                  </div>
                </div>
              </div>
              <v-btn
                variant="outlined"
                size="small"
                class="text-none"
                @click="resetSelection"
              >
                <v-icon start size="small">swap_horiz</v-icon>
                {{ t('backup.changeFile') }}
              </v-btn>
            </div>
          </v-card>

          <!-- App Data to Restore -->
          <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-2 ml-1">
            {{ t('backup.dataToRestore') }}
          </div>
          <v-card variant="outlined" class="pa-3 mb-5 rounded-xl setting-group-card">
            <!-- Settings Tile -->
            <div
              v-if="manifest.includes.settings"
              class="d-flex align-center justify-space-between pa-2 rounded-lg cursor-pointer hover-surface"
              @click="restoreSettings = !restoreSettings"
            >
              <div class="d-flex align-center gap-3">
                <v-avatar size="36" color="indigo" variant="tonal" rounded="lg">
                  <v-icon size="20">settings</v-icon>
                </v-avatar>
                <div>
                  <div class="text-subtitle-2 font-weight-medium">{{ t('backup.restoreSettings') }}</div>
                  <div class="text-caption text-medium-emphasis">{{ t('backup.restoreSettingsHint') }}</div>
                </div>
              </div>
              <v-switch
                v-model="restoreSettings"
                color="primary"
                density="compact"
                hide-details
                class="ma-0"
                @click.stop
              />
            </div>

            <v-divider v-if="manifest.includes.settings && manifest.includes.collections" class="my-2" />

            <!-- Collections Tile -->
            <div
              v-if="manifest.includes.collections"
              class="d-flex align-center justify-space-between pa-2 rounded-lg cursor-pointer hover-surface"
              @click="restoreCollections = !restoreCollections"
            >
              <div class="d-flex align-center gap-3">
                <v-avatar size="36" color="amber-darken-2" variant="tonal" rounded="lg">
                  <v-icon size="20">folder_special</v-icon>
                </v-avatar>
                <div>
                  <div class="text-subtitle-2 font-weight-medium">{{ t('backup.restoreCollections') }}</div>
                  <div class="text-caption text-medium-emphasis">{{ t('backup.restoreCollectionsHint') }}</div>
                </div>
              </div>
              <v-switch
                v-model="restoreCollections"
                color="primary"
                density="compact"
                hide-details
                class="ma-0"
                @click.stop
              />
            </div>

            <v-divider v-if="manifest.includes.themes && (manifest.includes.settings || manifest.includes.collections)" class="my-2" />

            <!-- Themes Tile -->
            <div
              v-if="manifest.includes.themes"
              class="d-flex align-center justify-space-between pa-2 rounded-lg cursor-pointer hover-surface"
              @click="restoreThemes = !restoreThemes"
            >
              <div class="d-flex align-center gap-3">
                <v-avatar size="36" color="purple" variant="tonal" rounded="lg">
                  <v-icon size="20">palette</v-icon>
                </v-avatar>
                <div>
                  <div class="text-subtitle-2 font-weight-medium">{{ t('backup.restoreThemes') }}</div>
                  <div class="text-caption text-medium-emphasis">{{ t('backup.restoreThemesHint') }}</div>
                </div>
              </div>
              <v-switch
                v-model="restoreThemes"
                color="primary"
                density="compact"
                hide-details
                class="ma-0"
                @click.stop
              />
            </div>

            <div
              v-if="!manifest.includes.settings && !manifest.includes.collections && !manifest.includes.themes"
              class="text-caption text-medium-emphasis py-2 px-1"
            >
              {{ t('backup.noLauncherDataInBackup') }}
            </div>
          </v-card>

          <!-- Instances to Restore -->
          <div v-if="manifest.includes.instances.length > 0">
            <div class="d-flex align-center justify-space-between mb-2 ml-1">
              <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
                {{ t('backup.instances') }} ({{ selectedInstances.length }}/{{ manifest.includes.instances.length }})
              </div>
              <div class="d-flex gap-2">
                <v-btn
                  variant="text"
                  size="x-small"
                  color="primary"
                  class="text-none font-weight-medium"
                  @click="selectAllInstances"
                >
                  {{ t('backup.selectAll') }}
                </v-btn>
                <v-btn
                  variant="text"
                  size="x-small"
                  class="text-none"
                  @click="deselectAllInstances"
                >
                  {{ t('backup.deselectAll') }}
                </v-btn>
              </div>
            </div>

            <!-- Instances List -->
            <v-list
              density="compact"
              class="border rounded-xl pa-1 mb-4 overflow-y-auto instance-list-container"
              max-height="220"
            >
              <v-list-item
                v-for="inst in manifest.includes.instances"
                :key="inst.folderName"
                density="comfortable"
                class="rounded-lg mb-1 px-3 cursor-pointer"
                :class="{ 'selected-instance-row': selectedInstances.includes(inst.folderName) }"
                @click="toggleInstance(inst.folderName)"
              >
                <template #prepend>
                  <v-checkbox-btn
                    :model-value="selectedInstances.includes(inst.folderName)"
                    color="primary"
                    class="mr-2"
                    @click.stop="toggleInstance(inst.folderName)"
                  />
                  <v-avatar size="32" rounded="md" class="mr-3 border">
                    <v-img :src="BuiltinImages.craftingTable" cover />
                  </v-avatar>
                </template>

                <v-list-item-title class="text-body-2 font-weight-medium">
                  {{ inst.name }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption d-flex align-center gap-1 mt-1">
                  <v-chip v-if="inst.mcVersion" size="x-small" variant="flat" color="surface-variant" class="px-2 font-weight-medium">
                    {{ inst.mcVersion }}
                  </v-chip>
                  <v-chip v-if="inst.loader" size="x-small" variant="tonal" color="blue" class="px-2">
                    {{ inst.loader }}
                  </v-chip>
                  <v-chip v-if="inst.modsCount" size="x-small" variant="tonal" color="teal" class="px-2">
                    {{ inst.modsCount }} mods
                  </v-chip>
                  <v-chip v-if="inst.modListOnly" size="x-small" variant="outlined" color="medium-emphasis" class="px-2">
                    {{ t('backup.modsListOnly') }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <!-- Conflict Strategy -->
            <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-2 ml-1">
              {{ t('backup.conflictStrategyTitle') }}
            </div>
            <v-card variant="outlined" class="pa-3 mb-2 rounded-xl setting-group-card">
              <v-radio-group
                v-model="conflictStrategy"
                density="compact"
                class="mt-0"
                hide-details
              >
                <v-radio
                  value="rename"
                  :label="t('backup.conflictRename')"
                  color="primary"
                  density="compact"
                />
                <v-radio
                  value="overwrite"
                  :label="t('backup.conflictOverwrite')"
                  color="primary"
                  density="compact"
                />
                <v-radio
                  value="skip"
                  :label="t('backup.conflictSkip')"
                  color="primary"
                  density="compact"
                />
              </v-radio-group>
            </v-card>
          </div>
        </div>
      </v-card-text>

      <!-- MODE 2: ACTIVE WORKING / PROGRESS SCREEN -->
      <v-card-text v-else-if="dialogMode === 'working'" class="pa-6 overflow-y-auto">
        <v-card variant="tonal" color="primary" class="pa-5 mb-5 rounded-xl border-primary">
          <div class="d-flex align-center justify-space-between mb-3">
            <div class="d-flex align-center gap-3">
              <v-progress-circular indeterminate size="24" width="3" color="primary" />
              <div>
                <div class="text-subtitle-1 font-weight-bold">
                  {{ restoreProgress?.message || t('backup.preparing') }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ t('backup.stageLabel', { stage: currentStageLabel }) }}
                </div>
              </div>
            </div>
            <div class="text-h4 font-weight-black text-primary">
              {{ restoreProgress?.percent ?? 0 }}%
            </div>
          </div>

          <v-progress-linear
            :model-value="restoreProgress?.percent ?? 0"
            color="primary"
            height="10"
            rounded
            stream
            class="rounded-pill mb-4"
          />

          <!-- Statistics Row -->
          <div class="d-flex justify-space-between flex-wrap gap-4 pt-2 border-t text-caption">
            <div class="d-flex align-center gap-2">
              <v-icon size="small" color="primary">schedule</v-icon>
              <span>{{ t('backup.elapsedTime') }}: <strong>{{ elapsedFormatted }}</strong></span>
            </div>
            <div class="d-flex align-center gap-2">
              <v-icon size="small" color="secondary">hourglass_top</v-icon>
              <span>{{ t('backup.remainingTime') }}: <strong>{{ remainingFormatted }}</strong></span>
            </div>
            <div class="d-flex align-center gap-2">
              <v-icon size="small" color="info">layers</v-icon>
              <span>{{ t('backup.instances') }}: <strong>{{ currentInstanceIndexLabel }}</strong></span>
            </div>
          </div>
        </v-card>

        <!-- Live Activity Log Console -->
        <div class="d-flex align-center justify-space-between mb-2">
          <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis d-flex align-center gap-2">
            <v-icon size="small">terminal</v-icon>
            {{ t('backup.activityLog') }} ({{ logEntries.length }})
          </div>
          <v-btn
            variant="text"
            size="x-small"
            class="text-none"
            prepend-icon="content_copy"
            @click="copyLogToClipboard"
          >
            {{ t('backup.copyLog') }}
          </v-btn>
        </div>

        <v-card
          ref="logContainerRef"
          variant="outlined"
          class="pa-3 rounded-xl terminal-card overflow-y-auto"
          max-height="240"
        >
          <div
            v-for="entry in logEntries"
            :key="entry.id"
            class="terminal-line mb-1"
            :class="`terminal-${entry.level}`"
          >
            <span class="terminal-time opacity-50 mr-2">[{{ entry.time }}]</span>
            <span class="terminal-text">{{ entry.message }}</span>
          </div>
        </v-card>
      </v-card-text>

      <!-- MODE 3: COMPLETION / SUMMARY SCREEN -->
      <v-card-text v-else-if="dialogMode === 'done'" class="pa-6 overflow-y-auto">
        <div class="d-flex flex-column align-center justify-center py-4 mb-4">
          <v-avatar size="72" color="success" variant="tonal" class="mb-3">
            <v-icon size="42">check_circle</v-icon>
          </v-avatar>
          <div class="text-h6 font-weight-bold text-center mb-1">
            {{ t('backup.restoreDone') }}
          </div>
          <div class="text-body-2 text-medium-emphasis text-center" style="max-width: 480px;">
            {{ t('backup.restoreDoneHint') }}
          </div>
        </div>

        <!-- Summary Details Card -->
        <v-card variant="outlined" class="pa-4 mb-5 rounded-xl setting-group-card">
          <div class="d-flex align-center justify-space-between py-1 border-b">
            <span class="text-caption text-medium-emphasis">{{ t('backup.timeTaken', { time: '' }) }}</span>
            <span class="text-caption font-weight-bold">{{ elapsedFormatted }}</span>
          </div>
          <div class="d-flex align-center justify-space-between py-1">
            <span class="text-caption text-medium-emphasis">{{ t('backup.instances') }}</span>
            <span class="text-caption font-weight-bold">{{ selectedInstances.length }}</span>
          </div>
        </v-card>

        <!-- Collapsible Activity Log -->
        <div class="d-flex align-center justify-space-between mb-2">
          <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis d-flex align-center gap-2">
            <v-icon size="small">terminal</v-icon>
            {{ t('backup.activityLog') }}
          </div>
          <v-btn
            variant="text"
            size="x-small"
            class="text-none"
            prepend-icon="content_copy"
            @click="copyLogToClipboard"
          >
            {{ t('backup.copyLog') }}
          </v-btn>
        </div>

        <v-card
          variant="outlined"
          class="pa-3 rounded-xl terminal-card overflow-y-auto"
          max-height="160"
        >
          <div
            v-for="entry in logEntries"
            :key="entry.id"
            class="terminal-line mb-1"
            :class="`terminal-${entry.level}`"
          >
            <span class="terminal-time opacity-50 mr-2">[{{ entry.time }}]</span>
            <span class="terminal-text">{{ entry.message }}</span>
          </div>
        </v-card>
      </v-card-text>

      <v-divider />

      <!-- Action Buttons Footer -->
      <v-card-actions class="pa-4 px-5">
        <!-- Mode: Config Buttons -->
        <template v-if="dialogMode === 'config'">
          <v-btn variant="text" :disabled="isRestoring" @click="hide">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn
            v-if="manifest"
            color="primary"
            variant="flat"
            class="px-6 font-weight-bold"
            :disabled="!canRestore"
            @click="startRestore"
          >
            <template #prepend>
              <v-icon>unarchive</v-icon>
            </template>
            {{ t('backup.restore') }}
          </v-btn>
        </template>

        <!-- Mode: Working Buttons -->
        <template v-else-if="dialogMode === 'working'">
          <div class="text-caption text-medium-emphasis d-flex align-center gap-2">
            <v-progress-circular indeterminate size="16" width="2" color="primary" />
            <span>{{ t('backup.restoringTitle') }}</span>
          </div>
          <v-spacer />
        </template>

        <!-- Mode: Done Buttons -->
        <template v-else-if="dialogMode === 'done'">
          <v-spacer />
          <v-btn
            color="primary"
            variant="flat"
            class="px-6 font-weight-bold"
            @click="hide"
          >
            {{ t('backup.done') }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBackup } from '@/composables/backup'
import { useDialog } from '@/composables/dialog'
import { BuiltinImages } from '@/constant'
import { useNotifier } from '@/composables/notifier'
import type { BackupManifest, RestoreBackupOptions } from '@xmcl/runtime-api'

interface LogEntry {
  id: number
  time: string
  message: string
  level: 'info' | 'success' | 'warn'
}

const { t } = useI18n()
const { isShown, hide } = useDialog('backup-restore')
const { restoreBackup, loadBackupManifest, isRestoring, isLoadingManifest, restoreProgress } = useBackup()
const { notify } = useNotifier()

const dialogMode = ref<'config' | 'working' | 'done'>('config')

const backupFilePath = ref('')
const manifest = ref<BackupManifest | null>(null)

const restoreSettings = ref(true)
const restoreCollections = ref(true)
const restoreThemes = ref(true)
const selectedInstances = ref<string[]>([])
const conflictStrategy = ref<'rename' | 'overwrite' | 'skip'>('rename')

// Progress & Timer state
const elapsedSeconds = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

const logEntries = ref<LogEntry[]>([])
let logSeq = 0
const logContainerRef = ref<any>(null)

function addLog(message: string, level: 'info' | 'success' | 'warn' = 'info') {
  const time = new Date().toLocaleTimeString()
  logEntries.value.push({
    id: ++logSeq,
    time,
    message,
    level,
  })
  nextTick(() => {
    if (logContainerRef.value?.$el) {
      logContainerRef.value.$el.scrollTop = logContainerRef.value.$el.scrollHeight
    }
  })
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const elapsedFormatted = computed(() => formatDuration(elapsedSeconds.value))

const remainingFormatted = computed(() => {
  const p = restoreProgress.value?.percent ?? 0
  if (p <= 4) return t('backup.calculatingRemaining')
  if (p >= 100) return '00:00'
  const totalSec = elapsedSeconds.value / (p / 100)
  const remain = Math.max(0, Math.round(totalSec - elapsedSeconds.value))
  return formatDuration(remain)
})

const currentStageLabel = computed(() => {
  const phase = restoreProgress.value?.phase
  if (phase === 'settings') return t('backup.stageSettings')
  if (phase === 'collections') return t('backup.stageCollections')
  if (phase === 'themes') return t('backup.stageThemes')
  if (phase === 'instances') return t('backup.stageInstances')
  if (phase === 'complete') return t('backup.stageComplete')
  return t('backup.stagePreparing')
})

const currentInstanceIndexLabel = computed(() => {
  if (restoreProgress.value?.currentInstanceIndex && restoreProgress.value?.totalInstances) {
    return `${restoreProgress.value.currentInstanceIndex}/${restoreProgress.value.totalInstances}`
  }
  return `${selectedInstances.value.length}`
})

// Listen to progress updates to log messages
watch(() => restoreProgress.value?.message, (msg) => {
  if (msg && dialogMode.value === 'working') {
    const isComplete = restoreProgress.value?.phase === 'complete'
    addLog(msg, isComplete ? 'success' : 'info')
  }
})

const backupFileName = computed(() => {
  if (!backupFilePath.value) return ''
  const parts = backupFilePath.value.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1]
})

const formattedDate = computed(() => {
  if (!manifest.value?.createdAt) return ''
  return new Date(manifest.value.createdAt).toLocaleString()
})

watch(isShown, (shown) => {
  if (shown) {
    dialogMode.value = 'config'
    logEntries.value = []
    elapsedSeconds.value = 0
  } else {
    stopTimer()
  }
})

onUnmounted(() => {
  stopTimer()
})

function startTimer() {
  stopTimer()
  elapsedSeconds.value = 0
  timerInterval = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function resetSelection() {
  manifest.value = null
  backupFilePath.value = ''
  selectedInstances.value = []
}

async function browseBackupFile() {
  const { filePaths, canceled } = await windowController.showOpenDialog({
    title: t('backup.selectBackupFileTitle'),
    filters: [
      {
        name: t('backup.fileFilterName'),
        extensions: ['xmclbackup', 'zip'],
      },
    ],
  })

  if (canceled || !filePaths || filePaths.length === 0) return

  const path = filePaths[0]
  try {
    const loadedManifest = await loadBackupManifest(path)
    backupFilePath.value = path
    manifest.value = loadedManifest

    // Set initial toggles
    restoreSettings.value = !!loadedManifest.includes.settings
    restoreCollections.value = !!loadedManifest.includes.collections
    restoreThemes.value = !!loadedManifest.includes.themes
    selectedInstances.value = loadedManifest.includes.instances.map((i) => i.folderName)
  } catch {
    // Error is toasted by composable
  }
}

function selectAllInstances() {
  if (!manifest.value) return
  selectedInstances.value = manifest.value.includes.instances.map((i) => i.folderName)
}

function deselectAllInstances() {
  selectedInstances.value = []
}

function toggleInstance(folderName: string) {
  const idx = selectedInstances.value.indexOf(folderName)
  if (idx === -1) {
    selectedInstances.value.push(folderName)
  } else {
    selectedInstances.value.splice(idx, 1)
  }
}

const canRestore = computed(() => {
  if (!manifest.value) return false
  return (
    (restoreSettings.value && manifest.value.includes.settings) ||
    (restoreCollections.value && manifest.value.includes.collections) ||
    (restoreThemes.value && manifest.value.includes.themes) ||
    selectedInstances.value.length > 0
  )
})

function copyLogToClipboard() {
  const text = logEntries.value.map((e) => `[${e.time}] ${e.message}`).join('\n')
  navigator.clipboard.writeText(text).then(() => {
    notify({
      level: 'info',
      title: t('backup.copiedLog'),
    })
  })
}

async function startRestore() {
  if (!backupFilePath.value || !manifest.value) return

  dialogMode.value = 'working'
  logEntries.value = []
  startTimer()
  addLog(t('backup.preparing'), 'info')
  addLog(`Reading ${backupFilePath.value}`, 'info')

  const options: RestoreBackupOptions = {
    backupPath: backupFilePath.value,
    restoreSettings: restoreSettings.value && manifest.value.includes.settings,
    restoreCollections: restoreCollections.value && manifest.value.includes.collections,
    restoreThemes: restoreThemes.value && manifest.value.includes.themes,
    instances: selectedInstances.value,
    instanceConflictStrategy: conflictStrategy.value,
  }

  try {
    await restoreBackup(options)
    stopTimer()
    addLog(t('backup.restoreDone'), 'success')
    dialogMode.value = 'done'
  } catch (err: any) {
    stopTimer()
    addLog(err?.message || String(err), 'warn')
    dialogMode.value = 'config'
  }
}
</script>

<style scoped>
.gap-1 {
  gap: 4px;
}
.gap-2 {
  gap: 8px;
}
.gap-3 {
  gap: 12px;
}
.gap-4 {
  gap: 16px;
}
.hover-surface {
  transition: background-color 0.2s ease;
}
.hover-surface:hover {
  background-color: rgba(255, 255, 255, 0.04);
}
.setting-group-card {
  background-color: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.08) !important;
}
.instance-list-container {
  background-color: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.08) !important;
}
.selected-instance-row {
  background-color: rgba(var(--v-theme-primary), 0.06);
}
.terminal-card {
  background-color: #0d1117 !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
}
.terminal-line {
  word-break: break-all;
}
.terminal-info .terminal-text {
  color: #c9d1d9;
}
.terminal-success .terminal-text {
  color: #3fb950;
  font-weight: 600;
}
.terminal-warn .terminal-text {
  color: #f85149;
}
</style>
