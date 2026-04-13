<template>
  <v-snackbar
    v-model="data.show"
    :multi-line="data.operations.length > 0"
    :top="true"
    :right="true"
    :timeout="data.level === 'success' ? 10000 : -1"
    class="select-none modern-snackbar"
    elevation="8"
    rounded="lg"
  >
    <div class="snackbar-content">
      <div class="snackbar-icon">
        <v-icon v-if="data.level" :color="colors[data.level]" size="24">
          {{ icons[data.level] }}
        </v-icon>
      </div>
      <div class="snackbar-text">
        <span v-if="!data.body && !data.operations" class="snackbar-title">
          {{ data.title }}
        </span>
        <template v-else>
          <div class="snackbar-title">{{ data.title }}</div>
          <div v-if="data.body" class="snackbar-body">{{ data.body }}</div>
        </template>
      </div>
    </div>
    <template #action>
      <div class="snackbar-actions">
        <v-btn v-if="data.more" icon text class="action-btn" @click="more">
          <v-icon>arrow_right</v-icon>
        </v-btn>
        <v-btn icon text class="action-btn close-btn" @click="close">
          <v-icon>close</v-icon>
        </v-btn>
      </div>
    </template>
  </v-snackbar>
</template>

<script lang="ts" setup>
import { Level, kNotificationQueue } from "../composables/notifier";
import { injection } from "@/util/inject";

const data = reactive({
  show: false,
  level: "" as Level | "",
  title: "",
  body: "",
  more: (() => {}) as (() => void) | undefined,
  operations: [] as {
    text: string;
    icon?: string;
    color?: string;
    handler: () => void;
  }[],
});
const queue = injection(kNotificationQueue);
const queueLength = computed(() => queue.value.length);
const close = () => {
  data.show = false;
};
const more = () => {
  if (data.more) {
    data.more();
    close();
  }
};
function consume() {
  const not = queue.value.pop();
  if (not) {
    data.level = not.level ?? "";
    data.title = not.title;
    data.show = true;
    data.more = not.more;
    data.body = not.body ?? "";
    data.operations = not.operations ?? [];
  }
}
watch(queueLength, (newLength, oldLength) => {
  if (newLength > oldLength && !data.show) {
    consume();
  }
});
const { t } = useI18n();

const levelText = computed(() =>
  data.level === "info"
    ? t("logLevel.info")
    : data.level === "error"
    ? t("logLevel.error")
    : data.level === "success"
    ? t("logLevel.success")
    : t("logLevel.warning")
);

// function handleNotification(payload: TaskLifeCyclePayload) {
//   const handler = registry[payload.type]
//   if (handler) {
//     queue.value.push({ level: handler.level, title: handler.title(payload), more: handler.more, full: handler.full })
//   } else {
//     console.warn(`Cannot handle the notification ${payload.type}`)
//   }
// }
onMounted(() => {
  // taskMonitor.on('task-start', handleNotification)
  // ipc.on('notification', handleNotification)
});
onUnmounted(() => {
  // ipc.removeListener('notification', handleNotification)
});

const icons = {
  success: "check_circle",
  info: "info",
  warning: "priority_high",
  error: "warning",
};
const colors = {
  success: "green",
  error: "red",
  info: "white",
  warning: "orange",
};
</script>

<style>
.modern-snackbar {
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.modern-snackbar .v-snack__wrapper {
  border-radius: 12px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
}

.snackbar-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 4px 0;
}

.snackbar-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.snackbar-text {
  flex: 1;
  min-width: 0;
}

.snackbar-title {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.4;
  display: block;
}

.snackbar-body {
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.9;
  margin-top: 4px;
  word-break: break-word;
}

.snackbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn {
  min-width: 36px !important;
  height: 36px !important;
  border-radius: 8px !important;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.close-btn:hover {
  background: rgba(255, 82, 82, 0.15) !important;
}

.close-btn .v-icon {
  color: #ff5252;
}

.v-snack__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px !important;
  padding-right: 8px !important;
}
</style>
