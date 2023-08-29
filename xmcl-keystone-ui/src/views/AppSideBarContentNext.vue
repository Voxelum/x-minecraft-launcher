<template>
  <div class="h-full overflow-auto">
    <v-list
      nav
      dense
      class="ml-1 flex-grow-0 justify-start overflow-auto px-2"
    >
      <AppSideBarInstanceItem
        v-for="(i, index) of instances"
        :key="i.path + ' ' + index"
        :instance="i"
        @drop="setToPrevious($event, i.path)"
      />

      <v-list-item
        push
        class="non-moveable"
        @click="showAddInstance()"
      >
        <v-tooltip
          :close-delay="0"
          color="black"
          transition="scroll-x-transition"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item-avatar
              size="48"
              class="bg-[rgba(80,80,80,0.4)] transition-all duration-300 hover:rounded-xl hover:bg-green-500"
              large
              v-on="tooltip"
            >
              <v-icon class="text-3xl">
                add
              </v-icon>
            </v-list-item-avatar>
          </template>
          {{ t('instances.add') }}
        </v-tooltip>

        <v-list-item-title>Instance</v-list-item-title>
      </v-list-item>

      <v-list-item
        push
        class="non-moveable"
        @click="showAddServerDialog()"
      >
        <v-tooltip
          :close-delay="0"
          color="black"
          transition="scroll-x-transition"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item-avatar
              size="48"
              class="bg-[rgba(80,80,80,0.4)] transition-all duration-300 hover:rounded-xl hover:bg-green-500"
              large
              v-on="tooltip"
            >
              <v-badge
                right
                color="transparent"
                bottom
                overlap
                offset-x="13"
                offset-y="17"
                :value="true"
              >
                <template #badge>
                  <v-icon>
                    public
                  </v-icon>
                </template>
                <v-icon
                  class="text-2xl"
                  v-on="tooltip"
                >
                  add
                </v-icon>
              </v-badge>
            </v-list-item-avatar>
          </template>
          {{ t('server.add') }}
        </v-tooltip>

        <v-list-item-title>Instance</v-list-item-title>
      </v-list-item>

      <v-list-item
        push
        class="non-moveable"
        @click="onImport('folder')"
      >
        <v-tooltip
          color="black"
          transition="scroll-x-transition"
          :close-delay="0"
          right
        >
          <template #activator="{ on: tooltip }">
            <v-list-item-avatar
              size="48"
              class="bg-[rgba(80,80,80,0.4)] transition-all duration-300 hover:rounded-xl hover:bg-green-500"
              large
              v-on="tooltip"
            >
              <v-badge
                right
                color="transparent"
                bottom
                overlap
                offset-x="13"
                offset-y="17"
                :value="true"
              >
                <template #badge>
                  <v-icon>
                    folder
                  </v-icon>
                </template>
                <v-icon
                  class="text-2xl"
                  v-on="tooltip"
                >
                  add
                </v-icon>
              </v-badge>
            </v-list-item-avatar>
          </template>
          {{ t('instances.importFolder') }}
        </v-tooltip>

        <v-list-item-title>
          {{ t('instances.importFolder') }}
        </v-list-item-title>
      </v-list-item>
      <v-spacer />
    </v-list>
  </div>
</template>
<script setup lang="ts">
import { useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { ContextMenuItem } from '@/composables/contextMenu'
import { useDialog } from '@/composables/dialog'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kInstances } from '@/composables/instances'
import { injection } from '@/util/inject'
import { InstanceServiceKey } from '@xmcl/runtime-api'
import AppSideBarInstanceItem from './AppSideBarInstanceItem.vue'

const { t } = useI18n()

const sideBarShowCurseforge = useLocalStorageCacheBool('sideBarShowCurseforge', true)
const sideBarShowModrinth = useLocalStorageCacheBool('sideBarShowModrinth', true)
const sideBarShowFtb = useLocalStorageCacheBool('sideBarShowFtb', true)
const { instances, setToPrevious } = injection(kInstances)
const { showOpenDialog } = windowController
const { addExternalInstance } = useService(InstanceServiceKey)

async function onImport(type: 'zip' | 'folder') {
  const fromFolder = type === 'folder'
  const filters = fromFolder
    ? []
    : [{ extensions: ['zip'], name: 'Zip' }]
  const { filePaths } = await showOpenDialog({
    title: t('instances.importFolder'),
    message: t('instances.importFolderDescription'),
    filters,
    properties: fromFolder ? ['openDirectory'] : ['openFile'],
  })
  if (filePaths && filePaths.length > 0) {
    const filePath = filePaths[0]
    if (type === 'folder') {
      addExternalInstance(filePath)
    }
  }
}

const { show: showAddInstance } = useDialog(AddInstanceDialogKey)
const { show: showAddServerDialog } = useDialog('add-server-dialog')

const items = computed(() => {
  const result: ContextMenuItem[] = [
    {
      text: 'Curseforge',
      icon: sideBarShowCurseforge.value ? 'check' : '',
      onClick() {
        sideBarShowCurseforge.value = !sideBarShowCurseforge.value
      },
    },
    {
      text: 'Modrinth',
      icon: sideBarShowModrinth.value ? 'check' : '',
      onClick() {
        sideBarShowModrinth.value = !sideBarShowModrinth.value
      },
    },
    {
      text: 'Feed The Beast',
      icon: sideBarShowFtb.value ? 'check' : '',
      onClick() {
        sideBarShowFtb.value = !sideBarShowFtb.value
      },
    },
  ]
  return result
})

</script>
