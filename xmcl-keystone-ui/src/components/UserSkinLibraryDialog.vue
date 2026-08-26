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
            v-if="modelValue && previewUrl"
            :paused="false"
            :height="330"
            :skin="previewUrl"
            :slim="previewSlim"
            :cape="currentCape"
            :name="''"
            animation="idle"
            @model="onModelDetected"
            @error="onSkinLoadError"
          />
          <div v-else class="flex flex-col items-center gap-3 text-center opacity-40">
            <v-icon size="56">person</v-icon>
            <span class="text-sm font-medium">{{ t('userSkin.previewPlaceholder') }}</span>
          </div>
        </div>

        <!-- Selected Skin Title & Controls -->
        <div class="w-full flex flex-col gap-3">
          <div class="text-center">
            <div class="text-base font-bold truncate px-2" :title="previewName">
              {{ previewName || t('userSkin.noSkinSelected') }}
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col gap-2.5">
            <v-btn
              :color="isCurrentlyEquipped ? 'success' : 'primary'"
              :variant="isCurrentlyEquipped ? 'tonal' : 'elevated'"
              size="large"
              block
              class="font-semibold"
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
                class="flex-1"
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

          <div v-if="loadSkinError" class="mb-4 flex-none">
            <v-alert
              type="error"
              variant="tonal"
              density="compact"
              closable
              @click:close="loadSkinError = ''"
            >
              {{ loadSkinError }}
            </v-alert>
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
                      <v-select
                        v-model="selectedAuthority"
                        :items="authorityItems"
                        item-title="title"
                        item-value="value"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                        class="w-full flex-grow-0"
                      >
                        <template #selection="{ item }">
                          <div class="flex items-center gap-2 min-w-0">
                            <v-avatar v-if="item.icon" :image="item.icon" size="20" />
                            <v-icon v-else size="20">public</v-icon>
                            <span class="truncate">{{ item.title }}</span>
                          </div>
                        </template>
                        <template #item="{ props: itemProps, item }">
                          <v-list-item v-bind="itemProps">
                            <template #prepend>
                              <v-avatar v-if="item.icon" :image="item.icon" size="22" />
                              <v-icon v-else size="22">public</v-icon>
                            </template>
                          </v-list-item>
                        </template>
                      </v-select>
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
                          class="px-5 font-semibold flex-shrink-0"
                          :loading="isFetchingUrl"
                          :disabled="!urlInput"
                          @click="fetchFromUrl"
                        >
                          <v-icon start size="18">download</v-icon>
                          {{ t('userSkin.fetch') }}
                        </v-btn>
                      </div>
                    </div>
                  </v-window-item>
                </v-window>
              </div>
            </div>

            <div class="flex items-center justify-end gap-3 mt-5 pt-5 border-t border-[rgba(var(--v-theme-on-surface),0.08)]">
              <v-btn variant="text" class="px-5" @click="closeEditor">
                {{ t('shared.cancel') }}
              </v-btn>
              <v-btn
                color="primary"
                class="px-6 font-semibold"
                :disabled="!canSaveDraft"
                @click="saveDraft(false)"
              >
                {{ editingSkin ? t('shared.save') : t('userSkin.saveToLibrary') }}
              </v-btn>
              <v-btn
                v-if="!editingSkin"
                color="success"
                class="px-6 font-semibold"
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
              class="font-medium"
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

        <div v-if="loadSkinError" class="mb-4 flex-none">
          <v-alert
            type="error"
            variant="tonal"
            density="compact"
            closable
            @click:close="loadSkinError = ''"
          >
            {{ loadSkinError }}
          </v-alert>
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
import { useService } from '@/composables/service'
import { SkinLibraryItem, useUserSkinLibrary } from '@/composables/userSkinLibrary'
import { UserSkinModel } from '@/composables/userSkin'
import { AUTHORITY_MICROSOFT, AuthorityMetadata, GameProfileAndTexture, UserProfile, UserServiceKey } from '@xmcl/runtime-api'

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
const { customSkins, allSkins, equippedSkinIds, refresh, addSkin, removeSkin, updateSkin, setEquippedSkin, fetchSkinFromUsername } = useUserSkinLibrary()
const { showOpenDialog } = windowController
const { getSupportedAuthorityMetadata } = useService(UserServiceKey)

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
const loadSkinError = ref('')
const selectedAuthority = ref(AUTHORITY_MICROSOFT)
const authorities = ref<AuthorityMetadata[]>([])
const savingCurrentSkinCount = ref(0)
const currentSkinSaves = new Map<string, Promise<SkinLibraryItem>>()
let selectionRequest = 0

const currentCape = computed(() => skinModel?.cape.value)
const authorityItems = computed(() => [
  {
    title: 'Minecraft',
    value: AUTHORITY_MICROSOFT,
    icon: '',
  },
  ...authorities.value
    .filter(metadata => metadata.kind === 'yggdrasil')
    .map(metadata => ({
      title: metadata.authlibInjector?.meta.serverName || new URL(metadata.authority).host,
      value: metadata.authority,
      icon: metadata.favicon || '',
    })),
])
const previewUrl = computed(() => isEditorOpen.value ? draftUrl.value : selectedSkin.value?.url || '')
const previewSlim = computed(() => isEditorOpen.value ? draftSlim.value : selectedSkin.value?.slim || false)
const previewName = computed(() => isEditorOpen.value ? draftName.value : selectedSkin.value?.name || '')
const canSaveDraft = computed(() => !!draftUrl.value && !!draftName.value.trim())
const activeProfileSkinUrl = computed(() => (props.profile?.skins ? props.profile.skins.find(s => s.state === 'ACTIVE')?.url : undefined) || props.profile?.textures?.SKIN?.url || '')
const currentSkinDefaultName = computed(() => `${props.profile.name}@${getAuthorityName(props.user.authority)}`)
const currentSkinLegacyName = computed(() => `${props.profile.name}@${props.user.authority}`)
const isSavingCurrentSkin = computed(() => savingCurrentSkinCount.value > 0)
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
    const found = allSkins.value.find(s => isSkinSource(s, activeProfileSkinUrl.value))
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
  if (!activeProfileSkinUrl.value || isSavingCurrentSkin.value) return false
  return !customSkins.value.some(s => isSkinSource(s, activeProfileSkinUrl.value) || isCurrentSkinDefault(s))
})

function getAuthorityName(authority: string) {
  if (authority === AUTHORITY_MICROSOFT) return 'mojang'
  if (authority.startsWith('http://') || authority.startsWith('https://')) {
    return new URL(authority).hostname
  }
  return authority.replace(/^x:\/\//, '')
}

function isSkinSource(skin: SkinLibraryItem, source: string) {
  return skin.source === source || skin.url === source
}

function isCurrentSkinDefault(skin: SkinLibraryItem) {
  return skin.name === currentSkinDefaultName.value || skin.name === currentSkinLegacyName.value
}

async function normalizeCurrentSkinName(skin: SkinLibraryItem) {
  if (skin.name === currentSkinLegacyName.value && skin.name !== currentSkinDefaultName.value) {
    return updateSkin(skin.id, { name: currentSkinDefaultName.value })
  }
  return skin
}

watch([() => props.modelValue, accountKey, activeProfileSkinUrl], async ([open]) => {
  const request = ++selectionRequest
  if (!open) return
  loadSkinError.value = ''
  isEditorOpen.value = false
  editingSkin.value = null
  try {
    await refresh()
    if (request !== selectionRequest || !props.modelValue) return
    const active = allSkins.value.find(s => isItemEquipped(s))
    if (active) {
      selectedSkin.value = await normalizeCurrentSkinName(active)
    } else if (activeProfileSkinUrl.value) {
      const saved = await persistCurrentSkin()
      if (saved && request === selectionRequest && props.modelValue) selectedSkin.value = saved
    } else if (allSkins.value.length > 0) {
      selectedSkin.value = allSkins.value[0]
    }
  } catch (e) {
    if (request === selectionRequest) {
      loadSkinError.value = toLocaleError(e)
    }
  }
})

watch([urlInput, selectedAuthority, importTab], () => {
  loadSkinError.value = ''
})

function openAddEditor() {
  editingSkin.value = null
  draftName.value = ''
  draftUrl.value = ''
  draftSlim.value = false
  urlInput.value = ''
  selectedAuthority.value = props.user.authority?.startsWith('http') ? props.user.authority : AUTHORITY_MICROSOFT
  importTab.value = 'file'
  loadSkinError.value = ''
  isEditorOpen.value = true
  void loadAuthorities()
}

async function loadAuthorities() {
  try {
    authorities.value = await getSupportedAuthorityMetadata()
    if (!authorityItems.value.some(item => item.value === selectedAuthority.value)) {
      selectedAuthority.value = AUTHORITY_MICROSOFT
    }
  } catch (e) {
    notify({ level: 'error', title: t('shared.failed'), body: toLocaleError(e) })
  }
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
  loadSkinError.value = ''
}

function onModelDetected(modelType: 'default' | 'slim') {
  if (isEditorOpen.value && !editingSkin.value && !draftUrl.value.includes('http://launcher/media')) {
    draftSlim.value = modelType === 'slim'
  }
}

function onSkinLoadError() {
  loadSkinError.value = t('userSkin.invalidImage')
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
  loadSkinError.value = ''
  draftUrl.value = `http://launcher/media?path=${filePath}`
  if (!draftName.value) {
    draftName.value = filePath.split(/[/\\]/).pop()?.replace(/\.png$/i, '') || 'Skin'
  }
}

async function fetchFromUrl() {
  const input = urlInput.value.trim()
  if (!input) return
  loadSkinError.value = ''
  isFetchingUrl.value = true
  try {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      draftUrl.value = input
      if (!draftName.value) draftName.value = 'Web Skin'
    } else {
      const resolved = await fetchSkinFromUsername(input, selectedAuthority.value)
      draftUrl.value = resolved.url
      draftSlim.value = resolved.slim
      if (!draftName.value) draftName.value = `${input}@${getAuthorityName(selectedAuthority.value)}`
    }
  } catch (e) {
    loadSkinError.value = toLocaleError(e)
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
      if (equipImmediately) {
        await equipSelectedSkin(created)
      }
    }
    closeEditor()
  } catch (e) {
    if (editingSkin.value) {
      notify({ level: 'error', title: t('userSkin.saveFailed'), body: toLocaleError(e) })
    } else {
      loadSkinError.value = toLocaleError(e)
    }
  }
}

async function persistCurrentSkin() {
  const url = activeProfileSkinUrl.value
  const name = currentSkinDefaultName.value
  const slim = activeProfileSlim.value
  if (!url) return undefined
  const existing = customSkins.value.find(s => isSkinSource(s, url) || isCurrentSkinDefault(s))
  if (existing) return normalizeCurrentSkinName(existing)

  const saving = currentSkinSaves.get(url)
  if (saving) return saving

  const promise = addSkin({ name, url, slim })
  currentSkinSaves.set(url, promise)
  savingCurrentSkinCount.value++
  try {
    return await promise
  } finally {
    currentSkinSaves.delete(url)
    savingCurrentSkinCount.value--
  }
}

async function saveCurrentToLibrary() {
  try {
    const saved = await persistCurrentSkin()
    if (saved) selectedSkin.value = saved
  } catch (e) {
    loadSkinError.value = toLocaleError(e)
  }
}

async function exportSelectedSkin() {
  if (!selectedSkin.value) return
  const { showSaveDialog } = windowController
  const fileName = selectedSkin.value.name.replace(/[<>:"/\\|?*]/g, '_')
  const { filePath } = await showSaveDialog({
    title: t('userSkin.saveTitle'),
    defaultPath: `${fileName}.png`,
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

.authority-select {
  width: 190px;
}
</style>
