<template>
  <div class="flex h-full flex-col gap-3 overflow-auto px-8 py-4">
    <v-card
      outlined
      class="z-5 flex flex-shrink flex-grow-0 items-center gap-2 rounded-lg py-1 pr-2"
    >
      <FilterCombobox
        class="flex-grow pr-2"
        :label="t('filter')"
      />
      <v-flex class="flex-grow-0">
        <CreateButton />
      </v-flex>
    </v-card>

    <v-container
      v-context-menu="contextMenuItems"
      grid-list-md
      text-xs-center
      class="h-full overflow-scroll pt-2"
      @dragover.prevent
    >
      <InstancesView
        :instances="filteredInstances"
        @select="selectInstance"
        @dragstart="dragStart"
        @dragend="dragEnd"
        @delete="startDeleteInstance"
      />

      <InstancesFabButton
        :deleting="draggingInstance.path !== ''"
        @drop="drop"
      />
      <DeleteDialog
        :title="t('instance.delete')"
        :persistent="false"
        :width="400"
        @confirm="doDelete"
      >
        {{ $t('instance.deleteHint') }}
        <div style="color: grey">
          {{ $t('instance.name') }}: {{ deletingInstance.name }}
        </div>
        <div style="color: grey">
          {{ deletingInstance.path }}
        </div>
      </DeleteDialog>
    </v-container>
  </div>
</template>

<script lang=ts setup>
import FilterCombobox from '@/components/FilterCombobox.vue'
import { useFilterCombobox, useOperation, useService } from '@/composables'
import { Instance, InstanceServiceKey } from '@xmcl/runtime-api'
import DeleteDialog from '../components/DeleteDialog.vue'
import { ContextMenuItem } from '../composables/contextMenu'
import { useDialog } from '../composables/dialog'
import { kInstance } from '../composables/instance'
import { vContextMenu } from '../directives/contextMenu'
import InstancesView from './InstancesCards.vue'
import CreateButton from './InstancesCreateButton.vue'
import InstancesFabButton from './InstancesFabButton.vue'
import { injection } from '@/util/inject'
import { kInstances } from '@/composables/instances'

const { show: showAddInstanceDialog } = useDialog('add-instance-dialog')
const { show: showAddServerDialog } = useDialog('add-server-dialog')

const contextMenuItems = computed(() => {
  const items: ContextMenuItem[] = [{
    text: t('instances.add'),
    onClick: () => {
      showAddInstanceDialog()
    },
    icon: 'add',
  }, {
    text: t('instance.addServer'),
    onClick: () => {
      showAddServerDialog()
    },
    icon: 'storage',
  }]

  return items
})

const { select } = injection(kInstance)
const { instances } = injection(kInstances)

const { deleteInstance } = useService(InstanceServiceKey)
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
  select(path)
  push('/')
}

const defaultInstance = { path: '', name: '' }
const { cancel, operate: doDelete, begin: startDelete, data: deletingInstance } = useOperation(defaultInstance, async (instance) => {
  if (instance && 'path' in instance) {
    await deleteInstance(instance.path)
  }
})

function startDeleteInstance(inst: { name: string; path: string }) {
  startDelete(inst)
  show()
}

const { begin: dragStart, cancel: dragEnd, operate: drop, data: draggingInstance } = useOperation(defaultInstance, (inst) => {
  startDeleteInstance(inst)
})
function cancelDelete() {
  setTimeout(cancel, 100)
}
</script>

<style>
.v-text-field__slot {
  @apply pl-2;
}
.v-text-field__slot label {
  left: 0.5rem !important;
}
</style>
