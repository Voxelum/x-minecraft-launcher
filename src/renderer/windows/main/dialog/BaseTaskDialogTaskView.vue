<template>
  <v-card
    flat
    style="min-height: 300px; max-height: 400px; max-width: 100%; overflow: auto;"
    dark
    color="grey darken-4"
  >
    <v-card-text>
      {{ all.length === 0 ? $t('task.empty') : '' }}
      <v-treeview
        v-model="tree"
        hoverable
        transition
        :open="opened"
        :items="all"
        activatable
        item-key="id"
        item-children="children"
      >
        <template #append="{ item }">
          <task-node-status
            :item="item"
            :show-number="hovered[item.id]"
            @pause="pause(item)"
            @resume="resume(item)"
          />
        </template>

        <template #label="{ item }">
          <div
            style="padding: 5px 0px; max-width: 300px"
            @click="onTaskClick($event, item)"
            @mouseenter.prevent="hovered[item.id] = true"
            @mouseleave.prevent="hovered[item.id] = false"
          >
            <span
              style="max-width: 100px;"
            >{{ item.title }}</span>
            <div
              style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;"
            >
              {{ item.time }}
            </div>
            <div
              style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;"
            >
              {{ item.message }}
            </div>
          </div>
        </template>
      </v-treeview>
    </v-card-text>
  </v-card>
</template>

<script lang=ts>
import { reactive, toRefs, defineComponent } from '@vue/composition-api'
import { useClipboard, useTasks } from '/@/hooks'
import { TaskItem } from '/@/entities/task'

export default defineComponent({
  setup() {
    const clipboard = useClipboard()
    const { tasks, pause, resume, cancel } = useTasks()

    const data = reactive({
      tree: [],
      opened: [],
      active: 0,
      hovered: {} as Record<string, boolean>,
    })

    return {
      ...toRefs(data),
      all: tasks,
      pause,
      resume,
      cancel,
      onTaskClick(event: MouseEvent, item: TaskItem) {
        clipboard.writeText(item.message || '')
      },
    }
  },
})
</script>
