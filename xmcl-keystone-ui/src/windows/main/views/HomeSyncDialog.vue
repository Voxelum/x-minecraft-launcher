<template>
  <v-dialog v-model="isShown">
    <div v-if="updates.length > 0">
      <v-treeview
        v-model="selected"
        class="export-dialog-files"
        :open="opened"
        style="width: 100%"
        :items="tree"
        selectable
        hoverable
        activatable
        transition
        open-on-click
        item-children="children"
      >
        <template #prepend="{ item, open }">
          <v-icon
            v-if="item.children"
            :color="selected ? 'accent' : ''"
          >
            {{ open ? 'folder_open' : 'folder' }}
          </v-icon>
          <v-icon v-else>
            insert_drive_file
          </v-icon>
        </template>

        <template #label="{ item }">
          <div style="padding: 5px 0px;">
            <span
              style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;"
              :style="{ color: item.disabled ? 'grey' : 'white' }"
            >{{ item.name }}</span>
            <!-- <div
              style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;"
            >
              {{ getDescription(item.id) }}
            </div>
            <div
              v-if="item.size > 0"
              style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;"
            >
              {{ item.size > 0 ? getExpectedSize(item.size) : '' }}
            </div> -->
          </div>
        </template>

        <template #append="{ item }">
          {{ item.operation }}
          <!-- <v-select
            v-if="item.sources.length > 0 && selected"
            v-model="item.source"
            :label="t('exportModpackTarget.name')"
            class="w-50"
            :items="(item.sources.concat([''])).map(getSourceItem)"
            hide-details
            flat
          />-->
        </template>
      </v-treeview>
    </div>
  </v-dialog>
</template>
<script lang="ts" setup>
import { useDialog } from '../composables/dialog'
import { CurseForgeServiceKey, InstanceIOServiceKey, InstanceUpdate } from '@xmcl/runtime-api'
import { useServiceBusy, useService } from '/@/composables'
import { basename } from '/@/util/basename'

export interface UpdateFileNode {
  name: string
  id: string
  operation: 'add' | 'update'
  children?: UpdateFileNode[]
}

const { isShown } = useDialog('instance-sync')

const { getInstanceUpdate, applyInstanceUpdate } = useService(InstanceIOServiceKey)
const { fetchProject } = useService(CurseForgeServiceKey)
const checkingUpdate = useServiceBusy(InstanceIOServiceKey, 'getInstanceUpdate')

const updates = ref([] as UpdateFileNode[])
const tree = ref([] as UpdateFileNode[])
const opened = ref([])
const selected = ref([] as string[])

function buildEdges(cwd: UpdateFileNode[], filePaths: string[], currentPath: string, file: UpdateFileNode) {
  const remained = filePaths.slice(1)
  if (remained.length > 0) { // edge
    const name = filePaths[0]
    let edgeNode = cwd.find(n => n.name === name)
    if (!edgeNode) {
      edgeNode = {
        name,
        id: currentPath,
        operation: 'update',
        children: [],
      }
      cwd.push(edgeNode)
    }
    buildEdges(edgeNode.children!, remained, currentPath ? (currentPath + '/' + name) : name, file)
  } else { // leaf
    cwd.push(file)
  }
}

async function check() {
  const result = await getInstanceUpdate()
  if (result) {
    const leaves: UpdateFileNode[] = []
    for (const update of result.updates) {
      if (update.file.path) {
        const node: UpdateFileNode = {
          name: basename(update.file.path),
          id: update.file.path,
          operation: update.operation,
        }
        leaves.push(node)
      }
    }
    const roots: UpdateFileNode[] = []
    for (const file of leaves) {
      buildEdges(roots, file.id.split('/'), '', file)
    }
    tree.value = roots
    updates.value = leaves
  } else {
    tree.value = []
    updates.value = []
  }
}

async function update() {
  // await applyInstanceUpdate([])
}

onMounted(check)

watch(isShown, (opened) => {
  if (opened) {
    check()
  }
})
</script>
