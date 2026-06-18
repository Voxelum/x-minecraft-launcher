<template>
  <SettingCard
    class="mb-4"
    :title="t('setting.customCss.title')"
    icon="code"
    data-testid="custom-css-card"
  >
    <template #header-action>
      <v-switch
        :model-value="globalEnabled"
        color="primary"
        hide-details
        density="compact"
        :aria-label="t('setting.customCss.globalToggle')"
        data-testid="custom-css-global-toggle"
        @update:model-value="onToggleGlobal"
      />
    </template>

    <!-- Warning Banner -->
    <v-alert
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-4"
      icon="warning"
    >
      {{ t('setting.customCss.warning') }}
    </v-alert>

    <!-- CSS Entries List -->
    <div v-if="entries.length > 0" class="css-entries-list mb-4">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="css-entry"
        :class="{ 'css-entry--active': editingEntry?.id === entry.id }"
      >
        <div class="css-entry__info">
          <v-switch
            :model-value="entry.enabled"
            color="primary"
            hide-details
            density="compact"
            class="css-entry__toggle"
            :disabled="!globalEnabled"
            @update:model-value="(v: boolean | null) => onToggleEntry(entry.id, v)"
          />
          <div class="css-entry__name">
            {{ entry.name }}
          </div>
          <v-chip
            size="x-small"
            variant="outlined"
            class="css-entry__source"
          >
            {{ entry.source }}
          </v-chip>
        </div>
        <div class="css-entry__actions">
          <v-btn
            icon
            variant="text"
            size="small"
            :color="editingEntry?.id === entry.id ? 'primary' : undefined"
            @click="onEditEntry(entry)"
          >
            <v-icon size="small">edit</v-icon>
            <v-tooltip activator="parent" location="top">{{ t('setting.customCss.edit') }}</v-tooltip>
          </v-btn>
          <v-btn
            icon
            variant="text"
            size="small"
            @click="onExportEntry(entry)"
          >
            <v-icon size="small">download</v-icon>
            <v-tooltip activator="parent" location="top">{{ t('setting.customCss.export') }}</v-tooltip>
          </v-btn>
          <v-btn
            icon
            variant="text"
            size="small"
            color="error"
            @click="onRemoveEntry(entry.id)"
          >
            <v-icon size="small">delete</v-icon>
            <v-tooltip activator="parent" location="top">{{ t('setting.customCss.delete') }}</v-tooltip>
          </v-btn>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-6 opacity-60">
      <v-icon size="48" class="mb-2">style</v-icon>
      <div class="text-body-2">{{ t('setting.customCss.noEntries') }}</div>
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="add"
        data-testid="custom-css-add-btn"
        @click="onAddNew"
      >
        {{ t('setting.customCss.addNew') }}
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="folder_open"
        @click="onImportFile"
      >
        {{ t('setting.customCss.importFile') }}
      </v-btn>

    </div>

    <!-- CSS Editor -->
    <v-expand-transition>
      <div v-if="editingEntry" class="css-editor">
        <v-text-field
          v-model="editingName"
          :label="t('setting.customCss.entryName')"
          density="compact"
          variant="outlined"
          hide-details
          class="mb-3"
          data-testid="custom-css-editor-name"
        />
        <div class="css-editor__textarea-wrapper">
          <textarea
            v-model="editingCss"
            class="css-editor__textarea"
            :placeholder="t('setting.customCss.editorPlaceholder')"
            spellcheck="false"
            data-testid="custom-css-editor-textarea"
          />
        </div>
        <div class="flex justify-end gap-2 mt-3">
          <v-btn
            variant="text"
            size="small"
            @click="onCancelEdit"
          >
            {{ t('setting.customCss.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            size="small"
            :disabled="!editingCss.trim()"
            data-testid="custom-css-editor-save-btn"
            @click="onSaveEdit"
          >
            <v-icon start size="small">save</v-icon>
            {{ t('setting.customCss.save') }}
          </v-btn>
        </div>
      </div>
    </v-expand-transition>
  </SettingCard>
</template>

<script setup lang="ts">
import SettingCard from '@/components/SettingCard.vue'
import { kCustomCss } from '@/composables/customCss'
import { injection } from '@/util/inject'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CustomCssEntry } from '@xmcl/runtime-api'

const { t } = useI18n()
const {
  globalEnabled,
  entries,
  toggleGlobal,
  addFromText,
  addFromFile,
  updateEntry,
  removeEntry,
  exportEntry,
} = injection(kCustomCss)

const editingEntry = ref<CustomCssEntry | null>(null)
const editingName = ref('')
const editingCss = ref('')
const isNewEntry = ref(false)

function onToggleGlobal(v: boolean | null) {
  toggleGlobal(v ?? false)
}

function onToggleEntry(id: string, enabled: boolean | null) {
  updateEntry(id, { enabled: enabled ?? false })
}

function onEditEntry(entry: CustomCssEntry) {
  if (editingEntry.value?.id === entry.id) {
    editingEntry.value = null
    return
  }
  editingEntry.value = entry
  editingName.value = entry.name
  editingCss.value = entry.css
  isNewEntry.value = false
}

function onAddNew() {
  editingEntry.value = {
    id: '__new__',
    name: '',
    css: '',
    enabled: true,
    source: 'manual',
    createdAt: Date.now(),
  }
  editingName.value = ''
  editingCss.value = ''
  isNewEntry.value = true
}

function onCancelEdit() {
  editingEntry.value = null
  editingName.value = ''
  editingCss.value = ''
  isNewEntry.value = false
}

async function onSaveEdit() {
  if (!editingCss.value.trim()) return

  if (isNewEntry.value) {
    await addFromText(
      editingName.value.trim() || 'Untitled',
      editingCss.value,
    )
  } else if (editingEntry.value) {
    await updateEntry(editingEntry.value.id, {
      name: editingName.value.trim() || editingEntry.value.name,
      css: editingCss.value,
    })
  }

  editingEntry.value = null
  editingName.value = ''
  editingCss.value = ''
  isNewEntry.value = false
}

async function onRemoveEntry(id: string) {
  if (editingEntry.value?.id === id) {
    onCancelEdit()
  }
  await removeEntry(id)
}

async function onExportEntry(entry: CustomCssEntry) {
  const { filePath } = await windowController.showSaveDialog({
    title: t('setting.customCss.exportFile'),
    defaultPath: `${entry.name}.css`,
    filters: [
      { name: 'CSS', extensions: ['css'] },
    ],
  })
  if (filePath) {
    await exportEntry(entry.id, filePath)
  }
}

async function onImportFile() {
  const { filePaths } = await windowController.showOpenDialog({
    title: t('setting.customCss.importFile'),
    properties: ['openFile'],
    filters: [
      { name: 'CSS', extensions: ['css'] },
    ],
  })
  if (filePaths && filePaths[0]) {
    await addFromFile(filePaths[0])
  }
}

</script>

<style scoped>
.css-entries-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-radius: 8px;
  overflow: hidden;
}

.css-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  transition: background 0.15s ease;
}

.css-entry:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.css-entry--active {
  background: rgba(var(--v-theme-primary), 0.12);
}

.css-entry__info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.css-entry__toggle {
  flex-shrink: 0;
}

.css-entry__name {
  font-weight: 500;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.css-entry__source {
  flex-shrink: 0;
  font-size: 0.7rem !important;
}

.css-entry__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.css-editor {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  padding: 16px;
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.css-editor__textarea-wrapper {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.css-editor__textarea {
  width: 100%;
  min-height: 200px;
  max-height: 400px;
  resize: vertical;
  padding: 12px;
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  background: rgba(0, 0, 0, 0.2);
  color: inherit;
  border: none;
  outline: none;
  tab-size: 2;
}

.css-editor__textarea::placeholder {
  opacity: 0.4;
}

.css-editor__textarea:focus {
  background: rgba(0, 0, 0, 0.3);
}
</style>
