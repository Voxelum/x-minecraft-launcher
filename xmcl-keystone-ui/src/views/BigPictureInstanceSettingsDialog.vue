<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1100"
    content-class="elevation-0"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="bp-subpage-card !m-0 !p-0 h-[85vh] flex flex-col overflow-hidden relative">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0 bg-white/5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <v-icon color="primary" size="24">settings</v-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold">{{ t('baseSetting.title') }}</h2>
            <div class="text-xs text-white/60">{{ instanceName }}</div>
          </div>
        </div>

        <v-btn
          icon="close"
          variant="text"
          size="small"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        />
      </div>

      <!-- Instance Folder Strip -->
      <div class="px-6 py-3 border-b border-white/10 bg-white/[0.03] flex items-center justify-between gap-4 flex-wrap flex-shrink-0">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center"
            :style="{ backgroundColor: currentGroup?.color ? currentGroup.color + '33' : 'rgba(255,255,255,0.08)' }"
          >
            <v-icon size="18" :style="{ color: currentGroup?.color || 'rgba(255,255,255,0.7)' }">
              {{ currentGroup ? 'folder' : 'folder_off' }}
            </v-icon>
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] text-white/50 font-bold uppercase tracking-wider">
              {{ t('bigPicture.folderSettingTitle') }}
            </span>
            <span class="text-sm font-extrabold text-white">
              {{ currentGroupDisplayName }}
            </span>
          </div>
        </div>

        <!-- Folder Actions -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Folder Selector Menu -->
          <v-menu location="bottom end">
            <template #activator="{ props: menuProps }">
              <button
                type="button"
                v-bind="menuProps"
                class="bp-sec-btn !px-3.5 !py-1.5 !text-xs flex items-center gap-1.5 font-bold"
                data-gamepad-focusable
              >
                <v-icon size="16">drive_file_move</v-icon>
                <span>{{ t('bigPicture.folder') }}</span>
                <v-icon size="14">arrow_drop_down</v-icon>
              </button>
            </template>
            <v-list density="compact" class="bg-[#141a29] text-white rounded-xl border border-white/15 min-w-[220px] shadow-2xl">
              <v-list-item
                :title="t('bigPicture.folderNone')"
                prepend-icon="folder_off"
                data-gamepad-focusable
                @click="onRemoveFromFolder"
              />
              <v-divider class="my-1 border-white/10" />
              <v-list-item
                v-for="g in existingGroups"
                :key="g.id"
                :title="g.name || t('bigPicture.folder')"
                data-gamepad-focusable
                @click="onAssignFolder(g)"
              >
                <template #prepend>
                  <v-icon size="18" :style="g.color ? { color: g.color } : {}">folder</v-icon>
                </template>
              </v-list-item>
              <v-divider class="my-1 border-white/10" />
              <v-list-item
                :title="t('bigPicture.createFolder')"
                prepend-icon="create_new_folder"
                data-gamepad-focusable
                @click="createFolderDialog = true"
              />
            </v-list>
          </v-menu>

          <!-- Edit Folder Style Button (if in a folder) -->
          <button
            v-if="currentGroup"
            type="button"
            class="bp-sec-btn !px-3 !py-1.5 !text-xs flex items-center gap-1.5 font-bold"
            data-gamepad-focusable
            :title="t('bigPicture.editFolder')"
            @click="openEditFolderDialog"
          >
            <v-icon size="14">palette</v-icon>
            <span>{{ t('bigPicture.editFolder') }}</span>
          </button>

          <!-- Remove from Folder Button (if in a folder) -->
          <button
            v-if="currentGroup"
            type="button"
            class="bp-sec-btn !px-3 !py-1.5 !text-xs hover:!text-red-400 font-bold"
            data-gamepad-focusable
            :title="t('bigPicture.removeFromFolder')"
            @click="onRemoveFromFolder"
          >
            <v-icon size="14" color="error">folder_delete</v-icon>
            <span>{{ t('bigPicture.removeFromFolder') }}</span>
          </button>
        </div>
      </div>

      <!-- Settings Content -->
      <div class="flex-1 overflow-hidden relative bg-black/20">
        <BaseSetting />
      </div>
    </div>

    <!-- Edit Folder Style Dialog -->
    <v-dialog v-model="editFolderDialog" max-width="480">
      <div class="bp-subpage-card !m-0 !p-6 flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <v-icon color="primary" size="24">palette</v-icon>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white">{{ t('bigPicture.editFolder') }}</h3>
            <div class="text-xs text-white/50">{{ t('bigPicture.folderName') }}</div>
          </div>
        </div>

        <v-text-field
          v-model="editFolderName"
          :placeholder="t('bigPicture.folderName')"
          variant="outlined"
          density="comfortable"
          rounded="lg"
          autofocus
          hide-details
          class="bg-white/5"
          data-gamepad-focusable
          @keydown.enter="onSaveEditFolder"
        />

        <div class="flex flex-col gap-2">
          <span class="text-xs font-semibold text-white/70">{{ t('bigPicture.folderColor') }}</span>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              v-for="color in folderColorPresets"
              :key="color"
              type="button"
              class="w-8 h-8 rounded-full border-2 transition-transform cursor-pointer"
              :class="editFolderColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'"
              :style="{ backgroundColor: color }"
              data-gamepad-focusable
              @click="editFolderColor = color"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-white/10 mt-2">
          <button
            type="button"
            class="bp-sec-btn !px-5 !py-2.5 text-sm"
            data-gamepad-focusable
            @click="editFolderDialog = false"
          >
            <span>{{ t('shared.cancel') }}</span>
          </button>
          <button
            type="button"
            class="bp-play-btn !px-6 !py-2.5 text-sm font-bold"
            :disabled="!editFolderName.trim()"
            data-gamepad-focusable
            @click="onSaveEditFolder"
          >
            <span>{{ t('shared.save') }}</span>
          </button>
        </div>
      </div>
    </v-dialog>

    <!-- Create Folder Dialog -->
    <v-dialog v-model="createFolderDialog" max-width="480">
      <div class="bp-subpage-card !m-0 !p-6 flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <v-icon color="primary" size="24">create_new_folder</v-icon>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white">{{ t('bigPicture.createFolder') }}</h3>
            <div class="text-xs text-white/50">{{ t('bigPicture.folderName') }}</div>
          </div>
        </div>

        <v-text-field
          v-model="newFolderName"
          :placeholder="t('bigPicture.folderName')"
          variant="outlined"
          density="comfortable"
          rounded="lg"
          autofocus
          hide-details
          class="bg-white/5"
          data-gamepad-focusable
          @keydown.enter="onConfirmCreateFolder"
        />

        <div class="flex flex-col gap-2">
          <span class="text-xs font-semibold text-white/70">{{ t('bigPicture.folderColor') }}</span>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              v-for="color in folderColorPresets"
              :key="color"
              type="button"
              class="w-8 h-8 rounded-full border-2 transition-transform cursor-pointer"
              :class="newFolderColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'"
              :style="{ backgroundColor: color }"
              data-gamepad-focusable
              @click="newFolderColor = color"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-white/10 mt-2">
          <button
            type="button"
            class="bp-sec-btn !px-5 !py-2.5 text-sm"
            data-gamepad-focusable
            @click="createFolderDialog = false"
          >
            <span>{{ t('shared.cancel') }}</span>
          </button>
          <button
            type="button"
            class="bp-play-btn !px-6 !py-2.5 text-sm font-bold"
            :disabled="!newFolderName.trim()"
            data-gamepad-focusable
            @click="onConfirmCreateFolder"
          >
            <span>{{ t('create') }}</span>
          </button>
        </div>
      </div>
    </v-dialog>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseSetting from './BaseSetting.vue'
import { kInstance } from '@/composables/instance'
import { useInstanceGroupOps } from '@/composables/instanceGroup'
import { useNotifier } from '@/composables/notifier'
import { injection } from '@/util/inject'
import type { InstanceGroupData } from '@xmcl/runtime-api'

defineProps<{
  modelValue: boolean
  instanceName?: string
}>()

defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const { t } = useI18n()
const { notify } = useNotifier()
const { path: currentPath } = injection(kInstance)
const { groups, groupsSet, edit, createGroup, group } = useInstanceGroupOps()

const folderColorPresets = ['#2196F3', '#4CAF50', '#9C27B0', '#FF9800', '#E91E63', '#00BCD4', '#FF5722', '#607D8B']

const existingGroups = computed<InstanceGroupData[]>(() => {
  return (groups.value || []).filter((g): g is InstanceGroupData => typeof g !== 'string')
})

const currentGroup = computed<InstanceGroupData | undefined>(() => {
  if (!currentPath.value) return undefined
  return existingGroups.value.find((g) => g.instances.includes(currentPath.value))
})

const currentGroupDisplayName = computed(() => {
  if (!currentGroup.value) return t('bigPicture.folderNone')
  if (currentGroup.value.name?.trim()) return currentGroup.value.name
  const idx = existingGroups.value.indexOf(currentGroup.value)
  return `${t('bigPicture.folder')} ${idx + 1}`
})

function onAssignFolder(targetGroup: InstanceGroupData) {
  if (!currentPath.value) return
  group(currentPath.value, targetGroup)
  notify({ level: 'success', title: targetGroup.name || t('bigPicture.folder') })
}

function onRemoveFromFolder() {
  if (!currentGroup.value || !currentPath.value) return
  const data = groups.value
  const newOrders = []
  for (const item of data) {
    if (typeof item === 'string') {
      newOrders.push(item)
    } else if (item.id === currentGroup.value.id) {
      const remaining = item.instances.filter((p: string) => p !== currentPath.value)
      if (remaining.length > 0) {
        newOrders.push({ ...item, instances: remaining })
      }
      newOrders.push(currentPath.value)
    } else {
      newOrders.push(item)
    }
  }
  groupsSet(newOrders)
  notify({ level: 'info', title: t('bigPicture.removeFromFolder') })
}

// Edit Folder Dialog
const editFolderDialog = ref(false)
const editFolderName = ref('')
const editFolderColor = ref('#2196F3')

function openEditFolderDialog() {
  if (!currentGroup.value) return
  editFolderName.value = currentGroup.value.name || ''
  editFolderColor.value = currentGroup.value.color || '#2196F3'
  editFolderDialog.value = true
}

function onSaveEditFolder() {
  if (!currentGroup.value || !editFolderName.value.trim()) return
  edit(currentGroup.value.id, {
    name: editFolderName.value.trim(),
    color: editFolderColor.value,
  })
  editFolderDialog.value = false
  notify({ level: 'success', title: t('bigPicture.editFolder') })
}

// Create Folder Dialog
const createFolderDialog = ref(false)
const newFolderName = ref('')
const newFolderColor = ref('#2196F3')

function onConfirmCreateFolder() {
  const name = newFolderName.value.trim()
  if (!currentPath.value || !name) return
  createGroup(currentPath.value, name, newFolderColor.value)
  createFolderDialog.value = false
  newFolderName.value = ''
  notify({ level: 'success', title: `${t('bigPicture.createFolder')}: ${name}` })
}
</script>
