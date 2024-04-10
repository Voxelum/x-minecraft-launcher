<template>
  <v-card
    flat
    style="min-height: 300px; max-width: 100%;"
    class="flex flex-col overflow-auto"
  >
    <v-toolbar
      tabs
      class="flex-grow-0"
    >
      <v-toolbar-title>{{ t('task.manager') }}</v-toolbar-title>
      <v-spacer />
      <v-btn
        icon
        @click="hide"
      >
        <v-icon>close</v-icon>
      </v-btn>
      <template #extension>
        <v-tabs
          v-model="tab"
          centered
        >
          <v-tab>{{ t('task.name', 2) }}</v-tab>
          <v-tab>{{ t('task.connections' ) }}</v-tab>
        </v-tabs>
      </template>
    </v-toolbar>

    <v-card-text class="visible-scroll max-h-[400px] overflow-auto">
      <v-tabs-items v-model="tab">
        <v-tab-item
          :key="0"
        >
          <div
            v-if="visible.length === 0"
            class="mt-4"
          >
            {{ t('task.empty') }}
          </div>
          <v-treeview
            v-model="data.tree"
            hoverable
            transition
            :open="data.opened"
            :items="visible"
            activatable
            item-key="id"
            item-children="children"
          >
            <template #append="{ item }">
              <TaskDialogNodeStatus
                :item="item"
                :show-number="data.hovered[item.id]"
                @pause="pause(item)"
                @resume="resume(item)"
                @cancel="cancel(item)"
              />
            </template>

            <template #label="{ item }">
              <div
                style="padding: 5px 0px;"
                @click="onTaskClick($event, item)"
                @mouseenter.prevent="data.hovered[item.id] = true"
                @mouseleave.prevent="data.hovered[item.id] = false"
              >
                <span style="max-width: 100px;">
                  {{ tTask(item.path, item.param) }}

                  <span v-if="item.isGrouped">
                    ({{ item.groupedCount }} similar is collapsed)
                  </span>

                </span>
                <div style="color: grey; font-size: 12px; font-style: italic; max-width: 400px;">
                  {{ item.time.toLocaleString() }}
                </div>
                <div
                  style="color: grey; font-size: 12px; font-style: italic; max-width: 400px; word-wrap: normal; overflow-wrap: break-word; white-space: normal;"
                >
                  <AppTaskDialogTaskViewMessage :value="item.message ? item.message : item.from || item.to || ''" />
                </div>
              </div>
            </template>
          </v-treeview>
        </v-tab-item>
        <v-tab-item
          :key="1"
        >
          <v-list
            dense
            two-lines
          >
            <v-list-item
              v-for="[o, s] of Object.entries(stat)"
              :key="o"
            >
              <v-list-item-content>
                <v-list-item-title>
                  {{ o }}
                </v-list-item-title>
                <v-list-item-subtitle class="flex gap-3">
                  <span>
                    {{ t('task.connection.connected') }}: {{ s.connected }}
                  </span>
                  <span>
                    {{ t('task.connection.free') }}: {{ s.free }}
                  </span>
                  <span>
                    {{ t('task.connection.pending') }}: {{ s.pending }}
                  </span>
                  <span>
                    {{ t('task.connection.queued') }}: {{ s.queued }}
                  </span>
                  <span>
                    {{ t('task.connection.running') }}: {{ s.running }}
                  </span>
                  <span>
                    {{ t('task.connection.size') }}: {{ s.size }}
                  </span>
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action>
                <v-btn
                  icon
                  small
                  @click="destroyPool(o)"
                >
                  <v-icon>
                    close
                  </v-icon>
                </v-btn>
              </v-list-item-action>
            </v-list-item>
          </v-list>
        </v-tab-item>
      </v-tabs-items>
    </v-card-text>
    <div class="flex-grow" />
    <v-card-actions class="flex flex-grow-0">
      <div class="flex-grow" />
      <v-btn
        text
        small
        @click="clear"
      >
        <v-icon left>
          delete_forever
        </v-icon>
        {{ t('task.clear') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang=ts setup>
import { useService } from '@/composables'
import { useTaskName } from '../composables/task'
import TaskDialogNodeStatus from './AppTaskDialogNodeStatus.vue'
import AppTaskDialogTaskViewMessage from './AppTaskDialogTaskViewMessage'

import { useDialog } from '@/composables/dialog'
import { kTaskManager } from '@/composables/taskManager'
import { TaskItem } from '@/entities/task'
import { injection } from '@/util/inject'
import { BaseServiceKey, PoolStats, TaskState } from '@xmcl/runtime-api'
import { Ref } from 'vue'

interface TaskItemOrGroup extends TaskItem {
  isGrouped: boolean
  groupedCount: number
}

const tab = ref(0)

const { tasks: all, pause, resume, cancel, clear } = injection(kTaskManager)
const { t } = useI18n()
const tTask = useTaskName()
const { getNetworkStatus, destroyPool } = useService(BaseServiceKey)

const stat: Ref<Record<string, PoolStats>> = ref({})

const visible: Ref<TaskItem[]> = ref([])

const getReactiveItems = (items: TaskItem[]) => {
  if (items.length <= 6) {
    // Directly return if the length is less than 6
    return [...items]
  }
  const activeTasks: TaskItem[] = []
  const failedTasks: TaskItem[] = []
  const nonActiveTasks: TaskItem[] = []
  for (const i of items) {
    if (i.state === TaskState.Running) {
      // Running task should go first
      activeTasks.push(i)
    } else if (i.state === TaskState.Failed) {
      failedTasks.push(markRaw(i))
    } else {
      nonActiveTasks.push(markRaw(i))
    }
  }
  const subGroup = (groupItems: TaskItem[], maxSize: number) => {
    if (maxSize === 0) return []
    if (groupItems.length < maxSize) return groupItems
    return groupItems.slice(0, maxSize - 1).concat({
      ...groupItems[maxSize - 1],
      isGrouped: true,
      groupedCount: groupItems.length - 1,
    } as TaskItemOrGroup)
  }
  const group = (groupItems: TaskItem[], maxSize: number) => {
    if (groupItems.length < maxSize) {
      return groupItems
    }
    const byType: TaskItem[][] = [[groupItems[0]]]
    for (const cur of groupItems.slice(1)) {
      const lastGroup = byType[byType.length - 1]
      // Same path and same state go to one bag
      if (lastGroup[0].path === cur.path && lastGroup[0].state === cur.state) {
        lastGroup.push(cur)
      } else {
        byType.push([cur])
      }
    }

    if (byType.length >= maxSize) {
      // Map each on to group
      return byType.slice(0, maxSize).map(g => g.length > 1 ? ({ ...g[0], isGrouped: true, groupedCount: g.length - 1 }) : g[0])
    }

    // 4 slots
    // [ ] [ ] [3] [4]
    // remaining 2
    // expand(3, 2 + 1)
    // remaining = 2 - (3 - 1) = 0
    // [1] [1] [1] [4]

    // [ ] [ ] [1] [4]
    // remaining 2
    // expand 1
    // remaining = 2 - (1 - 1) = 2
    // [1] [ ] [ ] [4]
    // expand(4, 2 + 1)

    // 4 - 2 = 2
    // 2 < (2 + 1) ?
    const result: TaskItem[] = []
    let remaining = maxSize - byType.length
    let index = 0
    while (remaining > 0) {
      const currentGroup = byType[index]
      const expand = subGroup(currentGroup, remaining + 1)
      result.push(...expand)
      remaining -= (expand.length - 1)
      index++
      if (remaining <= 0) {
        break
      }
    }

    return result
  }
  return [...group(activeTasks, 4), ...group(failedTasks, 4).map(markRaw), ...group(nonActiveTasks, 4).map(markRaw)]
}

const onUpdate = () => {
  for (const t of all.value) {
    if (t.childrenDirty && t.rawChildren) {
      t.children = getReactiveItems(t.rawChildren)
      t.childrenDirty = false
    }
  }
}

const makeReactive = () => {
  for (const t of all.value) {
    if (t.rawChildren) {
      t.children = getReactiveItems(t.rawChildren)
      t.childrenDirty = false
    }
  }
}

const makeNonReactive = () => {
  for (const t of all.value) {
    t.children = []
    t.childrenDirty = true
  }
}

const { isShown, hide } = useDialog('task')
let interval: ReturnType<typeof setInterval>

watch(isShown, (value) => {
  if (value) {
    taskMonitor.on('task-update', onUpdate)
    makeReactive()
    visible.value = all.value
    interval = setInterval(() => {
      getNetworkStatus().then((s) => {
        stat.value = s
      })
    }, 1000)
  } else {
    clearInterval(interval)
    taskMonitor.removeListener('task-update', onUpdate)
    makeNonReactive()
    visible.value = []
  }
}, { immediate: true })

const data = reactive({
  tree: [],
  opened: [],
  hovered: {} as Record<string, boolean>,
})

function onTaskClick(event: MouseEvent, item: TaskItem) {
  if (typeof item.message === 'string') {
    navigator.clipboard.writeText(item.message ?? '')
  }
}
</script>
