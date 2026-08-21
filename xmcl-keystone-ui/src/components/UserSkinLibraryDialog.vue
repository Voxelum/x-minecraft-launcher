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
            :color="selectedSkin?.slim ? 'purple' : 'blue'"
            variant="tonal"
            class="font-medium"
          >
            {{ selectedSkin?.slim ? t('userSkin.slim') : t('userSkin.classic') }}
          </v-chip>
        </div>

        <!-- 3D Skin Viewer -->
        <div class="w-full flex-1 flex items-center justify-center my-2 relative">
          <SkinView
            v-if="selectedSkin"
            :paused="false"
            :height="330"
            :skin="selectedSkin.url"
            :slim="selectedSkin.slim"
            :cape="currentCape"
            :name="''"
            animation="idle"
          />
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
              :disabled="!selectedSkin || isCurrentlyEquipped || isUploading"
              :loading="isUploading"
              @click="equipSelectedSkin()"
            >
              <v-icon start>{{ isCurrentlyEquipped ? 'check_circle' : 'check' }}</v-icon>
              {{ isCurrentlyEquipped ? t('userSkin.equipped') : t('userSkin.equipToAccount') }}
            </v-btn>

            <div class="flex gap-2">
              <v-btn
                variant="tonal"
                size="default"
                class="flex-1 rounded-xl"
                :disabled="!canSaveCurrentToLibrary"
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
                :title="t('userSkin.saveTitle')"
                :disabled="!selectedSkin"
                @click="exportSelectedSkin"
              >
                <v-icon size="18">download</v-icon>
              </v-btn>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Skin Library Grid -->
      <div class="flex-1 flex flex-col p-6 overflow-hidden bg-surface">
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
              @click="openAddDialog"
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
      </div>
    </v-card>

    <!-- Add/Edit Dialog -->
    <UserSkinAddDialog
      v-model="isAddDialogOpen"
      :edit-item="editingSkin"
      @saved="onSkinSaved"
    />
  </v-dialog>
</template>

<script lang="ts" setup>
import SkinView from '@/components/SkinView.vue'
import UserSkinAddDialog from '@/components/UserSkinAddDialog.vue'
import UserSkinCard from '@/components/UserSkinCard.vue'
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
const { customSkins, allSkins, equippedSkinId, addSkin, removeSkin, updateSkin } = useUserSkinLibrary()

const skinModel = inject(UserSkinModel)

const searchQuery = ref('')
const selectedSkin = ref<SkinLibraryItem | null>(null)
const isAddDialogOpen = ref(false)
const editingSkin = ref<SkinLibraryItem | null>(null)
const isUploading = ref(false)

const currentCape = computed(() => skinModel?.cape.value)
const activeProfileSkinUrl = computed(() => (props.profile?.skins ? props.profile.skins.find(s => s.state === 'ACTIVE')?.url : undefined) || props.profile?.textures?.SKIN?.url || '')
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
  if (equippedSkinId.value && allSkins.value.some(s => s.id === equippedSkinId.value)) {
    return equippedSkinId.value
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

function openAddDialog() {
  editingSkin.value = null
  isAddDialogOpen.value = true
}

function onEditItem(item: SkinLibraryItem) {
  editingSkin.value = item
  isAddDialogOpen.value = true
}

function onDeleteItem(item: SkinLibraryItem) {
  removeSkin(item.id)
  if (selectedSkin.value?.id === item.id) {
    selectedSkin.value = allSkins.value[0] || null
  }
  notify({ level: 'info', title: t('userSkin.skinDeleted') })
}

function onSkinSaved(item: SkinLibraryItem, equipImmediately: boolean) {
  if (item.id) {
    updateSkin(item.id, { name: item.name, slim: item.slim })
    notify({ level: 'success', title: t('userSkin.skinUpdated') })
  } else {
    const created = addSkin(item)
    selectedSkin.value = created
    notify({ level: 'success', title: t('userSkin.skinAdded') })
    if (equipImmediately) {
      equipSelectedSkin(created)
    }
  }
}

function saveCurrentToLibrary() {
  if (!activeProfileSkinUrl.value) return
  const name = props.profile?.name ? `${props.profile.name}'s Skin` : 'My Skin'
  const saved = addSkin({
    name,
    url: activeProfileSkinUrl.value,
    slim: activeProfileSlim.value,
  })
  selectedSkin.value = saved
  notify({ level: 'success', title: t('userSkin.skinAdded') })
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
    equippedSkinId.value = item.id
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
</style>
