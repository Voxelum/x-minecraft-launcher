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
        item-text="localText"
      >
        <template v-slot:append="{ item }">
          <task-node-status
            :has-child="item.children.length !== 0"
            :status="item.status"
            :progress="item.progress"
            :total="item.total"
            :message="item.message"
            :uuid="item.id"
            :show-number="hovered[item.id]"
            @pause="pause(item.id)"
            @resume="resume(item.id)"
          />
        </template>

        <template v-slot:label="{ item }">
          <div
            style="padding: 5px 0px;"
            @click="onTaskClick($event, item)"
            @mouseenter.prevent="hovered[item.id] = true"
            @mouseleave.prevent="hovered[item.id] = false"
          >
            <span
              style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;"
            >{{ $t(item.path, item.arguments || {}) }}</span>
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
import { reactive, toRefs, defineComponent } from '@vue/composition-api';
import { TaskState } from '@universal/task';
import { useClipboard, useTasks } from '@/hooks';

export default defineComponent({
  setup() {
    const clipboard = useClipboard();
    const { tasks, pause, resume, cancel } = useTasks();

    const data = reactive({
      tree: [],
      opened: [],
      active: 0,
      hovered: {},
    });

    return {
      ...toRefs(data),
      all: tasks,
      pause,
      resume,
      cancel,
      onTaskClick(event: MouseEvent, item: TaskState) {
        clipboard.writeText(item.message || '');
      },
    };
  },
});
</script>
