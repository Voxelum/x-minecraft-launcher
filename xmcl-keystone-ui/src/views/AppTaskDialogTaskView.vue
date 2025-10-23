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
          <v-virtual-scroll
            v-else
            :items="flattenedTasks"
            item-height="72"
            height="360"
          >
            <template #default="{ item, index }">
              <!-- Оборачиваем в div для избежания проблем с корневым элементом и v-divider -->
              <div :key="item.id" class="virtual-item-wrapper">
                <div class="v-list-item py-2">
                  <div class="v-list-item__content">
                    <div class="v-list-item__title d-flex align-center">
                      <span class="truncate mr-2">{{
                        tTask(item.path, item.param)
                      }}</span>
                      <v-chip
                        v-if="item.isGrouped"
                        x-small
                        color="info"
                        text-color="white"
                      >
                        {{ item.groupedCount }} {{ t("task.collapsed") }}
                      </v-chip>
                    </div>
                    <div class="v-list-item__subtitle mt-1">
                      <div class="d-flex flex-wrap gap-2">
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
                      <AppTaskDialogTaskViewMessage
                        :value="
                          item.message
                            ? item.message
                            : item.from || item.to || ''
                        "
                        class="mt-1"
                      />
                    </div>
                    <!-- Прогресс-бар внутри элемента списка -->
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
                      v-else-if="item.state === 0 || item.state === 3"
                      class="mt-2 grey--text caption"
                    >
                      <v-progress-linear
                        indeterminate
                        height="4"
                        :color="getProgressColor(item.state)"
                      ></v-progress-linear>
                    </div>
                  </div>
                  <div class="v-list-item__action d-flex flex-column align-end">
                    <TaskDialogNodeStatus
                      :item="item"
                      :show-number="false"
                      @pause="pause(item)"
                      @resume="resume(item)"
                      @cancel="cancel(item)"
                    />
                  </div>
                </div>
                <!-- Добавляем v-divider как отдельный элемент, если не последний -->
                <v-divider v-if="index < flattenedTasks.length - 1"></v-divider>
              </div>
            </template>
          </v-virtual-scroll>
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
                  <span>{{ t("task.connection.destroy_pool") }}</span>
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
        <span>{{ t("task.clear.tooltip") }}</span>
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
import { Ref, computed, watch } from "vue";
import { useTaskName } from "../composables/task";
import TaskDialogNodeStatus from "./AppTaskDialogNodeStatus.vue";
import AppTaskDialogTaskViewMessage from "./AppTaskDialogTaskViewMessage";

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

// Вспомогательные функции для отображения статуса
const getStatusText = (state: TaskState) => {
  const statusMap: Record<TaskState, string> = {
    [TaskState.Running]: t("task.running"),
    [TaskState.Succeed]: t("task.succeed"),
    [TaskState.Failed]: t("task.failed"),
    [TaskState.Paused]: t("task.paused"),
    [TaskState.Cancelled]: t("task.cancelled"),
    [TaskState.Queued]: t("task.queued"),
    [TaskState.Unknown]: t("task.unknown"),
  };
  return statusMap[state] || t("task.unknown");
};

const getStatusColor = (state: TaskState) => {
  const colorMap: Record<TaskState, string> = {
    [TaskState.Running]: "primary",
    [TaskState.Succeed]: "success",
    [TaskState.Failed]: "error",
    [TaskState.Paused]: "warning",
    [TaskState.Cancelled]: "grey",
    [TaskState.Queued]: "info",
    [TaskState.Unknown]: "default",
  };
  return colorMap[state];
};

const getProgressColor = (state: TaskState) => {
  const colorMap: Record<TaskState, string> = {
    [TaskState.Running]: "primary",
    [TaskState.Queued]: "info",
    [TaskState.Succeed]: "success",
    [TaskState.Failed]: "error",
    [TaskState.Paused]: "warning",
    [TaskState.Cancelled]: "grey",
    [TaskState.Unknown]: "default",
  };
  return colorMap[state];
};

const calculatePercentage = (progress: number, total: number) => {
  if (total <= 0) return 0;
  return Math.min((progress / total) * 100, 100);
};

// Плоский список для виртуального скроллинга
const flattenedTasks = computed(() => {
  const flat: TaskItemOrGroup[] = [];
  const addTask = (task: TaskItemOrGroup) => {
    flat.push(task);
    if (task.children && task.children.length) {
      task.children.forEach(addTask);
    }
  };
  visible.value.forEach(addTask);
  return flat;
});

const visible: Ref<TaskItem[]> = ref([]);

const getReactiveItems = (items: TaskItem[]) => {
  if (items.length <= 6) {
    return [...items];
  }
  const activeTasks: TaskItem[] = [];
  const failedTasks: TaskItem[] = [];
  const nonActiveTasks: TaskItem[] = [];
  for (const i of items) {
    if (i.state === TaskState.Running || i.state === TaskState.Queued) {
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
    if (t.rawChildren) {
      t.children = getReactiveItems(t.rawChildren);
      t.childrenDirty = false;
    }
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
      visible.value = all.value;
      interval = setInterval(() => {
        getNetworkStatus().then((s) => {
          stat.value = s;
        });
      }, 1000);
    } else {
      clearInterval(interval);
      taskMonitor.removeListener("task-update", onUpdate);
      makeNonReactive();
      visible.value = [];
    }
  },
  { immediate: true }
);

function onClear() {
  clear();
  visible.value = [...all.value];
}

function onTaskClick(event: MouseEvent, item: TaskItem) {
  if (typeof item.message === "string") {
    windowController.writeClipboard(item.message ?? "");
  }
}
</script>

<style scoped>
/* Дополнительные стили для имитации v-list-item и улучшения визуального восприятия */
.virtual-item-wrapper {
  display: block;
}
.v-list-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
}
.v-list-item__content {
  flex: 1 1 auto;
  min-width: 0;
}
.v-list-item__title {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.4rem;
  letter-spacing: 0.00938em;
}
.v-list-item__subtitle {
  font-size: 0.875rem;
  line-height: 1.25rem;
  letter-spacing: 0.01786em;
  /* Используем встроенные классы Vuetify */
  color: rgba(0, 0, 0, 0.6); /* grey--text text--darken-1 */
}
.theme--dark .v-list-item__subtitle {
  color: rgba(255, 255, 255, 0.7);
}
.v-list-item__action {
  display: flex;
  align-items: flex-start;
  margin: 0 4px;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
</style>
