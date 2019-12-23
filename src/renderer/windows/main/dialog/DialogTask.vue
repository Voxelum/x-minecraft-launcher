<template>
  <v-dialog v-model="isShown" persistent hide-overlay width="500" style="max-height: 100%">
    <v-toolbar dark tabs color="grey darken-3">
      <v-toolbar-title>{{ $t('task.manager') }}</v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="close">
        <v-icon>arrow_drop_down</v-icon>
      </v-btn>
    </v-toolbar>
    <v-card flat style="min-height: 300px; max-height: 400px; max-width: 100%; overflow: auto;" dark color="grey darken-4">
      <v-card-text>
        {{ all.length === 0 ? $t('task.empty') : '' }}
        <v-treeview v-model="tree" hoverable transition :open="opened" :items="all" activatable
                    item-key="id" open-on-click item-children="children" item-text="localText">
          <template v-slot:append="{ item }">
            <task-node-status :has-child="item.children.length !== 0" :status="item.status" :uuid="item.id" :hovered="hovered[item.id]" />
          </template>

          <template v-slot:label="{ item }">
            <div style="padding: 5px 0px;" @click="onTaskClick($event, item)" @contextmenu="showTaskContext($event, item)" @mouseenter.prevent="hovered[item.id] = true" @mouseleave.prevent="hovered[item.id] = false">
              <span style="white-space: nowrap; overflow: hidden;  text-overflow: ellipsis; max-width: 250px;">{{ $t(item.path, item.arguments || {}) }}</span>
              <div style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;">
                {{ item.time }}
              </div>
              <div style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;">
                {{ item.message }}
              </div>
            </div>
          </template>
        </v-treeview>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, computed, toRefs } from '@vue/composition-api';
import { TaskState } from 'universal/store/modules/task';
import { useStore, useDialogSelf, useClipboard } from '@/hooks';

export default {
  props: {
    value: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    const { state } = useStore();
    const clipboard = useClipboard();
    const { showDialog, isShown } = useDialogSelf('task');

    const data = reactive({
      tree: [],
      opened: [],
      active: 0,
      hovered: {},
    });
    const all = computed(() => state.task.tasks.filter(n => !n.background));

    return {
      ...toRefs(data),
      all,
      isShown,
      close() { showDialog(''); },
      showTaskContext(/* event, item */) {
        // this.$menu([{ title: 'hello', onClick() { } }], event.clientX, event.clientY);
      },
      onTaskClick(event: MouseEvent, item: TaskState) {
        clipboard.writeText(item.message || '');
      },
      // cancelTask(event, id) {
      //   dispatch('cancelTask', id);
      // },
    };
  },
};
</script>

<style scoped=true>
.v-progress-linear {
  margin-left: 10px;
}
</style>
<style>
.v-treeview-node__label {
  white-space: normal;
  line-break: normal;
  word-break: break-all;
}
.v-treeview > .v-treeview-node--leaf {
  margin-left: 0px;
}
</style>
