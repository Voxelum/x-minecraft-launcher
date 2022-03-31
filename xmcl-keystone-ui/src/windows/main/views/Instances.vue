<template>
  <div class="h-full overflow-auto flex flex-col px-8 py-4 gap-3">
    <v-card
      outlined
      class="flex py-1 rounded-lg flex-shrink flex-grow-0 items-center pr-2 gap-2 z-5"
    >
      <filter-combobox
        class="flex-grow pr-2"
        :label="t('filter')"
      />
      <v-flex class="flex-grow-0">
        <create-button />
      </v-flex>
      <v-flex class="flex-grow-0">
        <import-button />
      </v-flex>
    </v-card>

    <v-container
      grid-list-md
      text-xs-center
      class="pt-2 h-full overflow-scroll"
      @dragover.prevent
    >
      <instances-view
        :instances="filteredInstances"
        @select="selectInstance"
        @dragstart="dragStart"
        @dragend="dragEnd"
      />

      <instances-fab-button
        :deleting="draggingInstance.path !== ''"
        @drop="drop"
      />
      <delete-dialog
        :title="t('profile.delete')"
        :persistent="false"
        :width="400"
        @confirm="doDelete"
      >
        {{ $t('profile.deleteHint') }}
        <div style="color: grey">
          {{ $t('profile.name') }}: {{ deletingInstance.name }}
        </div>
        <div style="color: grey">
          {{ deletingInstance.path }}
        </div>
      </delete-dialog>
    </v-container>
  </div>
</template>

<script lang=ts setup>
import { useI18n, useOperation, useRouter, useFilterCombobox } from '/@/composables'
import { useInstances } from '../composables/instance'
import ImportButton from './InstancesImportButton.vue'
import InstancesView from './InstancesCards.vue'
import CreateButton from './InstancesCreateButton.vue'
import DeleteDialog from '../components/DeleteDialog.vue'
import InstancesFabButton from './InstancesFabButton.vue'
import FilterCombobox from '/@/components/FilterCombobox.vue'
import { Instance } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'

const { mountInstance, deleteInstance, instances } = useInstances()
const { push } = useRouter()
const { t } = useI18n()

function getFilterOptions(instance: Instance) {
  const result = [
    { label: 'person', value: instance.author, color: 'lime' },
    { value: instance.runtime.minecraft, color: 'primary' },
  ]
  if (instance.runtime.forge) {
    result.push({
      value: instance.runtime.forge, color: 'orange',
    })
  }
  if (instance.runtime.fabricLoader) {
    result.push({
      value: instance.runtime.fabricLoader, color: 'amber en-1',
    })
  }
  return result
}
const filterOptions = computed(() => instances.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))
const { filter } = useFilterCombobox<Instance>(filterOptions, getFilterOptions, (i) => `${i.name} ${i.author} ${i.version}`)
const filteredInstances = computed(() => filter(instances.value))
const { show } = useDialog('deletion')

function selectInstance(path: string) {
  mountInstance(path)
  push('/')
}

const defaultInstance = { path: '', name: '' }
const { cancel, operate: doDelete, begin: startDelete, data: deletingInstance } = useOperation(defaultInstance, async (instance) => {
  if (instance && 'path' in instance) {
    await deleteInstance(instance.path)
  }
})
const { begin: dragStart, cancel: dragEnd, operate: drop, data: draggingInstance } = useOperation(defaultInstance, (inst) => {
  startDelete(inst)
  show()
})
function cancelDelete() {
  setTimeout(cancel, 100)
}
</script>

<style>
.ghost {
  opacity: 0.5;
}
.v-text-field__slot {
  @apply pl-2;
}
.v-text-field__slot label {
  left: 0.5rem !important;
}
</style>
