<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1040"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="rounded-3xl p-8 surface-panel border border-[rgba(var(--v-theme-on-surface),0.12)] shadow-2xl">
      <div class="flex items-center justify-between mb-6 pb-2 border-b border-[rgba(var(--v-theme-on-surface),0.08)]">
        <div class="flex items-center gap-3">
          <v-icon color="primary" size="28">add_photo_alternate</v-icon>
          <span class="text-2xl font-bold">{{ isEditing ? t('userSkin.editSkin') : t('userSkin.addNewSkin') }}</span>
        </div>
        <v-btn
          icon
          size="default"
          variant="text"
          @click="close"
        >
          <v-icon size="22">close</v-icon>
        </v-btn>
      </div>

      <div class="flex gap-8">
        <!-- Left: 3D Preview (Large) -->
        <div class="flex flex-col items-center justify-between w-[340px] flex-shrink-0 bg-black/25 rounded-2xl p-5 border border-[rgba(var(--v-theme-on-surface),0.08)]">
          <div class="w-full h-[400px] flex items-center justify-center relative">
            <SkinView
              v-if="skinUrl"
              :paused="false"
              :height="400"
              :skin="skinUrl"
              :slim="isSlim"
              :name="''"
              animation="idle"
              @model="onModelDetected"
            />
            <div v-else class="text-center opacity-40 text-xs flex flex-col items-center gap-4">
              <v-icon size="64">person</v-icon>
              <span class="text-base font-medium">{{ t('userSkin.previewPlaceholder') }}</span>
            </div>
          </div>

          <!-- Model Type Selector -->
          <v-btn-toggle
            v-model="isSlim"
            mandatory
            density="comfortable"
            class="mt-4 w-full surface-panel"
            rounded="xl"
          >
            <v-btn :value="false" class="flex-1 font-semibold py-2">
              <v-icon size="18" class="mr-2">accessibility_new</v-icon>
              <span class="text-sm">{{ t('userSkin.classic') }}</span>
            </v-btn>
            <v-btn :value="true" class="flex-1 font-semibold py-2">
              <v-icon size="18" class="mr-2">accessibility</v-icon>
              <span class="text-sm">{{ t('userSkin.slim') }}</span>
            </v-btn>
          </v-btn-toggle>
        </div>

        <!-- Right: Form Details (Spacious) -->
        <div class="flex-1 flex flex-col justify-between">
          <div class="flex flex-col gap-6">
            <!-- Skin Name -->
            <div>
              <div class="text-xs font-bold uppercase tracking-wider opacity-70 mb-2">
                {{ t('userSkin.skinName') }}
              </div>
              <v-text-field
                v-model="skinName"
                :placeholder="t('userSkin.skinNamePlaceholder') || 'e.g. My Favorite Skin'"
                variant="outlined"
                density="default"
                hide-details
                class="rounded-xl text-base"
              />
            </div>

            <!-- Import Method Tabs -->
            <div v-if="!isEditing">
              <v-tabs v-model="importTab" density="default" color="primary" class="mb-4">
                <v-tab value="file" class="font-semibold text-sm">
                  <v-icon size="20" class="mr-2.5">folder_open</v-icon>
                  {{ t('userSkin.localFile') }}
                </v-tab>
                <v-tab value="url" class="font-semibold text-sm">
                  <v-icon size="20" class="mr-2.5">link</v-icon>
                  {{ t('userSkin.urlOrPlayer') }}
                </v-tab>
              </v-tabs>

              <v-window v-model="importTab">
                <!-- Tab 1: Local File -->
                <v-window-item value="file">
                  <div
                    class="file-drop-zone border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5 min-h-[220px]"
                    :class="skinUrl && importTab === 'file' ? 'border-primary/60 bg-primary/5' : 'border-[rgba(var(--v-theme-on-surface),0.15)]'"
                    @click="pickFile"
                    @drop.prevent="onDropFile"
                    @dragover.prevent="() => {}"
                  >
                    <v-icon size="48" color="primary" class="mb-3">upload_file</v-icon>
                    <div class="text-base font-bold">{{ t('userSkin.dropFileHere') }}</div>
                    <div class="text-xs opacity-50 mt-1.5">{{ t('userSkin.supportedFormats') }}</div>
                  </div>
                </v-window-item>

                <!-- Tab 2: URL or Username -->
                <v-window-item value="url">
                  <div class="flex flex-col gap-3 py-6 min-h-[220px] justify-center">
                    <div class="flex gap-2.5 items-center">
                      <v-text-field
                        v-model="urlInput"
                        :placeholder="t('userSkin.urlOrPlayerPlaceholder')"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                        class="flex-1 rounded-xl"
                        :loading="isFetchingUrl"
                        @keydown.enter.prevent="fetchFromUrl"
                      />
                      <v-btn
                        color="primary"
                        variant="tonal"
                        size="large"
                        class="rounded-xl px-5 h-[48px] font-semibold flex-shrink-0"
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

          <!-- Dialog Actions -->
          <div class="flex items-center justify-end gap-3 mt-8 pt-5 border-t border-[rgba(var(--v-theme-on-surface),0.08)]">
            <v-btn
              variant="text"
              size="large"
              class="rounded-xl font-medium px-5"
              @click="close"
            >
              {{ t('shared.cancel') }}
            </v-btn>
            <v-btn
              color="primary"
              size="large"
              class="rounded-xl font-bold px-6"
              :disabled="!skinUrl || !skinName"
              @click="save(false)"
            >
              {{ isEditing ? t('shared.save') : t('userSkin.saveToLibrary') }}
            </v-btn>
            <v-btn
              v-if="!isEditing"
              color="success"
              size="large"
              class="rounded-xl font-bold px-6"
              :disabled="!skinUrl || !skinName"
              @click="save(true)"
            >
              {{ t('userSkin.saveAndEquip') }}
            </v-btn>
          </div>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import SkinView from '@/components/SkinView.vue'
import { getDropFilePaths } from '@/composables/dropHandler'
import { SkinLibraryItem, useUserSkinLibrary } from '@/composables/userSkinLibrary'

const props = defineProps<{
  modelValue: boolean
  editItem?: SkinLibraryItem | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', skin: SkinLibraryItem, equipImmediately: boolean): void
}>()

const { t } = useI18n()
const { showOpenDialog } = windowController
const { fetchSkinFromUsername } = useUserSkinLibrary()

const skinName = ref('')
const skinUrl = ref('')
const isSlim = ref(false)
const importTab = ref('file')
const urlInput = ref('')
const isFetchingUrl = ref(false)

const isEditing = computed(() => !!props.editItem)

watch(() => props.modelValue, (open) => {
  if (open) {
    if (props.editItem) {
      skinName.value = props.editItem.name
      skinUrl.value = props.editItem.url
      isSlim.value = props.editItem.slim
    } else {
      skinName.value = ''
      skinUrl.value = ''
      isSlim.value = false
      urlInput.value = ''
      importTab.value = 'file'
    }
  }
})

function onModelDetected(modelType: 'default' | 'slim') {
  if (!isEditing.value && !skinUrl.value.includes('http://launcher/media')) {
    isSlim.value = modelType === 'slim'
  }
}

async function pickFile() {
  const { filePaths } = await showOpenDialog({
    title: t('userSkin.importFile'),
    filters: [{ extensions: ['png'], name: 'PNG Images' }],
  })
  if (filePaths && filePaths[0]) {
    setFileSkin(filePaths[0])
  }
}

function onDropFile(e: DragEvent) {
  if (e.dataTransfer) {
    const [filePath] = getDropFilePaths(e.dataTransfer.files)
    if (filePath && filePath.toLowerCase().endsWith('.png')) {
      setFileSkin(filePath)
    }
  }
}

function setFileSkin(filePath: string) {
  skinUrl.value = `http://launcher/media?path=${filePath}`
  if (!skinName.value) {
    const filename = filePath.split(/[/\\]/).pop()?.replace(/\.png$/i, '') || 'Skin'
    skinName.value = filename
  }
}

async function fetchFromUrl() {
  const input = urlInput.value.trim()
  if (!input) return

  isFetchingUrl.value = true
  try {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      skinUrl.value = input
      if (!skinName.value) {
        skinName.value = 'Web Skin'
      }
    } else {
      // Treat as Minecraft Player Username
      const resolved = await fetchSkinFromUsername(input)
      skinUrl.value = resolved.url
      isSlim.value = resolved.slim
      if (!skinName.value) {
        skinName.value = input
      }
    }
  } finally {
    isFetchingUrl.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}

function save(equipImmediately: boolean) {
  if (!skinUrl.value || !skinName.value) return
  const result: SkinLibraryItem = {
    id: props.editItem?.id || '',
    name: skinName.value.trim(),
    url: skinUrl.value,
    slim: isSlim.value,
    dateAdded: props.editItem?.dateAdded || Date.now(),
  }
  emit('saved', result, equipImmediately)
  close()
}
</script>

<style scoped>
.file-drop-zone {
  background: rgba(var(--v-theme-surface), 0.5);
}
</style>
