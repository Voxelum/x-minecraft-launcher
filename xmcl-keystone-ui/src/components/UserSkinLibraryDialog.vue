<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1040"
    content-class="elevation-0"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="skin-library-dialog rounded-2xl flex flex-row h-[680px] overflow-hidden border border-[rgba(var(--v-theme-on-surface),0.1)]">
      <!-- Left Panel: 3D Preview & Actions -->
      <div class="w-[330px] flex-shrink-0 flex flex-col items-center justify-between p-6 border-r border-[rgba(var(--v-theme-on-surface),0.08)] bg-black/25">
        <!-- Top Info Header -->
        <div class="w-full flex items-center justify-between">
          <div class="text-xs font-bold uppercase tracking-wider opacity-60">
            {{ t('userSkin.preview') }}
          </div>
          <v-chip
            size="small"
            :color="previewSlim ? 'purple' : 'blue'"
            variant="tonal"
            class="font-medium"
          >
            {{ previewSlim ? t('userSkin.slim') : t('userSkin.classic') }}
          </v-chip>
        </div>

        <!-- 3D Skin Viewer -->
        <div class="w-full flex-1 flex items-center justify-center my-2 relative">
          <SkinView
            v-if="previewUrl"
            :paused="false"
            :height="330"
            :skin="previewUrl"
            :slim="previewSlim"
            :cape="currentCape"
            :name="''"
            animation="idle"
            @model="onModelDetected"
          />
          <div v-else class="flex flex-col items-center gap-3 text-center opacity-40">
            <v-icon size="56">person</v-icon>
            <span class="text-sm font-medium">{{ t('userSkin.previewPlaceholder') }}</span>
          </div>
        </div>

        <!-- Selected Skin Title & Controls -->
        <div class="w-full flex flex-col gap-3">
          <div class="text-center">
            <div class="text-base font-bold truncate px-2" :title="selectedSkin?.name">
              {{ selectedSkin?.name || t('userSkin.noSkinSelected') }}
            </div>
            <div v-if="isCurrentlyEquipped" class="text-xs text-green-400 font-medium flex items-center justify-center gap-1 mt-1">
              <v-icon size="14">check_circle</v-icon>
              {{ t('userSkin.currentlyActive') }}
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col gap-2.5">
            <v-btn
              :color="isCurrentlyEquipped ? 'success' : 'primary'"
              :variant="isCurrentlyEquipped ? 'tonal' : 'elevated'"
              size="large"
              block
              class="rounded-xl font-semibold"
              :disabled="isEditorOpen || !selectedSkin || isCurrentlyEquipped || isUploading || !canUploadSkin"
              :loading="isUploading"
              @click="equipSelectedSkin()"
            >
              <v-icon start>{{ isCurrentlyEquipped ? 'check_circle' : 'check' }}</v-icon>
              {{ isCurrentlyEquipped ? t('userSkin.equipped') : t('userSkin.equipToAccount') }}
            </v-btn>

            <div class="flex items-center gap-2">
              <v-btn
                variant="tonal"
                size="default"
                class="flex-1 rounded-xl"
                height="40"
                :disabled="isEditorOpen || !canSaveCurrentToLibrary"
                @click="saveCurrentToLibrary"
              >
                <v-icon start size="16">bookmark_add</v-icon>
                {{ t('userSkin.saveCurrent') }}
              </v-btn>

              <v-btn
                variant="tonal"
                size="default"
                icon
                class="rounded-xl"
                width="40"
                height="40"
                :title="t('userSkin.saveTitle')"
                :disabled="isEditorOpen || !selectedSkin"
                @click="exportSelectedSkin"
              >
                <v-icon size="18">download</v-icon>
              </v-btn>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel -->
      <div class="flex-1 flex flex-col p-6 overflow-hidden bg-surface">
        <template v-if="isEditorOpen">
          <div class="flex items-center justify-between gap-3 mb-5">
            <div class="flex items-center gap-3 min-w-0">
              <v-btn icon size="small" variant="text" @click="closeEditor">
                <v-icon>arrow_back</v-icon>
              </v-btn>
              <div class="min-w-0">
                <h2 class="text-xl font-bold truncate">
                  {{ editingSkin ? t('userSkin.editSkin') : t('userSkin.addNewSkin') }}
                </h2>
                <div class="text-xs opacity-50 mt-0.5">
                  {{ t('userSkin.librarySubtitle') }}
                </div>
              </div>
            </div>

            <v-btn icon size="small" variant="text" @click="$emit('update:modelValue', false)">
              <v-icon>close</v-icon>
            </v-btn>
          </div>

          <div class="flex-1 min-h-0 flex flex-col justify-between">
            <div class="flex flex-col gap-5 overflow-y-auto pr-1">
              <div>
                <div class="text-xs font-bold uppercase opacity-70 mb-2">
                  {{ t('userSkin.skinName') }}
                </div>
                <v-text-field
                  v-model="draftName"
                  :placeholder="t('userSkin.skinNamePlaceholder')"
                  variant="outlined"
                  density="comfortable"
                  hide-details
                />
              </div>

              <div>
                <v-btn-toggle
                  v-model="draftSlim"
                  mandatory
                  density="comfortable"
                  class="w-full surface-panel"
                  rounded="lg"
                >
                  <v-btn :value="false" class="flex-1 font-semibold">
                    <v-icon size="18" class="mr-2">accessibility_new</v-icon>
                    {{ t('userSkin.classic') }}
                  </v-btn>
                  <v-btn :value="true" class="flex-1 font-semibold">
                    <v-icon size="18" class="mr-2">accessibility</v-icon>
                    {{ t('userSkin.slim') }}
                  </v-btn>
                </v-btn-toggle>
              </div>

              <div v-if="!editingSkin">
                <v-tabs v-model="importTab" density="compact" color="primary" class="mb-3">
                  <v-tab value="file" class="font-semibold text-sm">
                    <v-icon size="19" class="mr-2">folder_open</v-icon>
                    {{ t('userSkin.localFile') }}
                  </v-tab>
                  <v-tab value="url" class="font-semibold text-sm">
                    <v-icon size="19" class="mr-2">link</v-icon>
                    {{ t('userSkin.urlOrPlayer') }}
                  </v-tab>
                </v-tabs>

                <v-window v-model="importTab">
                  <v-window-item value="file">
                    <div
                      class="file-drop-zone min-h-[205px] border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5"
                      :class="draftUrl ? 'border-primary/60 bg-primary/5' : 'border-[rgba(var(--v-theme-on-surface),0.15)]'"
                      @click="pickFile"
                      @drop.prevent="onDropFile"
                      @dragover.prevent
                    >
                      <v-icon size="46" color="primary" class="mb-3">upload_file</v-icon>
                      <div class="text-base font-bold">{{ t('userSkin.dropFileHere') }}</div>
                      <div class="text-xs opacity-50 mt-1.5">{{ t('userSkin.supportedFormats') }}</div>
                    </div>
                  </v-window-item>

                  <v-window-item value="url">
                    <div class="min-h-[205px] flex flex-col justify-center gap-3">
                      <div class="flex gap-2.5 items-center">
                        <v-text-field
                          v-model="urlInput"
                          :placeholder="t('userSkin.urlOrPlayerPlaceholder')"
                          variant="outlined"
                          density="comfortable"
                          hide-details
                          class="flex-1"
                          :loading="isFetchingUrl"
                          @keydown.enter.prevent="fetchFromUrl"
                        />
                        <v-btn
                          color="primary"
                          variant="tonal"
                          height="48"
                          class="rounded-lg px-5 font-semibold flex-shrink-0"
                          :loading="isFetchingUrl"
                          :disabled="!urlInput"
                          @click="fetchFromUrl"
                        >
                          <v-icon start size="18">download</v-icon>
                          {{ t('userSkin.fetch') }}
                        </v-btn>
                      </div>
                      <div class="text-xs opacity-60 px-1">
                        {{ t('userSkin.urlOrPlayerHint') }}
                      </div>
                    </div>
                  </v-window-item>
                </v-window>
              </div>
            </div>

            <div class="flex items-center justify-end gap-3 mt-5 pt-5 border-t border-[rgba(var(--v-theme-on-surface),0.08)]">
              <v-btn variant="text" class="rounded-lg px-5" @click="closeEditor">
                {{ t('shared.cancel') }}
              </v-btn>
              <v-btn
                color="primary"
                class="rounded-lg px-6 font-semibold"
                :disabled="!canSaveDraft"
                @click="saveDraft(false)"
              >
                {{ editingSkin ? t('shared.save') : t('userSkin.saveToLibrary') }}
              </v-btn>
              <v-btn
                v-if="!editingSkin"
                color="success"
                class="rounded-lg px-6 font-semibold"
                :disabled="!canSaveDraft"
                @click="saveDraft(true)"
              >
                {{ t('userSkin.saveAndEquip') }}
              </v-btn>
            </div>
          </div>
        </template>

        <template v-else>
        <!-- Top Toolbar -->
        <div class="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 class="text-xl font-bold flex items-center gap-2">
              <v-icon color="primary" size="24">accessibility</v-icon>
              {{ t('userSkin.libraryTitle') }}
            </h2>
            <div class="text-xs opacity-50 mt-0.5">
              {{ t('userSkin.librarySubtitle') }}
            </div>
          </div>

          <div class="flex items-center gap-2">
            <v-btn
              color="primary"
              size="default"
              class="rounded-xl font-medium"
              @click="openAddEditor"
            >
              <v-icon start size="18">add</v-icon>
              {{ t('userSkin.newSkin') }}
            </v-btn>

            <v-btn
              icon
              size="small"
              variant="text"
              @click="$emit('update:modelValue', false)"
            >
              <v-icon>close</v-icon>
            </v-btn>
          </div>
        </div>

        <!-- Filter and Search Row -->
        <div class="flex items-center justify-between gap-3 mb-4">
          <v-text-field
            v-model="searchQuery"
            :placeholder="t('shared.search')"
            prepend-inner-icon="search"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            class="max-w-[280px]"
          />

          <div class="text-xs opacity-60 font-medium px-2 py-1 rounded-md bg-[rgba(var(--v-theme-on-surface),0.05)]">
            {{ customSkins.length }} {{ t('userSkin.savedCount') }}
          </div>
        </div>

        <!-- Skins Grid (Scrollable) -->
        <div class="flex-1 overflow-y-auto pr-1">
          <div
            v-if="filteredSkins.length > 0"
            class="grid grid-cols-4 gap-3"
          >
            <UserSkinCard
              v-for="item in filteredSkins"
              :key="item.id"
              :skin="item"
              :is-selected="selectedSkin?.id === item.id"
              :is-equipped="isItemEquipped(item)"
              @select="selectedSkin = item"
              @equip="onEquipItem"
              @edit="onEditItem"
              @delete="onDeleteItem"
            />
          </div>

          <!-- Empty State -->
          <div
            v-else
            class="w-full h-full flex flex-col items-center justify-center text-center opacity-50 py-16"
          >
            <v-icon size="56" class="mb-3">face</v-icon>
            <div class="text-base font-semibold">{{ t('userSkin.noSkinsFound') }}</div>
            <div class="text-xs opacity-60 mt-1 max-w-[280px]">{{ t('userSkin.tryAddingOne') }}</div>
          </div>
        </div>
        </template>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import SkinView from '@/components/SkinView.vue'
import UserSkinCard from '@/components/UserSkinCard.vue'
import { getDropFilePaths } from '@/composables/dropHandler'
import { useLocaleError } from '@/composables/error'
import { useNotifier } from '@/composables/notifier'
import { SkinLibraryItem, useUserSkinLibrary } from '@/composables/userSkinLibrary'
import { UserSkinModel } from '@/composables/userSkin'
import { GameProfileAndTexture, UserProfile } from '@xmcl/runtime-api'

const props = defineProps<{
  modelValue: boolean
  user: UserProfile
  profile: GameProfileAndTexture
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()
const { notify } = useNotifier()
const toLocaleError = useLocaleError()
const { customSkins, allSkins, equippedSkinIds, addSkin, removeSkin, updateSkin, setEquippedSkin, fetchSkinFromUsername } = useUserSkinLibrary()
const { showOpenDialog } = windowController

const skinModel = inject(UserSkinModel)
const canUploadSkin = computed(() => skinModel?.canUploadSkin.value ?? false)

const searchQuery = ref('')
const selectedSkin = ref<SkinLibraryItem | null>(null)
const isEditorOpen = ref(false)
const editingSkin = ref<SkinLibraryItem | null>(null)
const isUploading = ref(false)
const draftName = ref('')
const draftUrl = ref('')
const draftSlim = ref(false)
const importTab = ref('file')
const urlInput = ref('')
const isFetchingUrl = ref(false)

const currentCape = computed(() => skinModel?.cape.value)
const previewUrl = computed(() => isEditorOpen.value ? draftUrl.value : selectedSkin.value?.url || '')
const previewSlim = computed(() => isEditorOpen.value ? draftSlim.value : selectedSkin.value?.slim || false)
const canSaveDraft = computed(() => !!draftUrl.value && !!draftName.value.trim())
const activeProfileSkinUrl = computed(() => (props.profile?.skins ? props.profile.skins.find(s => s.state === 'ACTIVE')?.url : undefined) || props.profile?.textures?.SKIN?.url || '')
const accountKey = computed(() => `${props.user.id}:${props.profile.id}`)
const activeProfileSlim = computed(() => {
  const active = props.profile?.skins?.find(s => s.state === 'ACTIVE')
  if (active) return active.variant === 'SLIM'
  return props.profile?.textures?.SKIN?.metadata?.model === 'slim'
})

const filteredSkins = computed(() => {
  if (!searchQuery.value) return allSkins.value
  const q = searchQuery.value.toLowerCase()
  return allSkins.value.filter(s => s.name.toLowerCase().includes(q))
})

const currentEquippedSkinId = computed(() => {
  if (activeProfileSkinUrl.value) {
    const found = allSkins.value.find(s => s.url === activeProfileSkinUrl.value)
    if (found) return found.id
  }
  const equippedSkinId = equippedSkinIds.value[accountKey.value]
  if (equippedSkinId && allSkins.value.some(s => s.id === equippedSkinId)) {
    return equippedSkinId
  }
  return ''
})

const isCurrentlyEquipped = computed(() => {
  if (!selectedSkin.value) return false
  return isItemEquipped(selectedSkin.value)
})

function isItemEquipped(item: SkinLibraryItem): boolean {
  return item.id === currentEquippedSkinId.value
}

const canSaveCurrentToLibrary = computed(() => {
  if (!activeProfileSkinUrl.value) return false
  return !customSkins.value.some(s => s.url === activeProfileSkinUrl.value)
})

watch(() => props.modelValue, (open) => {
  if (open) {
    isEditorOpen.value = false
    editingSkin.value = null
    const active = allSkins.value.find(s => isItemEquipped(s))
    if (active) {
      selectedSkin.value = active
    } else if (activeProfileSkinUrl.value) {
      selectedSkin.value = {
        id: 'current',
        name: props.profile?.name || t('userSkin.currentSkin'),
        url: activeProfileSkinUrl.value,
        slim: activeProfileSlim.value,
        dateAdded: Date.now(),
      }
    } else if (allSkins.value.length > 0) {
      selectedSkin.value = allSkins.value[0]
    }
  }
})

function openAddEditor() {
  editingSkin.value = null
  draftName.value = ''
  draftUrl.value = ''
  draftSlim.value = false
  urlInput.value = ''
  importTab.value = 'file'
  isEditorOpen.value = true
}

function onEditItem(item: SkinLibraryItem) {
  editingSkin.value = item
  draftName.value = item.name
  draftUrl.value = item.url
  draftSlim.value = item.slim
  isEditorOpen.value = true
}

function closeEditor() {
  isEditorOpen.value = false
  editingSkin.value = null
}

function onModelDetected(modelType: 'default' | 'slim') {
  if (isEditorOpen.value && !editingSkin.value && !draftUrl.value.includes('http://launcher/media')) {
    draftSlim.value = modelType === 'slim'
  }
}

async function pickFile() {
  const { filePaths } = await showOpenDialog({
    title: t('userSkin.importFile'),
    filters: [{ extensions: ['png'], name: 'PNG Images' }],
  })
  if (filePaths?.[0]) setFileSkin(filePaths[0])
}

function onDropFile(event: DragEvent) {
  if (!event.dataTransfer) return
  const [filePath] = getDropFilePaths(event.dataTransfer.files)
  if (filePath?.toLowerCase().endsWith('.png')) setFileSkin(filePath)
}

function setFileSkin(filePath: string) {
  draftUrl.value = `http://launcher/media?path=${filePath}`
  if (!draftName.value) {
    draftName.value = filePath.split(/[/\\]/).pop()?.replace(/\.png$/i, '') || 'Skin'
  }
}

async function fetchFromUrl() {
  const input = urlInput.value.trim()
  if (!input) return
  isFetchingUrl.value = true
  try {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      draftUrl.value = input
      if (!draftName.value) draftName.value = 'Web Skin'
    } else {
      const resolved = await fetchSkinFromUsername(input)
      draftUrl.value = resolved.url
      draftSlim.value = resolved.slim
      if (!draftName.value) draftName.value = input
    }
  } catch (e) {
    notify({ level: 'error', title: t('shared.failed'), body: toLocaleError(e) })
  } finally {
    isFetchingUrl.value = false
  }
}

async function onDeleteItem(item: SkinLibraryItem) {
  try {
    await removeSkin(item.id)
    if (selectedSkin.value?.id === item.id) {
      selectedSkin.value = allSkins.value[0] || null
    }
    notify({ level: 'info', title: t('userSkin.skinDeleted') })
  } catch (e) {
    notify({ level: 'error', title: t('userSkin.skinDeleteFailed'), body: toLocaleError(e) })
  }
}

async function saveDraft(equipImmediately: boolean) {
  if (!canSaveDraft.value) return
  try {
    if (editingSkin.value) {
      const updated = await updateSkin(editingSkin.value.id, { name: draftName.value.trim(), slim: draftSlim.value })
      selectedSkin.value = updated
      notify({ level: 'success', title: t('userSkin.skinUpdated') })
    } else {
      const created = await addSkin({ name: draftName.value.trim(), url: draftUrl.value, slim: draftSlim.value })
      selectedSkin.value = created
      notify({ level: 'success', title: t('userSkin.skinAdded') })
      if (equipImmediately) {
        await equipSelectedSkin(created)
      }
    }
    closeEditor()
  } catch (e) {
    notify({ level: 'error', title: t('userSkin.saveFailed'), body: toLocaleError(e) })
  }
}

async function saveCurrentToLibrary() {
  if (!activeProfileSkinUrl.value) return
  try {
    const name = props.profile?.name ? `${props.profile.name}'s Skin` : 'My Skin'
    const saved = await addSkin({
      name,
      url: activeProfileSkinUrl.value,
      slim: activeProfileSlim.value,
    })
    selectedSkin.value = saved
    notify({ level: 'success', title: t('userSkin.skinAdded') })
  } catch (e) {
    notify({ level: 'error', title: t('userSkin.saveFailed'), body: toLocaleError(e) })
  }
}

async function exportSelectedSkin() {
  if (!selectedSkin.value) return
  const { showSaveDialog } = windowController
  const { filePath } = await showSaveDialog({
    title: t('userSkin.saveTitle'),
    defaultPath: `${selectedSkin.value.name}.png`,
    filters: [{ extensions: ['png'], name: 'PNG Images' }],
  })
  if (filePath && skinModel?.exportTo) {
    try {
      await skinModel.exportTo({ path: filePath, url: selectedSkin.value.url })
      notify({ level: 'success', title: t('userSkin.saveSuccess') })
    } catch (e) {
      notify({
        level: 'error',
        title: t('userSkin.saveFailed'),
        body: toLocaleError(e),
      })
    }
  }
}

async function equipSelectedSkin(targetSkin?: SkinLibraryItem) {
  const item = targetSkin || selectedSkin.value
  if (!item || !item.url || !skinModel) return
  isUploading.value = true
  try {
    skinModel.skin.value = item.url
    skinModel.slim.value = item.slim
    await skinModel.save()
    await setEquippedSkin(accountKey.value, item.id)
    selectedSkin.value = item
  } catch (e) {
    notify({
      level: 'error',
      title: t('userSkin.uploadFailed'),
      body: toLocaleError(e),
    })
  } finally {
    isUploading.value = false
  }
}

function onEquipItem(item: SkinLibraryItem) {
  selectedSkin.value = item
  equipSelectedSkin(item)
}
</script>

<style scoped>
.skin-library-dialog {
  background: rgba(var(--v-theme-surface), 0.95);
  backdrop-filter: blur(20px);
}

.file-drop-zone {
  background: rgba(var(--v-theme-surface), 0.5);
}
</style>
