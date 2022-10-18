<template>
  <v-card
    flat
    style="min-height: 300px; max-height: 400px; max-width: 100%; overflow: auto;"
  >
    <v-card-text>
      {{ all.length === 0 ? t('task.empty') : '' }}
      <v-treeview
        v-model="data.tree"
        hoverable
        transition
        :open="data.opened"
        :items="all"
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
            <span style="max-width: 100px;">{{ item.title }}</span>
            <div
              style="color: grey; font-size: 12px; font-style: italic; max-width: 400px;"
            >
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
    </v-card-text>
  </v-card>
</template>

<script lang=ts setup>
import { useTasks } from '../composables/task'
import TaskDialogNodeStatus from './AppTaskDialogNodeStatus.vue'
import AppTaskDialogTaskViewMessage from './AppTaskDialogTaskViewMessage'

import { TaskItem } from '@/entities/task'

const { tasks: all, pause, resume, cancel } = useTasks()
const { t } = useI18n()

const data = reactive({
  tree: [],
  opened: [],
  hovered: {} as Record<string, boolean>,
})

function onTaskClick(event: MouseEvent, item: TaskItem) {
  // TODO: fix
  // navigator.clipboard.writeText(item.message ?? '')
}
</script>
