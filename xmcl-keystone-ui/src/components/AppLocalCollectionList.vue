<template>
  <div class="local-collection-list w-full" data-testid="local-collection-list">
    <div class="filter-subheader flex items-center">
      <v-icon size="16" class="mr-1">folder_special</v-icon>
      {{ t('localCollection.title') }}
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
      <v-list-item
        v-for="c of listItems"
        :key="c.id"
        :value="c.selectionValue"
        color="primary"
        data-testid="local-collection-item"
        @click="onItemClick(c.id)"
      >
        <template #prepend>
          <v-avatar>
            <v-icon v-if="mode === 'add'" :color="c.contains ? 'primary' : undefined">
              {{ c.contains ? 'check_circle' : 'folder' }}
            </v-icon>
            <v-icon v-else>folder</v-icon>
          </v-avatar>
        </template>
        <v-list-item-title>{{ c.name }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ t('localCollection.projects', { count: c.count }, c.count) }}
        </v-list-item-subtitle>
        <template v-if="mode === 'select'" #append>
          <v-btn
            icon
            variant="text"
            :loading="deletingId === c.id"
            :aria-label="t('shared.delete')"
            data-testid="local-collection-delete"
            @click.stop="onDelete(c.id)"
          >
            <v-icon size="small">delete</v-icon>
          </v-btn>
        </template>
      </v-list-item>

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
          <v-icon>add</v-icon>
        </template>
      </v-list-item>
    </v-list>
  </div>
</template>
<script setup lang="ts">
import { kLocalCollections, toLocalSelectionId, useLocalCollections } from '@/composables/localCollections'
import { CollectionContentType, CollectionProvider } from '@xmcl/runtime-api'

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
const {
  collections,
  corrupted,
  isInCollection,
  createCollection,
  deleteCollection,
  addEntry,
  removeEntry,
} = inject(kLocalCollections, undefined) ?? useLocalCollections()

const creating = ref(false)
const newName = ref('')
const deletingId = ref('')

const listItems = computed(() => collections.value.map((c) => ({
  id: c.id,
  name: c.name,
  count: c.mods.length + c.resourcepacks.length + c.shaderpacks.length,
  selectionValue: toLocalSelectionId(c.id),
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
</script>
