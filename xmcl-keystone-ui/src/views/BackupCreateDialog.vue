<template>
  <v-dialog
    v-model="isShown"
    max-width="780"
    scrollable
    persistent
    transition="dialog-transition"
  >
    <v-card class="rounded-xl overflow-hidden backup-card">
      <!-- Toolbar Header -->
      <v-toolbar color="surface" density="comfortable" class="px-5 border-b">
        <v-avatar size="32" :color="dialogMode === 'done' ? 'success' : 'primary'" class="mr-3" variant="tonal">
          <v-icon size="20">
            {{ dialogMode === 'done' ? 'check_circle' : dialogMode === 'working' ? 'sync' : 'archive' }}
          </v-icon>
        </v-avatar>
        <v-toolbar-title class="text-subtitle-1 font-weight-bold">
          {{ dialogMode === 'done' ? t('backup.backupDone') : dialogMode === 'working' ? t('backup.workingTitle') : t('backup.createTitle') }}
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

      <!-- MODE 1: CONFIGURATION -->
      <v-card-text v-if="dialogMode === 'config'" class="pa-5 overflow-y-auto">
        <!-- Informational Notice Banner -->
        <v-alert
          color="primary"
          variant="tonal"
          density="comfortable"
          icon="verified_user"
          class="mb-5 rounded-xl"
        >
          <div class="text-body-2 font-weight-medium">
            {{ t('backup.excludeLibrariesNotice') }}
          </div>
        </v-alert>

        <!-- Section 1: Launcher Data -->
        <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-2 ml-1">
          {{ t('backup.launcherData') }}
        </div>
        <v-card variant="outlined" class="pa-3 mb-5 rounded-xl setting-group-card">
          <!-- Settings Tile -->
          <div
            class="d-flex align-center justify-space-between pa-2 rounded-lg cursor-pointer hover-surface"
            @click="includeSettings = !includeSettings"
          >
            <div class="d-flex align-center gap-3">
              <v-avatar size="36" color="indigo" variant="tonal" rounded="lg">
                <v-icon size="20">settings</v-icon>
              </v-avatar>
              <div>
                <div class="text-subtitle-2 font-weight-medium">{{ t('backup.includeSettingsTitle') }}</div>
                <div class="text-caption text-medium-emphasis">{{ t('backup.includeSettingsHint') }}</div>
              </div>
            </div>
            <v-switch
              v-model="includeSettings"
              color="primary"
              density="compact"
              hide-details
              class="ma-0"
              @click.stop
            />
          </div>

          <v-divider class="my-2" />

          <!-- Collections Tile -->
          <div
            class="d-flex align-center justify-space-between pa-2 rounded-lg cursor-pointer hover-surface"
            @click="includeCollections = !includeCollections"
          >
            <div class="d-flex align-center gap-3">
              <v-avatar size="36" color="amber-darken-2" variant="tonal" rounded="lg">
                <v-icon size="20">folder_special</v-icon>
              </v-avatar>
              <div>
                <div class="text-subtitle-2 font-weight-medium">{{ t('backup.includeCollectionsTitle') }}</div>
                <div class="text-caption text-medium-emphasis">{{ t('backup.includeCollectionsHint') }}</div>
              </div>
            </div>
            <v-switch
              v-model="includeCollections"
              color="primary"
              density="compact"
              hide-details
              class="ma-0"
              @click.stop
            />
          </div>

          <v-divider class="my-2" />

          <!-- Themes Tile -->
          <div
            class="d-flex align-center justify-space-between pa-2 rounded-lg cursor-pointer hover-surface"
            @click="includeThemes = !includeThemes"
          >
            <div class="d-flex align-center gap-3">
              <v-avatar size="36" color="purple" variant="tonal" rounded="lg">
                <v-icon size="20">palette</v-icon>
              </v-avatar>
              <div>
                <div class="text-subtitle-2 font-weight-medium">{{ t('backup.includeThemesTitle') }}</div>
                <div class="text-caption text-medium-emphasis">{{ t('backup.includeThemesHint') }}</div>
              </div>
            </div>
            <v-switch
              v-model="includeThemes"
              color="primary"
              density="compact"
              hide-details
              class="ma-0"
              @click.stop
            />
          </div>
        </v-card>

        <!-- Section 2: Instances Data Options -->
        <div class="d-flex align-center justify-space-between mb-2 ml-1">
          <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
            {{ t('backup.instances') }} ({{ selectedInstancePaths.length }}/{{ validInstances.length }})
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

        <v-card variant="outlined" class="pa-4 mb-3 rounded-xl setting-group-card">
          <div class="text-caption font-weight-bold text-medium-emphasis mb-2">
            {{ t('backup.instanceDataOptions') }}
          </div>
          <div class="d-flex flex-wrap gap-x-6 gap-y-2 mb-3">
            <v-checkbox
              v-model="includeConfigs"
              :label="t('backup.includeConfigs')"
              color="primary"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="includeSaves"
              :label="t('backup.includeSaves')"
              color="primary"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="includeResourcePacks"
              :label="t('backup.includeResourcePacks')"
              color="primary"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="includeShaderPacks"
              :label="t('backup.includeShaderPacks')"
              color="primary"
              density="compact"
              hide-details
            />
          </div>

          <!-- Mods Mode Selector -->
          <div class="d-flex align-center justify-space-between flex-wrap gap-2 pt-2 border-t">
            <span class="text-caption font-weight-medium text-medium-emphasis">
              <v-icon size="small" class="mr-1">extension</v-icon>
              {{ t('backup.modsMode') }}:
            </span>
            <v-btn-toggle
              v-model="modsMode"
              mandatory
              density="compact"
              color="primary"
              variant="outlined"
              class="rounded-lg"
            >
              <v-btn value="full" size="small" class="text-none">{{ t('backup.modsFull') }}</v-btn>
              <v-btn value="listOnly" size="small" class="text-none">{{ t('backup.modsListOnly') }}</v-btn>
              <v-btn value="none" size="small" class="text-none">{{ t('backup.modsNone') }}</v-btn>
            </v-btn-toggle>
          </div>
        </v-card>

        <!-- Instance List with Quick Filter -->
        <v-text-field
          v-if="validInstances.length > 4"
          v-model="searchQuery"
          variant="outlined"
          density="compact"
          prepend-inner-icon="search"
          :placeholder="t('backup.searchInstancesPlaceholder')"
          hide-details
          class="mb-3 search-field"
        />

        <v-list
          v-if="filteredInstances.length > 0"
          density="compact"
          class="border rounded-xl pa-1 overflow-y-auto instance-list-container"
          max-height="250"
        >
          <v-list-item
            v-for="inst in filteredInstances"
            :key="inst.path"
            density="comfortable"
            class="rounded-lg mb-1 px-3 cursor-pointer"
            :class="{ 'selected-instance-row': selectedInstancePaths.includes(inst.path) }"
            @click="toggleInstance(inst.path)"
          >
            <template #prepend>
              <v-checkbox-btn
                :model-value="selectedInstancePaths.includes(inst.path)"
                color="primary"
                class="mr-2"
                @click.stop="toggleInstance(inst.path)"
              />
              <v-avatar size="32" rounded="md" class="mr-3 border">
                <v-img :src="inst.icon || BuiltinImages.craftingTable" cover />
              </v-avatar>
            </template>

            <v-list-item-title class="text-body-2 font-weight-medium">
              {{ inst.name }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption d-flex align-center gap-1 mt-1">
              <v-chip size="x-small" variant="flat" color="surface-variant" class="px-2 font-weight-medium">
                {{ inst.runtime.minecraft }}
              </v-chip>
              <v-chip
                v-if="inst.runtime.forge"
                size="x-small"
                variant="tonal"
                color="orange"
                class="px-2"
              >
                Forge {{ inst.runtime.forge }}
              </v-chip>
              <v-chip
                v-else-if="inst.runtime.fabricLoader"
                size="x-small"
                variant="tonal"
                color="blue"
                class="px-2"
              >
                Fabric {{ inst.runtime.fabricLoader }}
              </v-chip>
              <v-chip
                v-else-if="inst.runtime.neoForged"
                size="x-small"
                variant="tonal"
                color="amber"
                class="px-2"
              >
                NeoForge {{ inst.runtime.neoForged }}
              </v-chip>
              <v-chip
                v-else-if="inst.runtime.quiltLoader"
                size="x-small"
                variant="tonal"
                color="purple"
                class="px-2"
              >
                Quilt {{ inst.runtime.quiltLoader }}
              </v-chip>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
        <div v-else class="text-caption text-medium-emphasis text-center py-6">
          {{ t('backup.noInstancesFound') }}
        </div>
      </v-card-text>

      <!-- MODE 2: ACTIVE WORKING / PROGRESS SCREEN -->
      <v-card-text v-else-if="dialogMode === 'working'" class="pa-6 overflow-y-auto">
        <!-- Main Progress Hero Card -->
        <v-card variant="tonal" color="primary" class="pa-5 mb-5 rounded-xl border-primary">
          <div class="d-flex align-center justify-space-between mb-3">
            <div class="d-flex align-center gap-3">
              <v-progress-circular indeterminate size="24" width="3" color="primary" />
              <div>
                <div class="text-subtitle-1 font-weight-bold">
                  {{ backupProgress?.message || t('backup.preparing') }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ t('backup.stageLabel', { stage: currentStageLabel }) }}
                </div>
              </div>
            </div>
            <div class="text-h4 font-weight-black text-primary">
              {{ backupProgress?.percent ?? 0 }}%
            </div>
          </div>

          <v-progress-linear
            :model-value="backupProgress?.percent ?? 0"
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

        <!-- Granular Component Progress Breakdown -->
        <div v-if="hasActiveCategories" class="mb-5">
          <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-2 ml-1">
            {{ t('backup.instanceDataOptions') }}
          </div>
          <v-card variant="outlined" class="pa-3 rounded-xl setting-group-card">
            <div class="d-flex flex-wrap gap-3">
              <!-- Saves Progress Tile -->
              <div
                v-if="includeSaves && categoryStats.saves"
                class="flex-grow-1 pa-3 rounded-lg border category-progress-tile"
              >
                <div class="d-flex align-center justify-space-between text-caption font-weight-medium mb-1">
                  <span class="d-flex align-center gap-1">
                    <v-icon size="small" color="primary">public</v-icon>
                    {{ t('backup.savesCategory') }}
                  </span>
                  <span class="font-mono text-medium-emphasis">
                    {{ t('backup.itemsProgress', { current: categoryStats.saves.current, total: categoryStats.saves.total }) }}
                  </span>
                </div>
                <v-progress-linear
                  :model-value="getCategoryPercent(categoryStats.saves)"
                  color="primary"
                  height="6"
                  rounded
                />
              </div>

              <!-- Mods Progress Tile -->
              <div
                v-if="modsMode !== 'none' && categoryStats.mods"
                class="flex-grow-1 pa-3 rounded-lg border category-progress-tile"
              >
                <div class="d-flex align-center justify-space-between text-caption font-weight-medium mb-1">
                  <span class="d-flex align-center gap-1">
                    <v-icon size="small" color="amber-darken-2">extension</v-icon>
                    {{ t('backup.modsCategory') }}
                  </span>
                  <span class="font-mono text-medium-emphasis">
                    {{ t('backup.itemsProgress', { current: categoryStats.mods.current, total: categoryStats.mods.total }) }}
                  </span>
                </div>
                <v-progress-linear
                  :model-value="getCategoryPercent(categoryStats.mods)"
                  color="amber-darken-2"
                  height="6"
                  rounded
                />
              </div>

              <!-- Resource Packs Progress Tile -->
              <div
                v-if="includeResourcePacks && categoryStats.resourcePacks"
                class="flex-grow-1 pa-3 rounded-lg border category-progress-tile"
              >
                <div class="d-flex align-center justify-space-between text-caption font-weight-medium mb-1">
                  <span class="d-flex align-center gap-1">
                    <v-icon size="small" color="teal">palette</v-icon>
                    {{ t('backup.resourcePacksCategory') }}
                  </span>
                  <span class="font-mono text-medium-emphasis">
                    {{ t('backup.itemsProgress', { current: categoryStats.resourcePacks.current, total: categoryStats.resourcePacks.total }) }}
                  </span>
                </div>
                <v-progress-linear
                  :model-value="getCategoryPercent(categoryStats.resourcePacks)"
                  color="teal"
                  height="6"
                  rounded
                />
              </div>

              <!-- Shader Packs Progress Tile -->
              <div
                v-if="includeShaderPacks && categoryStats.shaderPacks"
                class="flex-grow-1 pa-3 rounded-lg border category-progress-tile"
              >
                <div class="d-flex align-center justify-space-between text-caption font-weight-medium mb-1">
                  <span class="d-flex align-center gap-1">
                    <v-icon size="small" color="purple">wb_sunny</v-icon>
                    {{ t('backup.shaderPacksCategory') }}
                  </span>
                  <span class="font-mono text-medium-emphasis">
                    {{ t('backup.itemsProgress', { current: categoryStats.shaderPacks.current, total: categoryStats.shaderPacks.total }) }}
                  </span>
                </div>
                <v-progress-linear
                  :model-value="getCategoryPercent(categoryStats.shaderPacks)"
                  color="purple"
                  height="6"
                  rounded
                />
              </div>

              <!-- Configs Progress Tile -->
              <div
                v-if="includeConfigs && categoryStats.configs"
                class="flex-grow-1 pa-3 rounded-lg border category-progress-tile"
              >
                <div class="d-flex align-center justify-space-between text-caption font-weight-medium mb-1">
                  <span class="d-flex align-center gap-1">
                    <v-icon size="small" color="indigo">tune</v-icon>
                    {{ t('backup.configsCategory') }}
                  </span>
                  <span class="font-mono text-medium-emphasis">
                    {{ t('backup.itemsProgress', { current: categoryStats.configs.current, total: categoryStats.configs.total }) }}
                  </span>
                </div>
                <v-progress-linear
                  :model-value="getCategoryPercent(categoryStats.configs)"
                  color="indigo"
                  height="6"
                  rounded
                />
              </div>
            </div>
          </v-card>
        </div>

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
          <div v-if="logEntries.length === 0" class="text-caption opacity-40 font-italic py-4 text-center">
            {{ t('backup.preparing') }}
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
            {{ t('backup.backupDone') }}
          </div>
          <div class="text-body-2 text-medium-emphasis text-center" style="max-width: 480px;">
            {{ t('backup.backupDoneHint') }}
          </div>
        </div>

        <!-- Summary Details Card -->
        <v-card variant="outlined" class="pa-4 mb-5 rounded-xl setting-group-card">
          <div class="d-flex align-center justify-space-between py-1 border-b">
            <span class="text-caption text-medium-emphasis">{{ t('backup.destinationFile') }}</span>
            <span class="text-caption font-weight-bold font-mono text-truncate ml-2" style="max-width: 400px;">
              {{ destinationFilePath }}
            </span>
          </div>
          <div class="d-flex align-center justify-space-between py-1 border-b">
            <span class="text-caption text-medium-emphasis">{{ t('backup.timeTaken', { time: '' }) }}</span>
            <span class="text-caption font-weight-bold">{{ elapsedFormatted }}</span>
          </div>
          <div class="d-flex align-center justify-space-between py-1">
            <span class="text-caption text-medium-emphasis">{{ t('backup.instances') }}</span>
            <span class="text-caption font-weight-bold">{{ selectedInstancePaths.length }}</span>
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
          <v-btn variant="text" :disabled="isCreating" @click="hide">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            variant="flat"
            class="px-6 font-weight-bold"
            :disabled="!canCreate"
            @click="startBackup"
          >
            <template #prepend>
              <v-icon>archive</v-icon>
            </template>
            {{ t('backup.create') }}
          </v-btn>
        </template>

        <!-- Mode: Working Buttons -->
        <template v-else-if="dialogMode === 'working'">
          <div class="text-caption text-medium-emphasis d-flex align-center gap-2">
            <v-progress-circular indeterminate size="16" width="2" color="primary" />
            <span>{{ t('backup.workingTitle') }}</span>
          </div>
          <v-spacer />
          <!-- We do not allow cancellation midway through yazl zip streaming to prevent truncated corrupted files -->
        </template>

        <!-- Mode: Done Buttons -->
        <template v-else-if="dialogMode === 'done'">
          <v-btn
            variant="outlined"
            color="primary"
            prepend-icon="folder_open"
            class="text-none font-weight-bold"
            @click="openInDirectory"
          >
            {{ t('backup.openFolder') }}
          </v-btn>
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
import { useInstances } from '@/composables/instances'
import { useService } from '@/composables/service'
import { BuiltinImages } from '@/constant'
import { useNotifier } from '@/composables/notifier'
import { BaseServiceKey, type BackupInstanceOptions, type BackupOptions } from '@xmcl/runtime-api'

interface LogEntry {
  id: number
  time: string
  message: string
  level: 'info' | 'success' | 'warn'
}

const { t } = useI18n()
const { isShown, hide } = useDialog('backup-create')
const { createBackup, isCreating, backupProgress } = useBackup()
const { instances } = useInstances()
const { showItemInDirectory } = useService(BaseServiceKey)
const { notify } = useNotifier()

const dialogMode = ref<'config' | 'working' | 'done'>('config')

const includeSettings = ref(true)
const includeCollections = ref(true)
const includeThemes = ref(true)

const includeConfigs = ref(true)
const includeSaves = ref(true)
const includeResourcePacks = ref(false)
const includeShaderPacks = ref(false)
const modsMode = ref<'full' | 'listOnly' | 'none'>('full')
const searchQuery = ref('')

const selectedInstancePaths = ref<string[]>([])
const destinationFilePath = ref('')

// Progress & Timer state
const elapsedSeconds = ref(0)
const estimatedRemainingSec = ref<number | null>(null)
let timerInterval: ReturnType<typeof setInterval> | null = null
let lastPercent = 0
let lastPercentTime = Date.now()
let smoothedSpeed = 0 // percent per second

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
  const p = backupProgress.value?.percent ?? 0
  if (p >= 100) return '00:00'
  if (estimatedRemainingSec.value === null || p < 4) {
    return t('backup.calculatingRemaining')
  }
  if (estimatedRemainingSec.value <= 0) {
    return t('backup.lessThanMinute')
  }
  return formatDuration(estimatedRemainingSec.value)
})

watch(() => backupProgress.value?.percent, (newPercent) => {
  if (newPercent === undefined || newPercent === null) return
  if (newPercent >= 100) {
    estimatedRemainingSec.value = 0
    return
  }

  const now = Date.now()
  const dt = (now - lastPercentTime) / 1000

  if (dt >= 0.5 && newPercent > lastPercent) {
    const deltaP = newPercent - lastPercent
    const currentSpeed = deltaP / dt
    smoothedSpeed = smoothedSpeed === 0 ? currentSpeed : smoothedSpeed * 0.7 + currentSpeed * 0.3

    if (smoothedSpeed > 0) {
      const remainingPercent = 100 - newPercent
      const rawSec = remainingPercent / smoothedSpeed
      if (estimatedRemainingSec.value === null) {
        estimatedRemainingSec.value = Math.round(rawSec)
      } else {
        estimatedRemainingSec.value = Math.round(estimatedRemainingSec.value * 0.6 + rawSec * 0.4)
      }
    }
    lastPercent = newPercent
    lastPercentTime = now
  }
})

// Granular Category Stats
const categoryStats = computed(() => {
  return backupProgress.value?.counts || {}
})

const hasActiveCategories = computed(() => {
  const stats = categoryStats.value
  return !!(
    (includeSaves.value && stats.saves) ||
    (modsMode.value !== 'none' && stats.mods) ||
    (includeResourcePacks.value && stats.resourcePacks) ||
    (includeShaderPacks.value && stats.shaderPacks) ||
    (includeConfigs.value && stats.configs)
  )
})

function getCategoryPercent(cat?: { current: number; total: number }): number {
  if (!cat || !cat.total || cat.total <= 0) return 0
  return Math.min(100, Math.round((cat.current / cat.total) * 100))
}

const currentStageLabel = computed(() => {
  const phase = backupProgress.value?.phase
  if (phase === 'settings') return t('backup.stageSettings')
  if (phase === 'collections') return t('backup.stageCollections')
  if (phase === 'themes') return t('backup.stageThemes')
  if (phase === 'instances') return t('backup.stageInstances')
  if (phase === 'compressing') return t('backup.stageCompressing')
  if (phase === 'complete') return t('backup.stageComplete')
  return t('backup.stagePreparing')
})

const currentInstanceIndexLabel = computed(() => {
  if (backupProgress.value?.currentInstanceIndex && backupProgress.value?.totalInstances) {
    return `${backupProgress.value.currentInstanceIndex}/${backupProgress.value.totalInstances}`
  }
  return `${selectedInstancePaths.value.length}`
})

// Listen to progress updates to log messages
watch(() => backupProgress.value?.message, (msg) => {
  if (msg && dialogMode.value === 'working') {
    const isComplete = backupProgress.value?.phase === 'complete'
    addLog(msg, isComplete ? 'success' : 'info')
  }
})

const validInstances = computed(() => instances.value.filter((i) => i.edition !== 'bedrock'))

const filteredInstances = computed(() => {
  const base = validInstances.value
  if (!searchQuery.value.trim()) return base
  const q = searchQuery.value.toLowerCase()
  return base.filter((i) =>
    i.name.toLowerCase().includes(q) ||
    i.runtime.minecraft.toLowerCase().includes(q),
  )
})

watch(isShown, (shown) => {
  if (shown) {
    dialogMode.value = 'config'
    logEntries.value = []
    elapsedSeconds.value = 0
    destinationFilePath.value = ''
    if (selectedInstancePaths.value.length === 0 && validInstances.value.length > 0) {
      selectedInstancePaths.value = validInstances.value.map((i) => i.path)
    }
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
  estimatedRemainingSec.value = null
  lastPercent = 0
  lastPercentTime = Date.now()
  smoothedSpeed = 0
  timerInterval = setInterval(() => {
    elapsedSeconds.value++
    if (estimatedRemainingSec.value !== null && estimatedRemainingSec.value > 1) {
      estimatedRemainingSec.value--
    }
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function selectAllInstances() {
  selectedInstancePaths.value = validInstances.value.map((i) => i.path)
}

function deselectAllInstances() {
  selectedInstancePaths.value = []
}

function toggleInstance(path: string) {
  const idx = selectedInstancePaths.value.indexOf(path)
  if (idx === -1) {
    selectedInstancePaths.value.push(path)
  } else {
    selectedInstancePaths.value.splice(idx, 1)
  }
}

const canCreate = computed(() => {
  return (
    includeSettings.value ||
    includeCollections.value ||
    includeThemes.value ||
    selectedInstancePaths.value.length > 0
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

function openInDirectory() {
  if (destinationFilePath.value) {
    showItemInDirectory(destinationFilePath.value)
  }
}

async function startBackup() {
  const dateStr = new Date().toISOString().slice(0, 10)
  const defaultFileName = `xmcl-backup-${dateStr}.xmclbackup`

  const { filePath, canceled } = await windowController.showSaveDialog({
    title: t('backup.saveDialogTitle'),
    defaultPath: defaultFileName,
    filters: [
      {
        name: t('backup.fileFilterName'),
        extensions: ['xmclbackup', 'zip'],
      },
    ],
  })

  if (canceled || !filePath) return

  // Transition to dedicated working screen!
  dialogMode.value = 'working'
  destinationFilePath.value = filePath
  logEntries.value = []
  startTimer()
  addLog(t('backup.preparing'), 'info')
  addLog(`${t('backup.destinationFile')}: ${filePath}`, 'info')

  const backupInstances: BackupInstanceOptions[] = selectedInstancePaths.value.map((instPath) => ({
    instancePath: instPath,
    includeConfigs: includeConfigs.value,
    includeSaves: includeSaves.value,
    includeResourcePacks: includeResourcePacks.value,
    includeShaderPacks: includeShaderPacks.value,
    includeMods: modsMode.value !== 'none',
    modListOnly: modsMode.value === 'listOnly',
  }))

  const options: BackupOptions = {
    destinationPath: filePath,
    includeSettings: includeSettings.value,
    includeCollections: includeCollections.value,
    includeThemes: includeThemes.value,
    instances: backupInstances,
  }

  try {
    const dest = await createBackup(options)
    stopTimer()
    if (dest) {
      destinationFilePath.value = dest
    }
    addLog(t('backup.backupDone'), 'success')
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
.gap-x-6 {
  column-gap: 24px;
}
.gap-y-2 {
  row-gap: 8px;
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
.category-progress-tile {
  min-width: 140px;
  background-color: rgba(255, 255, 255, 0.03);
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
