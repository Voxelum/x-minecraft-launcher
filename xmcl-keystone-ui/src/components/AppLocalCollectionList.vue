<template>
  <div class="local-collection-list w-full" data-testid="local-collection-list">
    <div class="filter-subheader flex items-center justify-between pr-2">
      <div class="flex items-center">
        <v-icon size="16" class="mr-1">folder_special</v-icon>
        {{ t('localCollection.title') }}
      </div>
      <div v-if="mode === 'select'" class="flex items-center gap-1">
        <v-btn
          v-if="currentInstanceMods.length > 0"
          v-shared-tooltip="t('localCollection.saveCurrentMods')"
          icon
          size="x-small"
          variant="text"
          color="primary"
          @click="showSaveModsDialog = true"
        >
          <v-icon size="16">bookmark_add</v-icon>
        </v-btn>
        <v-btn
          v-shared-tooltip="t('localCollection.importCollection')"
          icon
          size="x-small"
          variant="text"
          @click="triggerImport"
        >
          <v-icon size="16">file_upload</v-icon>
        </v-btn>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          class="hidden"
          @change="onFileSelected"
        />
      </div>
    </div>

    <v-alert
      v-if="corrupted"
      type="warning"
      density="compact"
      variant="tonal"
      class="mx-2 my-1 text-caption"
      data-testid="local-collection-corrupted"
    >
      {{ t('localCollection.corrupted') }}
    </v-alert>

    <div
      v-if="collections.length === 0 && !creating"
      class="px-4 py-2 text-caption text-medium-emphasis"
      data-testid="local-collection-empty"
    >
      {{ t('localCollection.empty') }}
    </div>

    <v-list
      nav
      bgColor="transparent"
      class="w-full"
      :selected="selectedValues"
      @update:selected="onSelect"
    >
      <template v-for="c of listItems" :key="c.id">
        <v-list-item
          :value="c.selectionValue"
          color="primary"
          data-testid="local-collection-item"
          class="group"
          @click="onItemClick(c.id)"
        >
          <template #prepend>
            <v-avatar size="32" class="mr-1">
              <v-icon v-if="mode === 'add'" :color="c.contains ? 'primary' : undefined" size="20">
                {{ c.contains ? 'check_circle' : 'folder' }}
              </v-icon>
              <v-icon v-else size="20">folder</v-icon>
            </v-avatar>
          </template>
          <v-list-item-title class="font-medium text-sm">{{ c.name }}</v-list-item-title>
          <v-list-item-subtitle class="text-xs">
            {{ t('localCollection.projects', { count: c.count }, c.count) }}
          </v-list-item-subtitle>
          <template v-if="mode === 'select'" #append>
            <div class="flex items-center gap-0.5">
              <v-btn
                v-shared-tooltip="t('localCollection.addMods')"
                icon
                size="x-small"
                variant="text"
                color="primary"
                @click.stop="openAddModsModal(c.raw)"
              >
                <v-icon size="16">add</v-icon>
              </v-btn>
              <v-btn
                v-shared-tooltip="t('localCollection.viewMods')"
                icon
                size="x-small"
                variant="text"
                @click.stop="toggleExpand(c.id)"
              >
                <v-icon size="16">{{ expandedIds[c.id] ? 'expand_less' : 'expand_more' }}</v-icon>
              </v-btn>
              <v-btn
                v-shared-tooltip="t('localCollection.editCollection')"
                icon
                size="x-small"
                variant="text"
                @click.stop="startEdit(c.raw)"
              >
                <v-icon size="14">edit</v-icon>
              </v-btn>
              <v-btn
                v-shared-tooltip="t('localCollection.exportCollection')"
                icon
                size="x-small"
                variant="text"
                @click.stop="exportCollection(c.raw)"
              >
                <v-icon size="14">file_download</v-icon>
              </v-btn>
              <v-btn
                v-shared-tooltip="t('shared.delete')"
                icon
                size="x-small"
                variant="text"
                :loading="deletingId === c.id"
                :aria-label="t('shared.delete')"
                data-testid="local-collection-delete"
                @click.stop="onDelete(c.id)"
              >
                <v-icon size="14">delete</v-icon>
              </v-btn>
            </div>
          </template>
        </v-list-item>

        <!-- Expanded view: show list of mods in collection -->
        <div
          v-if="expandedIds[c.id]"
          class="ml-6 mr-2 mb-2 p-2.5 rounded-xl border border-white/10 bg-white/[0.03] flex flex-col gap-1.5"
        >
          <!-- Empty State -->
          <div
            v-if="c.raw.mods.length === 0 && c.raw.resourcepacks.length === 0 && c.raw.shaderpacks.length === 0"
            class="py-3 px-2 flex flex-col items-center text-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-white/[0.02]"
          >
            <v-icon size="24" color="primary" class="opacity-70">playlist_add</v-icon>
            <div class="text-xs font-semibold">{{ t('localCollection.noModsInCollection') }}</div>
            <div class="text-[11px] text-medium-emphasis mb-1">
              {{ t('localCollection.addModsHint') }}
            </div>
            <div class="flex items-center gap-2">
              <v-btn
                size="x-small"
                variant="flat"
                color="primary"
                rounded="lg"
                prepend-icon="add"
                @click.stop="openAddModsModal(c.raw)"
              >
                {{ t('localCollection.addMods') }}
              </v-btn>
              <v-btn
                v-if="currentInstanceMods.length > 0"
                size="x-small"
                variant="tonal"
                rounded="lg"
                prepend-icon="bookmark_add"
                @click.stop="addAllCurrentModsTo(c.raw)"
              >
                {{ t('localCollection.addAllCurrent') }}
              </v-btn>
            </div>
          </div>

          <!-- Entries List -->
          <template v-else>
            <div class="flex items-center justify-between px-1 pb-1 border-b border-white/5">
              <span class="text-[11px] font-semibold text-medium-emphasis uppercase tracking-wider">
                {{ t('localCollection.projects', { count: c.count }, c.count) }}
              </span>
              <div class="flex items-center gap-1">
                <v-btn
                  size="x-small"
                  variant="text"
                  color="primary"
                  density="compact"
                  prepend-icon="add"
                  @click.stop="openAddModsModal(c.raw)"
                >
                  {{ t('localCollection.addMods') }}
                </v-btn>
                <v-btn
                  v-if="currentInstanceMods.length > 0"
                  size="x-small"
                  variant="text"
                  density="compact"
                  prepend-icon="bookmark_add"
                  v-shared-tooltip="t('localCollection.addAllCurrent')"
                  @click.stop="addAllCurrentModsTo(c.raw)"
                />
              </div>
            </div>

            <div
              v-for="entry in c.raw.mods"
              :key="entry.provider + entry.projectId"
              class="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] transition-colors"
            >
              <div class="flex items-center gap-2 min-w-0">
                <v-icon size="14" :color="entry.provider === 'modrinth' ? 'primary' : 'warning'">
                  {{ entry.provider === 'modrinth' ? 'xmcl:modrinth' : 'xmcl:curseforge' }}
                </v-icon>
                <span class="truncate font-medium text-[11px]">{{ getModTitle(entry) }}</span>
              </div>
              <v-btn
                v-shared-tooltip="t('localCollection.removeEntryConfirm')"
                icon="close"
                size="x-small"
                variant="text"
                density="compact"
                class="opacity-60 hover:opacity-100"
                @click.stop="removeEntry({ collectionId: c.id, contentType: 'mods', entry })"
              />
            </div>
          </template>
        </div>
      </template>

      <!-- Inline create -->
      <v-list-item v-if="creating" data-testid="local-collection-create-row">
        <v-text-field
          ref="createField"
          v-model="newName"
          density="compact"
          hide-details
          autofocus
          :placeholder="t('localCollection.namePlaceholder')"
          data-testid="local-collection-name-input"
          @keydown.enter="onCreate"
          @keydown.esc="creating = false"
        >
          <template #append-inner>
            <v-btn
              icon
              variant="text"
              size="x-small"
              :disabled="!newName.trim()"
              data-testid="local-collection-create-confirm"
              @click="onCreate"
            >
              <v-icon size="small">check</v-icon>
            </v-btn>
          </template>
        </v-text-field>
      </v-list-item>
      <v-list-item
        v-else
        color="primary"
        :title="t('localCollection.newCollection')"
        data-testid="local-collection-new"
        @click="creating = true"
      >
        <template #prepend>
          <v-icon size="20">add</v-icon>
        </template>
      </v-list-item>
    </v-list>

    <!-- Edit Collection Dialog -->
    <v-dialog v-model="showEditDialog" max-width="480">
      <v-card class="rounded-2xl border border-white/10 p-4">
        <div class="text-base font-bold mb-3 flex items-center gap-2">
          <v-icon color="primary" size="20">edit</v-icon>
          {{ t('localCollection.editCollection') }}
        </div>
        <v-text-field
          v-model="editName"
          :label="t('localCollection.namePlaceholder')"
          variant="outlined"
          density="compact"
          class="mb-3"
          hide-details
          autofocus
        />
        <v-textarea
          v-model="editDescription"
          :label="t('localCollection.collectionDescription')"
          variant="outlined"
          density="compact"
          rows="3"
          hide-details
        />
        <div class="flex justify-end gap-2 mt-4">
          <v-btn variant="text" size="small" @click="showEditDialog = false">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            size="small"
            rounded="lg"
            :disabled="!editName.trim()"
            @click="onSaveEdit"
          >
            {{ t('shared.save') }}
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Save Current Instance Mods Dialog -->
    <v-dialog v-model="showSaveModsDialog" max-width="480">
      <v-card class="rounded-2xl border border-white/10 p-4">
        <div class="text-base font-bold mb-2 flex items-center gap-2">
          <v-icon color="primary" size="20">bookmark_add</v-icon>
          {{ t('localCollection.saveCurrentMods') }}
        </div>
        <div class="text-xs text-medium-emphasis mb-3">
          {{ t('mod.mods', { count: currentInstanceMods.length }) }}
        </div>
        <v-text-field
          v-model="saveModsName"
          :placeholder="t('localCollection.namePlaceholder')"
          variant="outlined"
          density="compact"
          hide-details
          autofocus
          @keydown.enter="onSaveCurrentMods"
        />
        <div class="flex justify-end gap-2 mt-4">
          <v-btn variant="text" size="small" @click="showSaveModsDialog = false">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            size="small"
            rounded="lg"
            :loading="savingMods"
            :disabled="!saveModsName.trim()"
            @click="onSaveCurrentMods"
          >
            {{ t('shared.save') }}
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Add Mods to Collection Dialog -->
    <v-dialog v-model="showAddModsDialog" max-width="560">
      <v-card class="rounded-2xl border border-white/10 p-4 max-h-[80vh] flex flex-col">
        <div class="text-base font-bold mb-2 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <v-icon color="primary" size="20">playlist_add</v-icon>
            <span>{{ t('localCollection.addModsTo', { name: targetCollection?.name }) }}</span>
          </div>
          <v-chip size="x-small" variant="tonal" color="primary">
            {{ selectedModKeys.length }} / {{ candidateMods.length }}
          </v-chip>
        </div>

        <div class="text-xs text-medium-emphasis mb-3">
          {{ t('localCollection.addModsDialogDesc') }}
        </div>

        <!-- Search & Selection toolbar -->
        <div class="flex items-center gap-2 mb-3">
          <v-text-field
            v-model="modSearchKeyword"
            density="compact"
            variant="outlined"
            rounded="lg"
            hide-details
            clearable
            prepend-inner-icon="search"
            :placeholder="t('localCollection.searchMods')"
            class="flex-1"
          />
          <v-btn
            size="small"
            variant="tonal"
            @click="selectAllCandidates"
          >
            {{ t('localCollection.selectAll') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            @click="selectedModKeys = []"
          >
            {{ t('localCollection.deselectAll') }}
          </v-btn>
        </div>

        <!-- Mod List -->
        <div class="flex-1 overflow-y-auto min-h-[200px] max-h-[380px] flex flex-col gap-1 pr-1">
          <div
            v-if="filteredCandidates.length === 0"
            class="flex flex-col items-center justify-center p-6 text-center text-medium-emphasis"
          >
            <v-icon size="32" class="opacity-40 mb-1">search_off</v-icon>
            <span class="text-xs">{{ t('localCollection.noMatchingMods') }}</span>
          </div>

          <div
            v-for="mod in filteredCandidates"
            :key="mod.key"
            class="flex items-center justify-between p-2 rounded-lg border border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
            :class="{
              'bg-primary/10 border-primary/20': selectedModKeys.includes(mod.key) && !mod.alreadyIn,
              'opacity-60 cursor-not-allowed': mod.alreadyIn,
            }"
            @click="!mod.alreadyIn && toggleModSelection(mod.key)"
          >
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <v-checkbox-btn
                :model-value="mod.alreadyIn || selectedModKeys.includes(mod.key)"
                :disabled="mod.alreadyIn"
                density="compact"
                hide-details
                color="primary"
                class="flex-grow-0 shrink-0"
                @click.stop="!mod.alreadyIn && toggleModSelection(mod.key)"
              />
              <v-avatar size="28" rounded="md" class="border border-white/10 shrink-0">
                <v-img v-if="mod.icon" :src="mod.icon" />
                <v-icon v-else size="16">xmcl:package</v-icon>
              </v-avatar>
              <div class="min-w-0 flex-1">
                <div class="text-xs font-medium truncate">{{ mod.name }}</div>
                <div class="text-[11px] text-medium-emphasis truncate font-mono">{{ mod.fileName }}</div>
              </div>
            </div>

            <div class="shrink-0 flex items-center gap-1.5 ml-2">
              <v-chip
                v-if="mod.provider"
                size="x-small"
                variant="tonal"
                :color="mod.provider === 'modrinth' ? 'primary' : 'warning'"
              >
                {{ mod.provider === 'modrinth' ? 'Modrinth' : 'CurseForge' }}
              </v-chip>
              <v-chip
                v-if="mod.alreadyIn"
                size="x-small"
                variant="flat"
                color="success"
              >
                {{ t('localCollection.alreadyInCollection') }}
              </v-chip>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-between pt-3 mt-2 border-t border-white/10">
          <span class="text-xs text-medium-emphasis">
            {{ selectedModKeys.length }} {{ t('localCollection.selected') }}
          </span>
          <div class="flex gap-2">
            <v-btn variant="text" size="small" @click="showAddModsDialog = false">
              {{ t('shared.cancel') }}
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              size="small"
              rounded="lg"
              :loading="addingMods"
              :disabled="selectedModKeys.length === 0"
              @click="onConfirmAddMods"
            >
              {{ t('localCollection.addSelectedMods', { count: selectedModKeys.length }) }}
            </v-btn>
          </div>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>
<script setup lang="ts">
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kLocalCollections, toLocalSelectionId, useLocalCollections } from '@/composables/localCollections'
import { useNotifier } from '@/composables/notifier'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { CollectionContentType, CollectionProvider, LocalCollection } from '@xmcl/runtime-api'

const props = withDefaults(defineProps<{
  select?: string
  /**
   * `select` (default): clicking a collection selects it for browsing.
   * `add`: clicking a collection toggles membership of the given project.
   */
  mode?: 'select' | 'add'
  provider?: CollectionProvider
  projectId?: string
  contentType?: CollectionContentType
}>(), {
  mode: 'select',
})

const emit = defineEmits<{
  'update:select': [value: string]
}>()

const { t } = useI18n()
const { notify } = useNotifier()
const {
  collections,
  corrupted,
  isInCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  addEntry,
  removeEntry,
} = inject(kLocalCollections, undefined) ?? useLocalCollections()

const instance = inject(kInstance, undefined)
const instanceMods = inject(kInstanceModsContext, undefined)
const currentInstanceMods = computed(() => instanceMods?.mods.value ?? [])

const creating = ref(false)
const newName = ref('')
const deletingId = ref('')

const expandedIds = ref<Record<string, boolean>>({})
function toggleExpand(id: string) {
  expandedIds.value[id] = !expandedIds.value[id]
}

// Edit dialog
const showEditDialog = ref(false)
const editingCollection = ref<LocalCollection | null>(null)
const editName = ref('')
const editDescription = ref('')

function startEdit(c: LocalCollection) {
  editingCollection.value = c
  editName.value = c.name
  editDescription.value = c.description || ''
  showEditDialog.value = true
}

async function onSaveEdit() {
  if (!editingCollection.value || !editName.value.trim()) return
  await updateCollection(editingCollection.value.id, {
    name: editName.value.trim(),
    description: editDescription.value.trim(),
  })
  showEditDialog.value = false
  editingCollection.value = null
}

// Save current mods
const showSaveModsDialog = ref(false)
const saveModsName = ref('')
const savingMods = ref(false)

watch(showSaveModsDialog, (show) => {
  if (show) {
    saveModsName.value = instance?.name.value ? `${instance.name.value} Mods` : 'My Mods'
  }
})

async function onSaveCurrentMods() {
  const currentMods = currentInstanceMods.value
  if (currentMods.length === 0) return
  const collectionName = saveModsName.value.trim() || 'My Mods'
  savingMods.value = true
  try {
    const created = await createCollection({ name: collectionName })
    let addedCount = 0
    for (const m of currentMods) {
      const modrinthId = m.modrinth?.projectId
      const curseforgeId = m.curseforge?.projectId
      if (modrinthId) {
        await addEntry({
          collectionId: created.id,
          contentType: 'mods',
          entry: { provider: 'modrinth', projectId: modrinthId },
        })
        addedCount++
      } else if (curseforgeId) {
        await addEntry({
          collectionId: created.id,
          contentType: 'mods',
          entry: { provider: 'curseforge', projectId: curseforgeId.toString() },
        })
        addedCount++
      }
    }
    showSaveModsDialog.value = false
    emit('update:select', toLocalSelectionId(created.id))
    notify({
      level: 'info',
      title: t('localCollection.saveCurrentMods'),
      body: t('localCollection.saveCurrentModsSuccess', { count: addedCount, name: collectionName }),
    })
  } finally {
    savingMods.value = false
  }
}

// Export / Import
function exportCollection(c: LocalCollection) {
  const json = JSON.stringify(c, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${c.name || 'collection'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const fileInputRef = ref<HTMLInputElement | null>(null)
function triggerImport() {
  fileInputRef.value?.click()
}

async function onFileSelected(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  const file = files[0]
  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed.name === 'string') {
      const created = await createCollection({
        name: parsed.name,
        description: parsed.description,
      })
      for (const type of ['mods', 'resourcepacks', 'shaderpacks'] as const) {
        if (Array.isArray(parsed[type])) {
          for (const entry of parsed[type]) {
            if (entry.provider && entry.projectId) {
              await addEntry({
                collectionId: created.id,
                contentType: type,
                entry,
              })
            }
          }
        }
      }
      emit('update:select', toLocalSelectionId(created.id))
      notify({
        level: 'info',
        title: t('localCollection.importCollection'),
        body: `Imported "${parsed.name}"`,
      })
    }
  } catch (err: any) {
    notify({
      level: 'error',
      title: t('localCollection.importCollection'),
      body: err.message,
    })
  } finally {
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

const listItems = computed(() => collections.value.map((c) => ({
  id: c.id,
  name: c.name,
  count: c.mods.length + c.resourcepacks.length + c.shaderpacks.length,
  selectionValue: toLocalSelectionId(c.id),
  raw: c,
  contains: props.mode === 'add' && !!props.provider && !!props.projectId && !!props.contentType
    ? isInCollection(c.id, props.contentType, { provider: props.provider, projectId: props.projectId })
    : false,
})))

const selectedValues = computed(() => props.mode === 'select' && props.select ? [props.select] : [])

function onSelect(values: unknown[]) {
  if (props.mode !== 'select') return
  const value = values[0] as string | undefined
  if (value) emit('update:select', value)
}

async function onItemClick(id: string) {
  if (props.mode !== 'add') return
  if (!props.provider || !props.projectId || !props.contentType) return
  const entry = { provider: props.provider, projectId: props.projectId }
  const options = { collectionId: id, contentType: props.contentType, entry }
  if (isInCollection(id, props.contentType, entry)) {
    await removeEntry(options)
  } else {
    await addEntry(options)
  }
}

async function onCreate() {
  const name = newName.value.trim()
  if (!name) return
  const created = await createCollection({ name })
  newName.value = ''
  creating.value = false
  if (props.mode === 'add' && props.provider && props.projectId && props.contentType) {
    // Creating from the add menu also adds the current project.
    await addEntry({
      collectionId: created.id,
      contentType: props.contentType,
      entry: { provider: props.provider, projectId: props.projectId },
    })
  } else {
    emit('update:select', toLocalSelectionId(created.id))
  }
}

async function onDelete(id: string) {
  deletingId.value = id
  try {
    await deleteCollection(id)
    if (props.select === toLocalSelectionId(id)) {
      emit('update:select', '')
    }
  } finally {
    deletingId.value = ''
  }
}

// Add Mods Modal & Resolution
const targetCollection = ref<LocalCollection | null>(null)
const showAddModsDialog = ref(false)
const modSearchKeyword = ref('')
const selectedModKeys = ref<string[]>([])
const addingMods = ref(false)

interface CandidateMod {
  key: string
  name: string
  fileName: string
  icon?: string
  provider?: 'modrinth' | 'curseforge'
  projectId?: string
  alreadyIn: boolean
}

const candidateMods = computed<CandidateMod[]>(() => {
  if (!targetCollection.value) return []
  const coll = targetCollection.value
  const result: CandidateMod[] = []

  for (const mod of currentInstanceMods.value) {
    let provider: 'modrinth' | 'curseforge' | undefined
    let projectId: string | undefined

    if (mod.modrinth?.projectId) {
      provider = 'modrinth'
      projectId = mod.modrinth.projectId
    } else if (mod.curseforge?.projectId) {
      provider = 'curseforge'
      projectId = String(mod.curseforge.projectId)
    }

    if (!provider || !projectId) {
      continue
    }

    const alreadyIn = coll.mods.some((m) => m.provider === provider && m.projectId === projectId)

    result.push({
      key: `${provider}:${projectId}`,
      name: mod.name || mod.fileName,
      fileName: mod.fileName,
      icon: mod.icon,
      provider,
      projectId,
      alreadyIn,
    })
  }

  return result
})

const filteredCandidates = computed(() => {
  const kw = modSearchKeyword.value.trim().toLowerCase()
  if (!kw) return candidateMods.value
  return candidateMods.value.filter(
    (m) => m.name.toLowerCase().includes(kw) || m.fileName.toLowerCase().includes(kw)
  )
})

function openAddModsModal(c: LocalCollection) {
  targetCollection.value = c
  modSearchKeyword.value = ''
  selectedModKeys.value = []
  showAddModsDialog.value = true
}

function selectAllCandidates() {
  selectedModKeys.value = filteredCandidates.value
    .filter((m) => !m.alreadyIn)
    .map((m) => m.key)
}

function toggleModSelection(key: string) {
  const idx = selectedModKeys.value.indexOf(key)
  if (idx >= 0) {
    selectedModKeys.value.splice(idx, 1)
  } else {
    selectedModKeys.value.push(key)
  }
}

async function onConfirmAddMods() {
  if (!targetCollection.value || selectedModKeys.value.length === 0) return
  addingMods.value = true
  const collId = targetCollection.value.id
  let count = 0
  try {
    for (const key of selectedModKeys.value) {
      const candidate = candidateMods.value.find((c) => c.key === key)
      if (candidate && candidate.provider && candidate.projectId) {
        await addEntry({
          collectionId: collId,
          contentType: 'mods',
          entry: {
            provider: candidate.provider,
            projectId: candidate.projectId,
          },
        })
        count++
      }
    }
    notify({
      level: 'info',
      title: t('localCollection.title'),
      body: t('localCollection.addedModsSuccess', { count }),
    })
    showAddModsDialog.value = false
  } catch (err: any) {
    notify({
      level: 'error',
      title: t('localCollection.title'),
      body: err.message,
    })
  } finally {
    addingMods.value = false
  }
}

async function addAllCurrentModsTo(c: LocalCollection) {
  let count = 0
  for (const mod of currentInstanceMods.value) {
    let provider: 'modrinth' | 'curseforge' | undefined
    let projectId: string | undefined
    if (mod.modrinth?.projectId) {
      provider = 'modrinth'
      projectId = mod.modrinth.projectId
    } else if (mod.curseforge?.projectId) {
      provider = 'curseforge'
      projectId = String(mod.curseforge.projectId)
    }
    if (provider && projectId) {
      const alreadyIn = c.mods.some((m) => m.provider === provider && m.projectId === projectId)
      if (!alreadyIn) {
        await addEntry({
          collectionId: c.id,
          contentType: 'mods',
          entry: { provider, projectId },
        })
        count++
      }
    }
  }
  notify({
    level: 'info',
    title: t('localCollection.title'),
    body: t('localCollection.addedModsSuccess', { count }),
  })
}

function getModTitle(entry: { provider: string; projectId: string }) {
  const found = currentInstanceMods.value.find((m) =>
    (entry.provider === 'modrinth' && m.modrinth?.projectId === entry.projectId) ||
    (entry.provider === 'curseforge' && String(m.curseforge?.projectId) === entry.projectId)
  )
  return found?.name || entry.projectId
}
</script>
