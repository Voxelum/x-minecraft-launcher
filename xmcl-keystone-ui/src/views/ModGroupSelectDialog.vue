<template>
  <v-dialog
    v-model="isShown"
    width="500"
    max-width="90vw"
  >
    <v-card
      class="flex flex-col overflow-auto max-h-[90vh] visible-scroll"
    >
      <v-card-title>
        {{ t('mod.selectOrCreateGroup') }}
      </v-card-title>
      <v-divider />
      <v-card-text class="overflow-auto pt-4">
        <!-- Search bar for filtering groups (only shown when not creating new) -->
        <v-text-field
          v-if="!creatingNew"
          v-model="searchQuery"
          :label="t('mod.searchGroups')"
          prepend-inner-icon="search"
          clearable
          autofocus
          dense
          outlined
          class="mb-2"
        />
        
        <!-- New group name input (shown when creating new) -->
        <v-expand-transition>
          <div v-if="creatingNew" class="mb-4">
            <v-text-field
              v-model="newGroupName"
              :label="t('mod.groupName')"
              outlined
              dense
              autofocus
              :rules="[v => !!v || t('mod.groupNameRequired')]"
              @keyup.enter="onConfirmNewGroup"
            />
          </div>
        </v-expand-transition>
        
        <v-list v-if="!creatingNew">
          <v-list-item
            class="mb-2"
            @click="onCreateNew"
          >
            <v-list-item-avatar>
              <v-icon color="primary">
                create_new_folder
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title class="primary--text font-weight-bold">
                {{ t('mod.newFolder') }}
              </v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          
          <v-divider v-if="filteredGroups.length > 0" class="mb-2" />
          
          <!-- Existing groups (filtered and sorted) -->
          <div
            v-if="filteredGroups.length > 0"
            class="overflow-auto"
            style="max-height: 300px"
          >
            <v-list-item
              v-for="groupName in filteredGroups"
              :key="groupName"
              @click="onSelectGroup(groupName)"
            >
              <v-list-item-avatar>
                <v-icon>folder</v-icon>
              </v-list-item-avatar>
              <v-list-item-content>
                <v-list-item-title>{{ groupName }}</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
          </div>
          
          <!-- No groups message -->
          <v-list-item v-else-if="groups.length === 0">
            <v-list-item-content>
              <v-list-item-subtitle class="text-center">
                {{ t('mod.noGroupsYet') }}
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          
          <!-- No results message -->
          <v-list-item v-else>
            <v-list-item-content>
              <v-list-item-subtitle class="text-center">
                {{ t('mod.noGroupsFound') }}
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn
          text
          @click="onCancel"
        >
          {{ creatingNew ? t('back') : t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          v-if="creatingNew"
          color="primary"
          :disabled="!newGroupName.trim()"
          @click="onConfirmNewGroup"
        >
          <v-icon left>
            add
          </v-icon>
          {{ t('mod.createGroup') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useDialog } from '@/composables/dialog'

const { t } = useI18n()
const searchQuery = ref('')
const creatingNew = ref(false)
const newGroupName = ref('')

const { isShown, parameter } = useDialog<{
  groups: string[]
  onSelect: (groupName: string | null, newName?: string) => void
}>('mod-group-select')

const groups = computed(() => parameter.value?.groups || [])

// Filter and sort groups alphabetically
const filteredGroups = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  let filtered = groups.value
  
  if (query) {
    filtered = filtered.filter(g => g.toLowerCase().includes(query))
  }
  
  return filtered.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
})

function onSelectGroup(groupName: string) {
  parameter.value?.onSelect(groupName)
  isShown.value = false
  reset()
}

function onCreateNew() {
  creatingNew.value = true
  newGroupName.value = ''
}

function onConfirmNewGroup() {
  if (newGroupName.value.trim()) {
    parameter.value?.onSelect(null, newGroupName.value.trim())
    isShown.value = false
    reset()
  }
}

function onCancel() {
  if (creatingNew.value) {
    creatingNew.value = false
    newGroupName.value = ''
  } else {
    isShown.value = false
    reset()
  }
}

function reset() {
  searchQuery.value = ''
  creatingNew.value = false
  newGroupName.value = ''
}
</script>

