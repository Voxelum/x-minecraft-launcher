<template>
  <div class="d-flex flex-column gap-4">
    <!-- Manual Backup & Restore Card -->
    <SettingCard>
      <!-- Create Backup Item -->
      <SettingItem
        :title="t('backup.createBackupTitle')"
        :description="t('backup.createBackupDescription')"
      >
        <template #title>
          <v-icon start size="small" color="primary">archive</v-icon>
          {{ t('backup.createBackupTitle') }}
        </template>
        <template #action>
          <v-btn
            color="primary"
            variant="flat"
            data-testid="create-backup-btn"
            class="font-weight-bold text-none"
            @click="showCreate()"
          >
            <v-icon start size="small">archive</v-icon>
            {{ t('backup.create') }}
          </v-btn>
        </template>
      </SettingItem>

      <v-divider class="my-2" />

      <!-- Restore Backup Item -->
      <SettingItem
        :title="t('backup.restoreBackupTitle')"
        :description="t('backup.restoreBackupDescription')"
      >
        <template #title>
          <v-icon start size="small" color="primary">unarchive</v-icon>
          {{ t('backup.restoreBackupTitle') }}
        </template>
        <template #action>
          <v-btn
            color="primary"
            variant="tonal"
            data-testid="restore-backup-btn"
            class="font-weight-bold text-none"
            @click="showRestore()"
          >
            <v-icon start size="small">unarchive</v-icon>
            {{ t('backup.restore') }}
          </v-btn>
        </template>
      </SettingItem>

      <v-divider class="my-3" />

      <!-- Information / Cloud Sync Note -->
      <v-alert
        color="primary"
        variant="tonal"
        density="compact"
        icon="cloud_sync"
        class="rounded-xl text-body-2"
      >
        <div class="font-weight-bold mb-0.5">
          {{ t('backup.portableArchiveNoticeTitle') }}
        </div>
        <div class="text-caption text-medium-emphasis">
          {{ t('backup.portableArchiveNoticeDescription') }}
        </div>
      </v-alert>
    </SettingCard>

    <!-- Background Auto-Backup Card -->
    <SettingCard>
      <!-- Enable Switch & Run Now Header Row -->
      <SettingItem
        :description="t('backup.autoBackupDescription')"
      >
        <template #preaction>
          <v-avatar
            size="40"
            :color="autoBackupEnabled ? 'primary' : 'surface-variant'"
            variant="tonal"
            rounded="lg"
          >
            <v-icon :color="autoBackupEnabled ? 'primary' : undefined" size="20">
              schedule_send
            </v-icon>
          </v-avatar>
        </template>
        <template #title>
          <span class="font-weight-bold mr-2">{{ t('backup.autoBackupTitle') }}</span>
          <v-chip
            size="x-small"
            :color="isAutoBackupRunning ? 'info' : autoBackupEnabled ? 'success' : 'default'"
            variant="tonal"
            class="font-weight-bold"
          >
            <v-progress-circular
              v-if="isAutoBackupRunning"
              indeterminate
              size="10"
              width="2"
              class="mr-1"
            />
            {{
              isAutoBackupRunning
                ? t('backup.autoBackupStatusRunning')
                : autoBackupEnabled
                  ? t('backup.autoBackupStatusEnabled')
                  : t('backup.autoBackupStatusDisabled')
            }}
          </v-chip>
        </template>
        <template #action>
          <div class="d-flex align-center gap-3">
            <v-btn
              variant="tonal"
              color="primary"
              size="small"
              class="text-none font-weight-bold"
              data-testid="auto-backup-run-now-btn"
              :loading="isAutoBackupRunning"
              :disabled="!canRunAutoBackupNow"
              @click="onRunNow"
            >
              <v-icon start size="16">play_arrow</v-icon>
              {{ t('backup.autoBackupRunNow') }}
            </v-btn>
            <v-switch
              :model-value="autoBackupEnabled"
              color="primary"
              hide-details
              density="compact"
              data-testid="auto-backup-enable-switch"
              @update:model-value="onToggleAutoBackup"
            />
          </div>
        </template>
      </SettingItem>

      <!-- Compact Status Bar -->
      <div class="px-4 pb-2">
        <div class="status-pill-bar d-flex align-center justify-space-between flex-wrap gap-2 px-3 py-2 rounded-lg text-caption">
          <div class="d-flex align-center gap-2 text-medium-emphasis">
            <v-icon size="16" color="primary">history</v-icon>
            <span>{{ t('backup.autoBackupLastRun') }}:</span>
            <strong class="text-high-emphasis">{{ lastBackupFormatted }}</strong>
          </div>
          <div class="d-flex align-center gap-2">
            <v-chip
              size="x-small"
              :color="selectedInstancesCount > 0 ? 'primary' : 'warning'"
              variant="tonal"
              class="font-weight-medium"
            >
              {{ t('backup.selectedCount', { selected: selectedInstancesCount, total: validInstances.length }) }}
            </v-chip>
          </div>
        </div>
        <div v-if="autoBackupConfig?.lastError" class="text-caption text-error mt-2 px-1 d-flex align-center gap-1">
          <v-icon size="14" color="error">error_outline</v-icon>
          <span>{{ autoBackupConfig.lastError }}</span>
        </div>
      </div>

      <v-divider class="my-2" />

      <!-- Schedule & Retention Rows (Native SettingItem layout) -->
      <SettingItem :title="t('backup.autoBackupInterval')">
        <template #title>
          <v-icon start size="small" color="primary">timer</v-icon>
          {{ t('backup.autoBackupInterval') }}
        </template>
        <template #action>
          <v-select
            :model-value="autoBackupConfig?.intervalMinutes ?? 60"
            :items="intervalOptions"
            item-title="title"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            class="setting-select"
            @update:model-value="onUpdateInterval"
          />
        </template>
      </SettingItem>

      <v-divider class="my-1" />

      <SettingItem :title="t('backup.autoBackupRetention')">
        <template #title>
          <v-icon start size="small" color="primary">auto_delete</v-icon>
          {{ t('backup.autoBackupRetention') }}
        </template>
        <template #action>
          <v-select
            :model-value="autoBackupConfig?.maxBackups ?? 5"
            :items="retentionOptions"
            item-title="title"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            class="setting-select"
            @update:model-value="onUpdateRetention"
          />
        </template>
      </SettingItem>

      <v-divider class="my-1" />

      <!-- Destination Folder Row -->
      <SettingItem
        :title="t('backup.autoBackupDestination')"
        :description="autoBackupConfig?.destinationDir || ''"
      >
        <template #title>
          <v-icon start size="small" color="primary">folder</v-icon>
          {{ t('backup.autoBackupDestination') }}
        </template>
        <template #action>
          <div class="d-flex align-center gap-2">
            <v-btn
              variant="tonal"
              size="small"
              color="primary"
              class="text-none font-weight-medium"
              @click="browseDestinationDir"
            >
              <v-icon start size="16">edit_location_alt</v-icon>
              {{ t('backup.browse') }}
            </v-btn>
            <v-btn
              variant="outlined"
              size="small"
              class="text-none font-weight-medium"
              @click="openAutoBackupFolder"
            >
              <v-icon start size="16">folder_open</v-icon>
              {{ t('backup.openFolder') }}
            </v-btn>
          </div>
        </template>
      </SettingItem>

      <v-divider class="my-3" />

      <!-- Instance Multi-Selector (2-Column Grid with Icons & Loader Badges) -->
      <div class="px-4 mb-4">
        <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-2">
          <div class="d-flex align-center gap-2">
            <v-icon size="18" color="primary">dns</v-icon>
            <span class="text-subtitle-2 font-weight-bold">
              {{ t('backup.autoBackupSelectInstances') }}
            </span>
          </div>
          <div class="d-flex align-center gap-1">
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
              @click="clearSelectedInstances"
            >
              {{ t('backup.deselectAll') }}
            </v-btn>
          </div>
        </div>

        <v-text-field
          v-if="validInstances.length > 4"
          v-model="instanceSearch"
          prepend-inner-icon="search"
          :placeholder="t('backup.searchInstances')"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="mb-3"
        />

        <div
          v-if="filteredInstances.length > 0"
          class="instance-grid"
        >
          <div
            v-for="inst in filteredInstances"
            :key="inst.path"
            class="instance-tile d-flex align-center gap-3 pa-2.5 rounded-xl cursor-pointer select-none"
            :class="{ 'instance-tile--selected': isInstanceSelected(inst.path) }"
            role="checkbox"
            :aria-checked="isInstanceSelected(inst.path)"
            tabindex="0"
            @click="toggleInstance(inst.path)"
            @keydown.space.prevent="toggleInstance(inst.path)"
            @keydown.enter.prevent="toggleInstance(inst.path)"
          >
            <v-checkbox-btn
              :model-value="isInstanceSelected(inst.path)"
              color="primary"
              density="compact"
              class="flex-shrink-0"
              tabindex="-1"
              @click.stop="toggleInstance(inst.path)"
            />
            <v-avatar size="34" rounded="lg" class="border flex-shrink-0">
              <v-img :src="inst.icon || BuiltinImages.craftingTable" cover />
            </v-avatar>
            <div class="min-w-0 flex-grow-1">
              <div class="text-body-2 font-weight-bold text-truncate">
                {{ inst.name || inst.path.split(/[\\/]/).pop() }}
              </div>
              <div class="d-flex align-center gap-1 mt-0.5 flex-wrap">
                <span class="text-caption text-medium-emphasis">
                  {{ inst.runtime.minecraft }}
                </span>
                <v-chip
                  v-if="inst.runtime.forge"
                  size="x-small"
                  variant="tonal"
                  color="orange"
                  class="px-1.5 loader-chip"
                >
                  Forge
                </v-chip>
                <v-chip
                  v-else-if="inst.runtime.fabricLoader"
                  size="x-small"
                  variant="tonal"
                  color="blue"
                  class="px-1.5 loader-chip"
                >
                  Fabric
                </v-chip>
                <v-chip
                  v-else-if="inst.runtime.neoForged"
                  size="x-small"
                  variant="tonal"
                  color="amber"
                  class="px-1.5 loader-chip"
                >
                  NeoForge
                </v-chip>
                <v-chip
                  v-else-if="inst.runtime.quiltLoader"
                  size="x-small"
                  variant="tonal"
                  color="purple"
                  class="px-1.5 loader-chip"
                >
                  Quilt
                </v-chip>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="pa-4 text-center text-caption text-medium-emphasis rounded-xl border">
          {{ t('backup.noInstancesFound') }}
        </div>
      </div>

      <v-divider class="my-3" />

      <!-- Content to Include in Background Backups (Reliable Toggle Grid + Mods Mode) -->
      <div class="px-4 mb-2">
        <div class="d-flex align-center gap-2 mb-3">
          <v-icon size="18" color="primary">fact_check</v-icon>
          <span class="text-subtitle-2 font-weight-bold">
            {{ t('backup.autoBackupContentLabel') }}
          </span>
        </div>

        <div class="content-options-grid mb-3">
          <div
            v-for="opt in contentOptions"
            :key="opt.key"
            class="content-option-tile d-flex align-center justify-space-between pa-2.5 rounded-xl cursor-pointer select-none"
            :class="{ 'content-option-tile--active': isContentEnabled(opt.key) }"
            role="checkbox"
            :aria-checked="isContentEnabled(opt.key)"
            tabindex="0"
            @click="onUpdateContent(opt.key, !isContentEnabled(opt.key))"
            @keydown.space.prevent="onUpdateContent(opt.key, !isContentEnabled(opt.key))"
            @keydown.enter.prevent="onUpdateContent(opt.key, !isContentEnabled(opt.key))"
          >
            <div class="d-flex align-center gap-2.5 min-w-0">
              <v-avatar
                size="30"
                :color="isContentEnabled(opt.key) ? 'primary' : 'surface-variant'"
                variant="tonal"
                rounded="md"
              >
                <v-icon size="16" :color="isContentEnabled(opt.key) ? 'primary' : undefined">
                  {{ opt.icon }}
                </v-icon>
              </v-avatar>
              <span class="text-body-2 font-weight-medium text-truncate">
                {{ opt.label }}
              </span>
            </div>
            <v-checkbox-btn
              :model-value="isContentEnabled(opt.key)"
              color="primary"
              density="compact"
              tabindex="-1"
              @click.stop="onUpdateContent(opt.key, !isContentEnabled(opt.key))"
            />
          </div>
        </div>

        <!-- Mods Mode Sub-Selector (Full JARs vs Lightweight List) -->
        <div
          v-if="autoBackupConfig?.includeMods"
          class="d-flex align-center justify-space-between flex-wrap gap-2 px-3 py-2 rounded-xl status-pill-bar"
        >
          <span class="text-caption font-weight-medium text-medium-emphasis d-flex align-center">
            <v-icon size="16" color="primary" class="mr-1.5">extension</v-icon>
            {{ t('backup.modsMode') }}:
          </span>
          <v-btn-toggle
            :model-value="autoBackupConfig?.modListOnly ? 'listOnly' : 'full'"
            mandatory
            density="compact"
            color="primary"
            variant="outlined"
            class="rounded-lg"
            @update:model-value="onUpdateModsMode"
          >
            <v-btn value="full" size="x-small" class="text-none px-3">
              {{ t('backup.modsFull') }}
            </v-btn>
            <v-btn value="listOnly" size="x-small" class="text-none px-3">
              {{ t('backup.modsListOnly') }}
            </v-btn>
          </v-btn-toggle>
        </div>
      </div>

      <!-- Saved Auto-Backups History List -->
      <div v-if="autoBackupFiles.length > 0" class="px-4 pt-2 pb-1">
        <v-divider class="mb-3" />
        <div class="d-flex align-center justify-space-between mb-2">
          <div class="d-flex align-center gap-2">
            <v-icon size="18" color="primary">folder_zip</v-icon>
            <span class="text-subtitle-2 font-weight-bold">
              {{ t('backup.autoBackupHistoryTitle') }} ({{ autoBackupFiles.length }})
            </span>
          </div>
        </div>

        <v-card variant="outlined" class="rounded-xl overflow-hidden setting-subcard">
          <v-list density="compact" class="bg-transparent pa-0" style="max-height: 210px; overflow-y: auto;">
            <template v-for="(entry, idx) in autoBackupFiles" :key="entry.filePath">
              <v-divider v-if="idx > 0" />
              <v-list-item data-testid="auto-backup-history-row" :data-file-name="entry.fileName" class="py-1.5 px-3">
                <template #prepend>
                  <v-avatar size="30" color="primary" variant="tonal" rounded="md" class="mr-3">
                    <v-icon size="16" color="primary">inventory_2</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="text-caption font-weight-bold">
                  {{ entry.fileName }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ formatDate(entry.createdAt) }} · {{ formatSize(entry.sizeBytes) }}
                </v-list-item-subtitle>
                <template #append>
                  <div class="d-flex align-center gap-1">
                    <v-btn
                      variant="tonal"
                      size="x-small"
                      color="primary"
                      class="text-none font-weight-bold"
                      @click="showRestore(entry.filePath)"
                    >
                      <v-icon start size="14">unarchive</v-icon>
                      {{ t('backup.restore') }}
                    </v-btn>
                    <v-btn
                      icon
                      variant="text"
                      size="x-small"
                      :title="t('backup.openFolder')"
                      @click="showItemInDirectory(entry.filePath)"
                    >
                      <v-icon size="16">folder_open</v-icon>
                    </v-btn>
                    <v-btn
                      icon
                      variant="text"
                      size="x-small"
                      color="error"
                      :title="t('shared.delete')"
                      data-testid="auto-backup-delete"
                      @click="removeAutoBackupFile(entry.filePath)"
                    >
                      <v-icon size="16">delete_outline</v-icon>
                    </v-btn>
                  </div>
                </template>
              </v-list-item>
            </template>
          </v-list>
        </v-card>
      </div>
    </SettingCard>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import { useBackup } from '@/composables/backup'
import { useDialog } from '@/composables/dialog'
import { useInstances } from '@/composables/instances'
import { useService } from '@/composables/service'
import { BuiltinImages } from '@/constant'
import { BaseServiceKey, type AutoBackupConfig } from '@xmcl/runtime-api'

const { t } = useI18n()
const { show: showCreate } = useDialog('backup-create')
const { show: showRestore } = useDialog<string>('backup-restore')
const { instances, selectedInstance } = useInstances()
const { openDirectory, showItemInDirectory } = useService(BaseServiceKey)

const {
  autoBackupConfig,
  isAutoBackupRunning,
  autoBackupFiles,
  loadAutoBackupState,
  updateAutoBackupConfig,
  triggerAutoBackupNow,
  removeAutoBackupFile,
} = useBackup()

const instanceSearch = ref('')

onMounted(() => {
  loadAutoBackupState()
})

const validInstances = computed(() => instances.value.filter((i) => i.edition !== 'bedrock'))

const filteredInstances = computed(() => {
  const q = instanceSearch.value?.trim().toLowerCase()
  if (!q) return validInstances.value
  return validInstances.value.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      i.runtime.minecraft.toLowerCase().includes(q),
  )
})

const autoBackupEnabled = computed(() => !!autoBackupConfig.value?.enabled)

const selectedInstancesCount = computed(() => {
  const selected = new Set(autoBackupConfig.value?.instancePaths || [])
  return validInstances.value.filter((i) => selected.has(i.path)).length
})

const canRunAutoBackupNow = computed(() => {
  if (isAutoBackupRunning.value) return false
  return selectedInstancesCount.value > 0 || !!autoBackupConfig.value?.includeSettings
})

const lastBackupFormatted = computed(() => {
  const ts = autoBackupConfig.value?.lastBackupAt
  if (!ts) return t('backup.autoBackupNeverRun')
  return new Date(ts).toLocaleString()
})

const intervalOptions = computed(() => [
  { title: t('backup.interval30m'), value: 30 },
  { title: t('backup.interval1h'), value: 60 },
  { title: t('backup.interval2h'), value: 120 },
  { title: t('backup.interval4h'), value: 240 },
  { title: t('backup.interval6h'), value: 360 },
  { title: t('backup.interval12h'), value: 720 },
  { title: t('backup.interval24h'), value: 1440 },
])

const retentionOptions = computed(() => [
  { title: t('backup.keepCount', { count: 3 }), value: 3 },
  { title: t('backup.keepCount', { count: 5 }), value: 5 },
  { title: t('backup.keepCount', { count: 10 }), value: 10 },
  { title: t('backup.keepCount', { count: 15 }), value: 15 },
  { title: t('backup.keepCount', { count: 20 }), value: 20 },
])

type ContentToggleKey =
  | 'includeSaves'
  | 'includeConfigs'
  | 'includeMods'
  | 'includeResourcePacks'
  | 'includeShaderPacks'
  | 'includeSettings'

const contentOptions = computed<Array<{ key: ContentToggleKey; label: string; icon: string }>>(() => [
  { key: 'includeSaves', label: t('backup.instanceSaves'), icon: 'public' },
  { key: 'includeConfigs', label: t('backup.instanceConfigs'), icon: 'tune' },
  { key: 'includeMods', label: t('backup.instanceMods'), icon: 'extension' },
  { key: 'includeResourcePacks', label: t('backup.instanceResourcePacks'), icon: 'palette' },
  { key: 'includeShaderPacks', label: t('backup.instanceShaderPacks'), icon: 'wb_sunny' },
  { key: 'includeSettings', label: t('backup.launcherSettings'), icon: 'settings' },
])

function isContentEnabled(key: ContentToggleKey): boolean {
  return !!autoBackupConfig.value?.[key]
}

function isInstanceSelected(path: string): boolean {
  return !!autoBackupConfig.value?.instancePaths.includes(path)
}

async function toggleInstance(path: string) {
  const current = [...(autoBackupConfig.value?.instancePaths || [])]
  const idx = current.indexOf(path)
  if (idx === -1) {
    current.push(path)
  } else {
    current.splice(idx, 1)
  }
  await updateAutoBackupConfig({ instancePaths: current })
}

async function selectAllInstances() {
  await updateAutoBackupConfig({
    instancePaths: validInstances.value.map((i) => i.path),
  })
}

async function clearSelectedInstances() {
  await updateAutoBackupConfig({
    instancePaths: [],
  })
}

async function onToggleAutoBackup(val: boolean | null) {
  const enabled = !!val
  const patch: Partial<AutoBackupConfig> = { enabled }
  // Automatically select active Java instance if enabling when 0 instances are selected
  if (enabled && selectedInstancesCount.value === 0 && validInstances.value.length > 0) {
    const activeValid = validInstances.value.find((i) => i.path === selectedInstance.value)
    patch.instancePaths = [activeValid ? activeValid.path : validInstances.value[0].path]
  }
  await updateAutoBackupConfig(patch)
}

async function onUpdateInterval(intervalMinutes: number) {
  await updateAutoBackupConfig({ intervalMinutes })
}

async function onUpdateRetention(maxBackups: number) {
  await updateAutoBackupConfig({ maxBackups })
}

async function onUpdateContent(key: ContentToggleKey, value: boolean) {
  await updateAutoBackupConfig({ [key]: value })
}

async function onUpdateModsMode(mode: string) {
  await updateAutoBackupConfig({ modListOnly: mode === 'listOnly' })
}

async function browseDestinationDir() {
  const { filePaths, canceled } = await windowController.showOpenDialog({
    title: t('backup.autoBackupDestination'),
    defaultPath: autoBackupConfig.value?.destinationDir,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || !filePaths || filePaths.length === 0) return
  await updateAutoBackupConfig({ destinationDir: filePaths[0] })
}

function openAutoBackupFolder() {
  const dir = autoBackupConfig.value?.destinationDir
  if (dir) {
    openDirectory(dir)
  } else if (autoBackupConfig.value?.lastBackupPath) {
    showItemInDirectory(autoBackupConfig.value.lastBackupPath)
  }
}

async function onRunNow() {
  await triggerAutoBackupNow()
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<style scoped>
.gap-1 {
  gap: 4px;
}
.gap-2 {
  gap: 8px;
}
.gap-2\.5 {
  gap: 10px;
}
.gap-3 {
  gap: 12px;
}
.gap-4 {
  gap: 16px;
}
.setting-select {
  min-width: 220px;
  max-width: 280px;
}
.status-pill-bar {
  background-color: rgba(var(--v-theme-on-surface), 0.03);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.setting-subcard {
  background-color: rgba(var(--v-theme-on-surface), 0.02);
  border-color: rgba(var(--v-theme-on-surface), 0.08) !important;
}
.instance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 2px;
}
.instance-tile {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.09);
  background-color: rgba(var(--v-theme-on-surface), 0.02);
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.instance-tile:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}
.instance-tile--selected {
  background-color: rgba(var(--v-theme-primary), 0.1);
  border-color: rgba(var(--v-theme-primary), 0.45);
}
.loader-chip {
  height: 18px !important;
  font-size: 10px !important;
}
.content-options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.content-option-tile {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.09);
  background-color: rgba(var(--v-theme-on-surface), 0.02);
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.content-option-tile:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}
.content-option-tile--active {
  background-color: rgba(var(--v-theme-primary), 0.08);
  border-color: rgba(var(--v-theme-primary), 0.4);
}
</style>
