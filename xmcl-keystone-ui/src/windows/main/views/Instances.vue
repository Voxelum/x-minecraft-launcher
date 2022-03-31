<template>
  <div class="h-full overflow-auto flex flex-col px-8 py-4 gap-3">
    <v-card
      outlined
      class="flex py-1 rounded-lg flex-shrink flex-grow-0 items-center pr-2 gap-2 z-5"
    >
      <v-text-field
        ref="filterElem"
        v-model="filter"
        hide-details
        class="flex-grow pr-2"
        prepend-inner-icon="filter_list"
        :label="$t('filter')"
        solo
        flat
        color="green en-1"
      />
      <v-flex class="flex-grow-0">
        <create-button @create="onCreate" />
      </v-flex>
      <v-flex class="flex-grow-0">
        <import-button @import="onImport" />
      </v-flex>
    </v-card>

    <v-container
      grid-list-md
      text-xs-center
      class="pt-2 h-full overflow-scroll"
      @dragover.prevent
    >
      <instances-view
        :instances="instances"
        @select="selectInstance"
        @dragstart="dragStart"
        @dragend="dragEnd"
      />

      <transition
        name="scale-transition"
        mode="out-in"
      >
        <v-btn
          v-if="draggingInstance.path === ''"
          :key="0"
          absolute
          fab
          large
          color="primary"
          style="right: 20px; bottom: 20px; transition: all 0.15s ease;"
          :loading="pinging"
          @click="refresh"
        >
          <v-icon>refresh</v-icon>
        </v-btn>
        <v-btn
          v-else
          :key="1"
          absolute
          fab
          large
          color="red"
          style="right: 20px; bottom: 20px; transition: all 0.15s ease;"
          :loading="pinging"
          @drop="drop"
        >
          <v-icon>delete</v-icon>
        </v-btn>
      </transition>
      <delete-dialog
        :instance="deletingInstance"
        :confirm="doDelete"
        :cancel="cancelDelete"
      />
    </v-container>
  </div>
</template>

<script lang=ts>
import { computed, defineComponent, Ref, ref } from '@vue/composition-api'
import { ModpackServiceKey } from '@xmcl/runtime-api'
import { useI18n, useOperation, useResourceOperation, useRouter, useService } from '/@/composables'
import { useInstances } from '../composables/instance'
import DeleteDialog from './InstancesDeleteDialog.vue'
import ImportButton from './InstancesImportButton.vue'
import InstancesView from './InstancesCards.vue'
import CreateButton from './InstancesCreateButton.vue'
import { Notify, useNotifier } from '../composables/notifier'
import { useInstancesServerStatus } from '../composables/serverStatus'
import { useDialog } from '../composables/dialog'
import { onSearchToggle } from '../composables/useSearch'

function useRefreshInstance(notify: Notify) {
  const { $t } = useI18n()
  const { pinging, refresh: _refresh } = useInstancesServerStatus()
  return {
    pinging,
    refresh() {
      _refresh().then(() => {
        notify({ level: 'success', title: $t('profile.refreshServers') })
      }, () => {
        notify({ level: 'error', title: $t('profile.refreshServers') })
      })
    },
  }
}

function setupInstanceImport() {
  const { importInstance } = useInstances()
  const { showOpenDialog } = windowController
  const { $t } = useI18n()
  const { importResource } = useResourceOperation()
  const { importModpack } = useService(ModpackServiceKey)
  async function onImport(type: 'zip' | 'folder' | 'curseforge') {
    const fromFolder = type === 'folder'
    const filters = fromFolder
      ? []
      : [{ extensions: ['zip'], name: 'Zip' }]
    const { filePaths } = await showOpenDialog({
      title: $t('profile.import.title'),
      message: $t('profile.import.description'),
      filters,
      properties: fromFolder ? ['openDirectory'] : ['openFile'],
    })
    if (filePaths && filePaths.length > 0) {
      for (const f of filePaths) {
        if (type === 'curseforge') {
          await importResource({
            path: f,
            type: 'curseforge-modpack',
            background: true,
          })
          await importModpack({ path: f, instanceConfig: {} })
        } else {
          await importInstance(f)
        }
      }
    }
  }
  return {
    onImport,
  }
}

function setupDelete(deleteInstance: (path: string) => Promise<void>) {
  const defaultInstance = { path: '', name: '' }
  const { cancel: cancelDelete, operate: doDelete, begin: startDelete, data: deletingInstance } = useOperation(defaultInstance, async (instance) => {
    if (instance && 'path' in instance) {
      await deleteInstance(instance.path).catch(() => {
      })
    }
  })
  const { begin: dragStart, cancel: dragEnd, operate: drop, data: draggingInstance } = useOperation(defaultInstance, (inst) => {
    startDelete(inst)
  })
  return {
    dragStart,
    dragEnd,
    drop,
    draggingInstance,

    cancelDelete: () => setTimeout(cancelDelete, 100),
    doDelete,
    deletingInstance,
  }
}

export default defineComponent({
  components: {
    DeleteDialog,
    ImportButton,
    CreateButton,
    InstancesView,
  },
  setup() {
    const { mountInstance: selectInstance, deleteInstance, instances } = useInstances()
    const { notify } = useNotifier()
    const { push } = useRouter()
    const filter = ref('')

    const { show: showAddInstanceDialog } = useDialog('add-instance-dialog')
    const { show: showAddServerDialog } = useDialog('add-server-dialog')

    const filterElem = ref(null) as Ref<any>

    const filteredInstance = computed(() => {
      const filterString = filter.value.toLowerCase()
      return instances.value.filter(
        profile => filterString === '' ||
          (profile.author
            ? profile.author.toLowerCase().indexOf(filterString) !== -1
            : false) ||
          profile.name.toLowerCase().indexOf(filterString) !== -1 ||
          (profile.description
            ? profile.description.toLowerCase().indexOf(filterString) !== -1
            : false),
      )
    })

    function onCreate(type: 'server' | 'instance') {
      if (type === 'server') {
        showAddServerDialog()
      } else {
        showAddInstanceDialog()
      }
    }

    onSearchToggle((force?: boolean) => {
      if (force) {
        filterElem.value.blur()
      } else if (filterElem.value.isFocused) {
        filterElem.value.blur()
      } else {
        filterElem.value.focus()
      }
      return false
    })

    return {
      // drag instance to delete
      ...setupDelete(deleteInstance),

      // instances display
      instances: filteredInstance,
      filter,
      onCreate,

      // refresh instance operations
      ...useRefreshInstance(notify),

      ...setupInstanceImport(),

      selectInstance(path: string) {
        selectInstance(path)
        push('/')
      },
      filterElem,
    }
  },
  methods: {},
})
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
