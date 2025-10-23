<template>
  <v-card
    flat
    class="flex flex-col overflow-hidden"
    style="min-height: 400px; max-height: 70vh; width: 600px"
  >
    <v-toolbar tabs class="flex-grow-0" color="surface">
      <v-toolbar-title class="font-weight-medium">
        {{ t("task.manager") }}
      </v-toolbar-title>
      <v-spacer />
      <v-btn icon small @click="hide" class="mr-1">
        <v-icon>close</v-icon>
      </v-btn>
      <template #extension>
        <v-tabs v-model="tab" centered background-color="transparent">
          <v-tab>
            <v-icon left small>list</v-icon>
            {{ t("task.name", 2) }}
          </v-tab>
          <v-tab>
            <v-icon left small>device_hub</v-icon>
            {{ t("task.connections") }}
          </v-tab>
        </v-tabs>
      </template>
    </v-toolbar>

    <v-card-text class="flex-grow-1 overflow-auto pa-0">
      <v-tabs-items v-model="tab" class="flex-grow-1">
        <v-tab-item key="tasks">
          <div v-if="visible.length === 0" class="text-center grey--text pa-8">
            {{ t("task.empty") }}
          </div>
          <v-treeview
            v-else
            v-model="data.tree"
            hoverable
            transition
            :open="data.opened"
            :items="visible"
            activatable
            item-key="id"
            item-children="children"
            class="pa-2"
          >
            <template #label="{ item }">
              <div
                class="d-flex align-center py-2 px-3"
                @click="onTaskClick($event, item)"
                @mouseenter.prevent="data.hovered[item.id] = true"
                @mouseleave.prevent="data.hovered[item.id] = false"
                style="cursor: pointer"
              >
                <!-- Task information -->
                <div class="flex-grow-1">
                  <div class="d-flex align-center">
                    <span class="truncate mr-2">{{
                      tTask(item.path, item.param)
                    }}</span>
                  </div>
                  <div class="d-flex flex-wrap gap-2 mt-1">
                    <v-chip
                      small
                      label
                      outlined
                      :color="getStatusColor(item.state)"
                    >
                      {{ getStatusText(item.state) }}
                    </v-chip>
                    <span class="grey--text text--darken-1 caption">{{
                      item.time.toLocaleString()
                    }}</span>
                  </div>
                  <!-- Main task progress bar -->
                  <v-progress-linear
                    v-if="
                      item.progress !== undefined &&
                      item.total !== undefined &&
                      item.total > 0
                    "
                    :value="calculatePercentage(item.progress, item.total)"
                    height="4"
                    class="mt-2"
                    :color="getProgressColor(item.state)"
                  ></v-progress-linear>
                  <div
                    v-else-if="
                      item.state === TaskState.Idle ||
                      item.state === TaskState.Running
                    "
                    class="mt-2 grey--text caption"
                  >
                    <v-progress-linear
                      indeterminate
                      height="4"
                      :color="getProgressColor(item.state)"
                    ></v-progress-linear>
                  </div>
                </div>

                <!-- Action buttons -->
                <div class="task-actions d-flex align-center gap-1 ml-2">
                  <!-- Pause -->
                  <v-tooltip bottom>
                    <template #activator="{ on, attrs }">
                      <v-btn
                        v-bind="attrs"
                        v-on="on"
                        icon
                        x-small
                        @click.stop="pause(item)"
                        :disabled="item.state !== TaskState.Running"
                      >
                        <v-icon size="18">pause</v-icon>
                      </v-btn>
                    </template>
                    <span>{{ t("task.pause") }}</span>
                  </v-tooltip>

                  <!-- Resume -->
                  <v-tooltip bottom>
                    <template #activator="{ on, attrs }">
                      <v-btn
                        v-bind="attrs"
                        v-on="on"
                        icon
                        x-small
                        @click.stop="resume(item)"
                        :disabled="item.state !== TaskState.Paused"
                      >
                        <v-icon size="18">play_arrow</v-icon>
                      </v-btn>
                    </template>
                    <span>{{ t("task.resume") }}</span>
                  </v-tooltip>

                  <!-- Cancel -->
                  <v-tooltip bottom>
                    <template #activator="{ on, attrs }">
                      <v-btn
                        v-bind="attrs"
                        v-on="on"
                        icon
                        x-small
                        @click.stop="cancel(item)"
                        :disabled="
                          item.state !== TaskState.Running &&
                          item.state !== TaskState.Paused
                        "
                      >
                        <v-icon size="18" color="error">close</v-icon>
                      </v-btn>
                    </template>
                    <span>{{ t("task.cancel") }}</span>
                  </v-tooltip>

                  <!-- Cancel button is now used for failed tasks to remove them -->
                  <v-tooltip bottom v-if="item.state === TaskState.Failed">
                    <template #activator="{ on, attrs }">
                      <v-btn
                        v-bind="attrs"
                        v-on="on"
                        icon
                        x-small
                        @click.stop="cancel(item)"
                        :disabled="item.state !== TaskState.Failed"
                      >
                        <v-icon size="18" color="error">close</v-icon>
                      </v-btn>
                    </template>
                    <span>{{ t("task.remove") }}</span>
                  </v-tooltip>
                </div>

                <!-- Status icon -->
                <v-icon
                  v-if="item.state === TaskState.Succeed"
                  small
                  color="success"
                  class="ml-2"
                >
                  check_circle_outline
                </v-icon>
                <v-icon
                  v-else-if="item.state === TaskState.Failed"
                  small
                  color="error"
                  class="ml-2"
                >
                  error_outline
                </v-icon>
                <v-icon
                  v-else-if="item.state === TaskState.Cancelled"
                  small
                  color="grey"
                  class="ml-2"
                >
                  stop
                </v-icon>
              </div>
            </template>

            <!-- Additional content (for subtasks) -->
            <template #append="{ item }">
              <!-- You can add additional actions here if needed -->
            </template>
          </v-treeview>
        </v-tab-item>

        <v-tab-item key="connections">
          <v-list dense two-line class="pa-2">
            <v-list-item
              v-for="[origin, stats] of Object.entries(stat)"
              :key="origin"
              class="rounded ma-1"
            >
              <v-list-item-content>
                <v-list-item-title class="font-weight-medium">
                  {{ origin }}
                </v-list-item-title>
                <v-list-item-subtitle class="d-flex flex-wrap gap-2 mt-1">
                  <v-chip small label outlined color="success">
                    {{ t("task.connection.connected") }}: {{ stats.connected }}
                  </v-chip>
                  <v-chip small label outlined color="primary">
                    {{ t("task.connection.free") }}: {{ stats.free }}
                  </v-chip>
                  <v-chip small label outlined color="warning">
                    {{ t("task.connection.pending") }}: {{ stats.pending }}
                  </v-chip>
                  <v-chip small label outlined color="info">
                    {{ t("task.connection.queued") }}: {{ stats.queued }}
                  </v-chip>
                  <v-chip small label outlined color="accent">
                    {{ t("task.connection.running") }}: {{ stats.running }}
                  </v-chip>
                  <v-chip small label outlined color="grey">
                    {{ t("task.connection.size") }}: {{ stats.size }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action>
                <v-tooltip bottom>
                  <template #activator="{ on, attrs }">
                    <v-btn
                      v-bind="attrs"
                      v-on="on"
                      icon
                      small
                      @click="destroyPool(origin)"
                      class="ma-0"
                    >
                      <v-icon color="error">delete_forever</v-icon>
                    </v-btn>
                  </template>
                  <span>{{ t("task.connection_destroy_pool") }}</span>
                </v-tooltip>
              </v-list-item-action>
            </v-list-item>
          </v-list>
        </v-tab-item>
      </v-tabs-items>
    </v-card-text>

    <v-divider></v-divider>

    <v-card-actions class="pa-3">
      <v-spacer></v-spacer>
      <v-tooltip bottom>
        <template #activator="{ on, attrs }">
          <v-btn
            v-bind="attrs"
            v-on="on"
            text
            small
            @click="onClear"
            class="mr-2"
          >
            <v-icon left small>delete_forever</v-icon>
            {{ t("task.clear") }}
          </v-btn>
        </template>
        <span>{{ t("task.clear_tooltip") }}</span>
      </v-tooltip>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { useService } from "@/composables";
import { useDialog } from "@/composables/dialog";
import { kTaskManager } from "@/composables/taskManager";
import { TaskItem } from "@/entities/task";
import { injection } from "@/util/inject";
import { BaseServiceKey, PoolStats, TaskState } from "@xmcl/runtime-api";
import { Ref, computed, watch, ref, reactive } from "vue";
import { useTaskName } from "../composables/task";
import { markRaw } from "vue";
import { useI18n } from "vue-i18n";
// import { windowController } from "@/composables/window"; // Removed import
import { taskMonitor } from "@/composables/taskMonitor";

interface TaskItemOrGroup extends TaskItem {
  isGrouped: boolean;
  groupedCount: number;
}

const tab = ref(0);

const { tasks: all, pause, resume, cancel, clear } = injection(kTaskManager);
const { t } = useI18n();
const tTask = useTaskName();
const { getNetworkStatus, destroyPool } = useService(BaseServiceKey);

const stat: Ref<Record<string, PoolStats>> = ref({});

const getStatusText = (state: TaskState) => {
  const statusMap: Record<TaskState, string> = {
    [TaskState.Idle]: t("task.idle"),
    [TaskState.Running]: t("task.running"),
    [TaskState.Succeed]: t("task.succeed"),
    [TaskState.Failed]: t("task.failed"),
    [TaskState.Paused]: t("task.paused"),
    [TaskState.Cancelled]: t("task.cancelled"),
  };
  return statusMap[state] ?? t("task.unknown");
};

const getStatusColor = (state: TaskState) => {
  const colorMap: Record<TaskState, string> = {
    [TaskState.Idle]: "default",
    [TaskState.Running]: "primary",
    [TaskState.Succeed]: "success",
    [TaskState.Failed]: "error",
    [TaskState.Paused]: "warning",
    [TaskState.Cancelled]: "grey",
  };
  return colorMap[state] ?? "default";
};

const getProgressColor = (state: TaskState) => {
  const colorMap: Record<TaskState, string> = {
    [TaskState.Idle]: "default",
    [TaskState.Running]: "primary",
    [TaskState.Succeed]: "success",
    [TaskState.Failed]: "error",
    [TaskState.Paused]: "warning",
    [TaskState.Cancelled]: "grey",
  };
  return colorMap[state] ?? "default";
};

const calculatePercentage = (progress: number, total: number) => {
  if (total <= 0) return 0;
  return Math.min((progress / total) * 100, 100);
};

const data = reactive({
  tree: [],
  opened: [],
  hovered: {} as Record<string, boolean>,
});

const visible = computed(() => {
  console.log("All tasks:", all.value);
  return all.value;
});

const onTaskClick = (event: MouseEvent, item: TaskItem) => {
  if (typeof item.message === "string") {
    // windowController.writeClipboard(item.message ?? ""); // Removed this line
    // Add alternative logic if needed, e.g., show message in UI or log
    console.log("Task message:", item.message);
  }
};

const getReactiveItems = (items: TaskItem[]) => {
  if (items.length <= 6) {
    return [...items];
  }
  const activeTasks: TaskItem[] = [];
  const failedTasks: TaskItem[] = [];
  const nonActiveTasks: TaskItem[] = [];
  for (const i of items) {
    if (i.state === TaskState.Running) {
      activeTasks.push(i);
    } else if (i.state === TaskState.Failed) {
      failedTasks.push(markRaw(i));
    } else {
      nonActiveTasks.push(markRaw(i));
    }
  }
  return [
    ...activeTasks,
    ...failedTasks.map(markRaw),
    ...nonActiveTasks.map(markRaw),
  ];
};

const onUpdate = () => {
  for (const t of all.value) {
    if (t.childrenDirty && t.rawChildren) {
      t.children = getReactiveItems(t.rawChildren);
      t.childrenDirty = false;
    }
  }
};

const makeReactive = () => {
  for (const t of all.value) {
    t.children = getReactiveItems(t.rawChildren ?? []);
    t.childrenDirty = false;
  }
};

const makeNonReactive = () => {
  for (const t of all.value) {
    t.children = [];
    t.childrenDirty = true;
  }
};

const { isShown, hide } = useDialog("task");
let interval: ReturnType<typeof setInterval>;

watch(
  isShown,
  (value) => {
    if (value) {
      taskMonitor.on("task-update", onUpdate);
      makeReactive();
      interval = setInterval(() => {
        getNetworkStatus().then((s) => {
          stat.value = s;
        });
      }, 1000);
    } else {
      clearInterval(interval);
      taskMonitor.removeListener("task-update", onUpdate);
      makeNonReactive();
    }
  },
  { immediate: true }
);

function onClear() {
  clear();
}
</script>

<style scoped>
/* Styles for v-treeview */
.v-treeview-node__root {
  padding: 0 !important;
}

.v-treeview-node__content {
  padding: 0 !important;
}

.task-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cursor-pointer {
  cursor: pointer;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gap-1 {
  gap: 0.25rem;
}
.gap-2 {
  gap: 0.5rem;
}
.d-flex {
  display: flex;
}
.align-center {
  align-items: center;
}
.ml-2 {
  margin-left: 0.5rem;
}
.mr-2 {
  margin-right: 0.5rem;
}
.mt-1 {
  margin-top: 0.25rem;
}
.mt-2 {
  margin-top: 0.5rem;
}
.py-2 {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}
.px-3 {
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}
</style>
