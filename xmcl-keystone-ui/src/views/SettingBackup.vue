<template>
  <SettingCard>
    <!-- Create Backup Section -->
    <SettingSubheader :title="t('setting.createBackup')" />
    
    <SettingItemCheckbox
      v-model="includeInstances"
      :title="t('setting.includeInstances')"
      :description="t('setting.includeInstancesDesc')"
    />

    <v-divider class="my-2" />

    <SettingItemCheckbox
      v-model="includeSettings"
      :title="t('setting.includeSettings')"
      :description="t('setting.includeSettingsDesc')"
    />

    <v-divider class="my-2" />

    <SettingItemCheckbox
      v-model="includeScreenshots"
      :title="t('setting.includeScreenshots')"
      :description="t('setting.includeScreenshotsDesc')"
    />

    <v-divider class="my-2" />

    <SettingItem :title="t('setting.createBackup')">
      <template #action>
        <v-btn
          color="primary"
          :loading="creatingBackup"
          :disabled="creatingBackup"
          @click="onCreateBackup"
        >
          <v-icon start size="small">backup</v-icon>
          {{ t('setting.createBackup') }}
        </v-btn>
      </template>
    </SettingItem>

    <v-divider class="my-4" />

    <!-- Restore Backup Section -->
    <SettingSubheader :title="t('setting.restoreBackup')" />

    <SettingItem :title="t('setting.selectBackupFile')" :description="t('setting.selectBackupFileHint')">
      <template #action>
        <v-btn
          color="primary"
          :loading="restoringBackup"
          :disabled="restoringBackup"
          @click="onRestoreBackup"
        >
          <v-icon start size="small">restore</v-icon>
          {{ t('setting.restoreBackup') }}
        </v-btn>
      </template>
    </SettingItem>

    <!-- Backup Progress Dialog -->
    <v-dialog v-model="showBackupProgress" persistent max-width="800">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon start color="primary">backup</v-icon>
          {{ t('setting.backupProgress') }}
          <v-spacer />
          <span v-if="backupTask && backupTask.type === 'createBackup'" class="text-h6">
            {{ Math.round(backupProgressPercent) }}%
          </span>
        </v-card-title>
        <v-card-text>
          <div v-if="backupTask && backupTask.type === 'createBackup'">
            <!-- Phase and Progress -->
            <div class="mb-4">
              <div class="d-flex justify-space-between align-center mb-2">
                <div class="text-subtitle-2">
                  {{ getPhaseText(backupTask.phase) }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ estimatedTimeRemaining }}
                </div>
              </div>
              <v-progress-linear
                :model-value="backupProgressPercent"
                :indeterminate="backupTotal === -1"
                color="primary"
                height="12"
                rounded
              >
                <template #default>
                  <strong class="text-caption">{{ Math.round(backupProgressPercent) }}%</strong>
                </template>
              </v-progress-linear>
            </div>

            <!-- Files Progress -->
            <div v-if="backupTask.totalFiles && backupTask.copiedFiles" class="mb-3">
              <div class="d-flex justify-space-between text-body-2 mb-1">
                <span>{{ t('setting.backupFilesProgress', { copied: backupTask.copiedFiles, total: backupTask.totalFiles }) }}</span>
                <span v-if="backupTask.phase === 'creating-archive' && backupTask.processedBytes && backupTask.totalBytes" class="text-medium-emphasis">
                  {{ formatBytes(backupTask.processedBytes) }} / {{ formatBytes(backupTask.totalBytes) }}
                </span>
              </div>
              <div class="text-caption text-medium-emphasis">
                <span v-if="backupTask.phase === 'creating-archive' && backupTask.entriesProcessed">
                  {{ t('setting.backupArchivingEntries', { count: backupTask.entriesProcessed }) }}
                </span>
                <span v-else>
                  {{ t('setting.backupCurrentFile') }}: {{ backupTask.currentFile || '...' }}
                </span>
              </div>
            </div>

            <v-divider class="my-3" />

            <!-- Logs Section -->
            <div>
              <div class="text-subtitle-2 mb-2 d-flex align-center">
                <v-icon start size="small">description</v-icon>
                {{ t('setting.backupLog') }}
              </div>
              <v-card variant="outlined" class="log-container" max-height="200">
                <v-card-text class="pa-2">
                  <div v-if="backupTask.logs && backupTask.logs.length > 0" class="log-entries">
                    <div
                      v-for="(log, index) in backupTask.logs.slice(-10)"
                      :key="index"
                      class="log-entry text-caption"
                      :class="`log-${log.type}`"
                    >
                      <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
                      <span class="log-message">{{ log.message }}</span>
                    </div>
                  </div>
                  <div v-else class="text-caption text-medium-emphasis">
                    {{ t('setting.backupNoLogs') }}
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            :disabled="backupTask?.type === 'createBackup' && backupTask.phase === 'finalizing'"
            @click="onCancelBackup"
          >
            {{ t('setting.cancelBackup') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Backup Complete Dialog -->
    <v-dialog v-model="showBackupComplete" max-width="500">
      <v-card>
        <v-card-title>
          <v-icon start color="success">check_circle</v-icon>
          {{ t('setting.backupCompleteTitle') }}
        </v-card-title>
        <v-card-text>
          <p>{{ t('setting.backupCompleteMessage') }}</p>
          <p class="text-caption">{{ t('setting.backupCompleteHint') }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="showBackupComplete = false">
            {{ t('shared.ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Restore Warning Dialog -->
    <v-dialog v-model="showRestoreWarning" max-width="700" scrollable>
      <v-card>
        <v-card-title>
          <v-icon start color="warning">warning</v-icon>
          {{ t('setting.restoreBackup') }}
        </v-card-title>
        <v-card-text>
          <!-- Backup Info -->
          <div v-if="selectedBackupInfo" class="mb-4">
            <div class="text-subtitle-2 mb-2">{{ t('setting.backupInfo') }}</div>
            <v-row dense>
              <v-col cols="12" sm="4">
                <div class="text-caption text-medium-emphasis">{{ t('setting.backupInstances', { count: selectedBackupInfo.instanceCount }) }}</div>
              </v-col>
              <v-col cols="12" sm="4">
                <div class="text-caption text-medium-emphasis">{{ t('setting.backupCreated', { date: formatDate(selectedBackupInfo.createdAt) }) }}</div>
              </v-col>
              <v-col cols="12" sm="4">
                <div class="text-caption text-medium-emphasis">{{ t('setting.backupSize', { size: formatSize(selectedBackupInfo.size) }) }}</div>
              </v-col>
            </v-row>
          </div>

          <v-divider class="my-3" />

          <!-- What to restore -->
          <div class="text-subtitle-2 mb-3">{{ t('setting.restoreSelectContent') }}</div>
          <SettingItemCheckbox
            v-model="restoreInstances"
            :title="t('setting.includeInstances')"
            :description="t('setting.includeInstancesDesc')"
          />

          <!-- Skip existing instances option -->
          <v-expand-transition>
            <div v-if="restoreInstances" class="pl-4 mt-2 mb-2">
              <SettingItemCheckbox
                v-model="skipExistingInstances"
                :title="t('setting.skipExistingInstances')"
                :description="t('setting.skipExistingInstancesDesc')"
              />
              <!-- Show list of instances in backup -->
              <div v-if="selectedBackupInfo?.instances?.length" class="mt-2">
                <div class="text-caption text-medium-emphasis mb-1">{{ t('setting.backupContainsInstances') }}:</div>
                <div class="d-flex flex-wrap gap-1">
                  <v-chip
                    v-for="name in selectedBackupInfo.instances"
                    :key="name"
                    size="x-small"
                    :color="existingInstanceNames.has(name) ? 'warning' : 'success'"
                    :title="existingInstanceNames.has(name) ? t('setting.instanceAlreadyExists') : t('setting.instanceNew')"
                  >
                    <v-icon start size="10">
                      {{ existingInstanceNames.has(name) ? 'info' : 'add_circle' }}
                    </v-icon>
                    {{ name }}
                  </v-chip>
                </div>
                <div class="text-caption text-medium-emphasis mt-1">
                  <v-icon size="10" color="warning">info</v-icon> {{ t('setting.instanceAlreadyExists') }} &nbsp;
                  <v-icon size="10" color="success">add_circle</v-icon> {{ t('setting.instanceNew') }}
                </div>
              </div>
            </div>
          </v-expand-transition>

          <v-divider class="my-2" />

          <SettingItemCheckbox
            v-model="restoreSettings"
            :title="t('setting.includeSettings')"
            :description="t('setting.includeSettingsDesc')"
          />

          <v-divider class="my-2" />

          <SettingItemCheckbox
            v-model="restoreScreenshots"
            :title="t('setting.includeScreenshots')"
            :description="t('setting.includeScreenshotsDesc')"
          />

          <v-divider class="my-3" />

          <v-alert type="warning" variant="tonal">
            {{ t('setting.restoreWarning') }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showRestoreWarning = false">{{ t('shared.cancel') }}</v-btn>
          <v-btn
            color="warning"
            :disabled="!restoreInstances && !restoreSettings && !restoreScreenshots"
            @click="confirmRestore"
          >
            {{ t('setting.restoreBackup') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Restore Complete Dialog -->
    <v-dialog v-model="showRestoreComplete" max-width="500">
      <v-card>
        <v-card-title>
          <v-icon start color="success">check_circle</v-icon>
          {{ t('setting.restoreComplete') }}
        </v-card-title>
        <v-card-text>
          <p>{{ t('setting.restoreCompleteMessage') }}</p>
          <p class="text-caption">{{ t('setting.restoreRestartHint') }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="showRestoreComplete = false">
            {{ t('shared.ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Restore Progress Dialog -->
    <v-dialog v-model="showRestoreProgress" persistent max-width="800">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon start color="primary">restore</v-icon>
          {{ t('setting.restoreBackup') }}
          <v-spacer />
          <span v-if="restoreTask && restoreTask.type === 'restoreBackup'" class="text-h6">
            {{ Math.round(restoreProgressPercent) }}%
          </span>
        </v-card-title>
        <v-card-text>
          <div v-if="restoreTask && restoreTask.type === 'restoreBackup'">
            <!-- Phase and Progress -->
            <div class="mb-4">
              <div class="d-flex justify-space-between align-center mb-2">
                <div class="text-subtitle-2">
                  {{ getRestorePhaseText(restoreTask.phase) }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ restoreEstimatedTimeRemaining }}
                </div>
              </div>
              <v-progress-linear
                :model-value="restoreProgressPercent"
                :indeterminate="restoreTotal === -1 || restoreTask.phase === 'extracting'"
                color="primary"
                height="12"
                rounded
              >
                <template #default>
                  <strong v-if="restoreTask.phase !== 'extracting'" class="text-caption">
                    {{ Math.round(restoreProgressPercent) }}%
                  </strong>
                </template>
              </v-progress-linear>
            </div>

            <!-- Files Progress -->
            <div v-if="restoreTask.totalFiles && restoreTask.copiedFiles" class="mb-3">
              <div class="d-flex justify-space-between text-body-2 mb-1">
                <span>{{ t('setting.backupFilesProgress', { copied: restoreTask.copiedFiles, total: restoreTask.totalFiles }) }}</span>
              </div>
              <div v-if="restoreTask.currentFile" class="text-caption text-medium-emphasis">
                {{ t('setting.backupCurrentFile') }}: {{ restoreTask.currentFile }}
              </div>
            </div>

            <!-- Scanned instances (shown during scanning phase) -->
            <div v-if="restoreTask.phase === 'scanning' && restoreTask.scannedInstances?.length" class="mb-3">
              <div class="text-caption text-medium-emphasis mb-1">{{ t('setting.restoreFoundInstances') }}:</div>
              <div class="d-flex flex-wrap gap-1">
                <v-chip v-for="name in restoreTask.scannedInstances" :key="name" size="x-small" color="primary">
                  {{ name }}
                </v-chip>
              </div>
            </div>

            <!-- Skipped instances (shown during/after restoring-instances) -->
            <div v-if="restoreTask.skippedInstances?.length" class="mb-3">
              <div class="text-caption text-medium-emphasis mb-1">{{ t('setting.restoreSkippedInstances') }}:</div>
              <div class="d-flex flex-wrap gap-1">
                <v-chip v-for="name in restoreTask.skippedInstances" :key="name" size="x-small" color="warning">
                  <v-icon start size="10">skip_next</v-icon>
                  {{ name }}
                </v-chip>
              </div>
            </div>

            <v-divider class="my-3" />

            <!-- Logs -->
            <div>
              <div class="text-subtitle-2 mb-2 d-flex align-center">
                <v-icon start size="small">description</v-icon>
                {{ t('setting.backupLog') }}
              </div>
              <v-card variant="outlined" class="log-container" max-height="200">
                <v-card-text class="pa-2">
                  <div v-if="restoreTask.logs && restoreTask.logs.length > 0" class="log-entries">
                    <div
                      v-for="(log, index) in restoreTask.logs.slice(-10)"
                      :key="index"
                      class="log-entry text-caption"
                      :class="`log-${log.type}`"
                    >
                      <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
                      <span class="log-message">{{ log.message }}</span>
                    </div>
                  </div>
                  <div v-else class="text-caption text-medium-emphasis">
                    {{ t('setting.backupNoLogs') }}
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </div>

          <!-- Fallback spinner while task hasn't started yet -->
          <div v-else class="text-center py-4">
            <v-progress-circular indeterminate color="primary" size="48" class="mb-3" />
            <div class="text-body-2">{{ t('setting.restoringBackup') }}</div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </SettingCard>
</template>

<script lang="ts" setup>
import { BackupServiceKey, CreateBackupTask, RestoreBackupTask, BaseServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'
import { useTask } from '@/composables/task'
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import SettingSubheader from '@/components/SettingSubheader.vue'
import { useNotifier } from '@/composables/notifier'
import { injection } from '@/util/inject'
import { kSettingsState } from '@/composables/setting'

const { t } = useI18n()
const { notify } = useNotifier()

// Backup options
const includeInstances = ref(true)
const includeSettings = ref(true)
const includeScreenshots = ref(false)

// State
const creatingBackup = ref(false)
const restoringBackup = ref(false)
const showBackupProgress = ref(false)
const showBackupComplete = ref(false)
const showRestoreWarning = ref(false)
const showRestoreComplete = ref(false)
const showRestoreProgress = ref(false)
const selectedBackupPath = ref('')
const selectedBackupInfo = ref<any>(null)
const backupStartTime = ref(0)
const estimatedTotalSize = ref(0)
// Restore options
const restoreInstances = ref(true)
const restoreSettings = ref(true)
const restoreScreenshots = ref(false)
const skipExistingInstances = ref(true)

// Services
const { createBackup, restoreBackup, getBackupInfo } = useService(BackupServiceKey)
const { getGameDataDirectory } = useService(BaseServiceKey)
const { getSharedInstancesState } = useService(InstanceServiceKey)
const { state } = injection(kSettingsState)

// Current instances for skip-existing check
const existingInstanceNames = ref(new Set<string>())
onMounted(async () => {
  try {
    const instancesState = await getSharedInstancesState()
    existingInstanceNames.value = new Set(
      (instancesState.instances ?? []).map((i: any) => {
        const parts = (i.path || '').replace(/\\/g, '/').split('/')
        return parts[parts.length - 1]
      }).filter(Boolean)
    )
  } catch {
    // ignore - not critical
  }
})

// Task tracking — backup
const { task: backupTask, progress: backupProgress, total: backupTotal, cancel: cancelBackup } = useTask(
  (t) => t.type === 'createBackup'
)

// Task tracking — restore
const { task: restoreTask, progress: restoreProgress, total: restoreTotal } = useTask(
  (t) => t.type === 'restoreBackup'
)

// Backup progress %
const backupProgressPercent = computed(() => {
  if (!backupTask.value || backupTask.value.type !== 'createBackup') return 0
  if (backupTotal.value === -1 || backupTotal.value === 0) return 0
  return (backupProgress.value / backupTotal.value) * 100
})

// Restore progress %
const restoreProgressPercent = computed(() => {
  if (!restoreTask.value || restoreTask.value.type !== 'restoreBackup') return 0
  if (restoreTotal.value === -1 || restoreTotal.value === 0) return 0
  return (restoreProgress.value / restoreTotal.value) * 100
})

// Estimated time remaining — backup
const estimatedTimeRemaining = computed(() => {
  if (!backupTask.value || backupTask.value.type !== 'createBackup') return ''
  if (backupProgressPercent.value === 0 || backupStartTime.value === 0) return t('setting.backupCalculating')
  const elapsed = Date.now() - backupStartTime.value
  const rate = backupProgressPercent.value / elapsed
  const remaining = (100 - backupProgressPercent.value) / rate
  if (remaining < 60000) return t('setting.backupTimeRemaining', { time: `${Math.ceil(remaining / 1000)}s` })
  return t('setting.backupTimeRemaining', { time: `${Math.ceil(remaining / 60000)}m` })
})

// Estimated time remaining — restore
const restoreStartTime = ref(0)
const restoreEstimatedTimeRemaining = computed(() => {
  if (!restoreTask.value || restoreTask.value.type !== 'restoreBackup') return ''
  if (restoreTask.value.phase === 'extracting') return t('setting.backupCalculating')
  if (restoreProgressPercent.value === 0 || restoreStartTime.value === 0) return t('setting.backupCalculating')
  const elapsed = Date.now() - restoreStartTime.value
  const rate = restoreProgressPercent.value / elapsed
  const remaining = (100 - restoreProgressPercent.value) / rate
  if (remaining < 60000) return t('setting.backupTimeRemaining', { time: `${Math.ceil(remaining / 1000)}s` })
  return t('setting.backupTimeRemaining', { time: `${Math.ceil(remaining / 60000)}m` })
})

// Watch — backup task
watch(backupTask, (task, oldTask) => {
  if (task && !oldTask && task.type === 'createBackup') {
    backupStartTime.value = Date.now()
  }
  if (oldTask && !task) {
    showBackupProgress.value = false
    if (!creatingBackup.value) return
    showBackupComplete.value = true
    creatingBackup.value = false
    backupStartTime.value = 0
  }
})

// Watch — restore task
watch(restoreTask, (task, oldTask) => {
  if (task && !oldTask && task.type === 'restoreBackup') {
    restoreStartTime.value = Date.now()
  }
  if (oldTask && !task) {
    showRestoreProgress.value = false
    restoringBackup.value = false
    restoreStartTime.value = 0
    showRestoreComplete.value = true
  }
})

function getPhaseText(phase: CreateBackupTask['phase']) {
  const phaseMap: Record<CreateBackupTask['phase'], string> = {
    'copying-instances': t('setting.backupPhaseCopyingInstances'),
    'copying-settings': t('setting.backupPhaseCopyingSettings'),
    'copying-screenshots': t('setting.backupPhaseCopyingScreenshots'),
    'creating-archive': t('setting.backupPhaseCreatingArchive'),
    'finalizing': t('setting.backupPhaseFinalizing'),
  }
  return phaseMap[phase] || phase
}

function getRestorePhaseText(phase: RestoreBackupTask['phase']) {
  const phaseMap: Record<RestoreBackupTask['phase'], string> = {
    'scanning': t('setting.restorePhaseScanningInstances'),
    'extracting': t('setting.restorePhaseExtracting'),
    'restoring-instances': t('setting.restorePhaseRestoringInstances'),
    'restoring-settings': t('setting.restorePhaseRestoringSettings'),
    'restoring-screenshots': t('setting.restorePhaseRestoringScreenshots'),
    'finalizing': t('setting.backupPhaseFinalizing'),
  }
  return phaseMap[phase] || phase
}

async function onCreateBackup() {
  try {
    const controller = (window as any).windowController
    if (!controller) {
      notify({ level: 'error', title: t('setting.backupFailed'), body: 'Window controller not available' })
      return
    }

    // Show save dialog
    const result = await controller.showSaveDialog({
      title: t('setting.saveBackupFile'),
      defaultPath: `xmcl-backup-${new Date().toISOString().split('T')[0]}.xmclbackup`,
      filters: [
        { name: 'Backup Files', extensions: ['xmclbackup'] },
      ],
    })

    if (result.canceled || !result.filePath) {
      return
    }

    creatingBackup.value = true
    showBackupProgress.value = true

    await createBackup({
      destinationPath: result.filePath,
      includeInstances: includeInstances.value,
      includeSettings: includeSettings.value,
      includeScreenshots: includeScreenshots.value,
    })

    // Success handled by task watcher
  } catch (error: any) {
    creatingBackup.value = false
    showBackupProgress.value = false
    notify({
      level: 'error',
      title: t('setting.backupFailed'),
      body: error.message || String(error),
    })
  }
}

async function onRestoreBackup() {
  try {
    const controller = (window as any).windowController
    if (!controller) {
      notify({ level: 'error', title: t('setting.restoreFailed'), body: 'Window controller not available' })
      return
    }

    const result = await controller.showOpenDialog({
      title: t('setting.selectBackupFile'),
      filters: [{ name: 'Backup Files', extensions: ['xmclbackup'] }],
      properties: ['openFile'],
    })

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return

    selectedBackupPath.value = result.filePaths[0]

    // Show scanning indicator
    restoringBackup.value = true
    try {
      selectedBackupInfo.value = await getBackupInfo(selectedBackupPath.value)
      // Pre-set restore options based on what's in the backup
      restoreInstances.value = !!selectedBackupInfo.value?.includeInstances
      restoreSettings.value = !!selectedBackupInfo.value?.includeSettings
      restoreScreenshots.value = !!selectedBackupInfo.value?.includeScreenshots
      restoringBackup.value = false
      showRestoreWarning.value = true
    } catch (infoError: any) {
      restoringBackup.value = false
      throw infoError
    }
  } catch (error: any) {
    restoringBackup.value = false
    notify({
      level: 'error',
      title: t('setting.restoreFailed'),
      body: error.message || String(error),
    })
  }
}

async function confirmRestore() {
  showRestoreWarning.value = false
  showRestoreProgress.value = true

  try {
    restoringBackup.value = true

    const dataRoot = await getGameDataDirectory()
    if (!dataRoot) throw new Error('Data root not available')

    await restoreBackup({
      backupPath: selectedBackupPath.value,
      destinationPath: dataRoot,
      restoreInstances: restoreInstances.value,
      restoreSettings: restoreSettings.value,
      restoreScreenshots: restoreScreenshots.value,
      skipExistingInstances: skipExistingInstances.value,
    })

    restoringBackup.value = false
    showRestoreProgress.value = false
    showRestoreComplete.value = true
  } catch (error: any) {
    restoringBackup.value = false
    showRestoreProgress.value = false
    notify({
      level: 'error',
      title: t('setting.restoreFailed'),
      body: error.message || String(error),
    })
  }
}

function onCancelBackup() {
  if (backupTask.value?.type === 'createBackup' && backupTask.value.phase === 'finalizing') {
    notify({
      level: 'warning',
      title: t('setting.cancelBackupTitle'),
      body: t('setting.cancelBackupFinalizingWarning'),
    })
    return
  }

  cancelBackup()
  creatingBackup.value = false
  showBackupProgress.value = false
  notify({
    level: 'info',
    title: t('setting.cancelBackupTitle'),
    body: t('setting.backupCancelled'),
  })
}

function formatLogTime(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

function formatSize(bytes: number) {
  return formatBytes(bytes)
}
</script>

<style scoped>
.log-container {
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  background-color: rgba(0, 0, 0, 0.05);
}

.log-entries {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-entry {
  display: flex;
  gap: 8px;
  padding: 2px 4px;
  border-radius: 4px;
}

.log-time {
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-weight: 600;
  min-width: 70px;
}

.log-message {
  flex: 1;
  word-break: break-word;
}

.log-info {
  color: rgba(var(--v-theme-info));
}

.log-warn {
  color: rgba(var(--v-theme-warning));
  background-color: rgba(var(--v-theme-warning), 0.1);
}

.log-error {
  color: rgba(var(--v-theme-error));
  background-color: rgba(var(--v-theme-error), 0.1);
  font-weight: 500;
}
</style>
