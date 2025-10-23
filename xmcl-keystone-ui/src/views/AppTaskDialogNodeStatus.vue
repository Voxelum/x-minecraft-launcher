<template>
  <div
    class="d-flex align-center justify-center"
    style="gap: 4px"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <!-- Текст статуса для Failed/Cancelled -->
    <v-chip
      v-if="item.state === TaskState.Failed"
      x-small
      color="error"
      text-color="white"
      label
    >
      {{ t("task.failed") }}
    </v-chip>
    <v-chip
      v-else-if="item.state === TaskState.Cancelled"
      x-small
      color="grey"
      text-color="white"
      label
    >
      {{ t("task.cancelled") }}
    </v-chip>

    <!-- Иконка паузы -->
    <v-tooltip v-if="item.state === TaskState.Running" bottom>
      <template #activator="{ on, attrs }">
        <v-icon
          v-bind="attrs"
          v-on="on"
          v-ripple
          :size="20"
          class="icon-button"
          :color="color"
          @click="onPause"
        >
          pause
        </v-icon>
      </template>
      <span>{{ t("task.pause") }}</span>
    </v-tooltip>

    <!-- Основная иконка управления -->
    <v-tooltip v-if="item.state !== TaskState.Running || hover" bottom>
      <template #activator="{ on, attrs }">
        <v-icon
          v-bind="attrs"
          v-on="on"
          v-ripple
          :size="20"
          class="icon-button"
          :color="color"
          @click="onClick"
        >
          {{ icon }}
        </v-icon>
      </template>
      <span>{{ tooltipText }}</span>
    </v-tooltip>

    <!-- Индикатор прогресса (когда не показывается число или индикатор) -->
    <v-progress-circular
      v-else-if="indeterminate || !showNumber"
      :color="isDark ? 'white' : undefined"
      :size="20"
      :width="2"
      :value="percentage"
      :indeterminate="indeterminate"
    />
  </div>
</template>

<script lang="ts" setup>
import { kTheme } from "@/composables/theme";
import { TaskItem } from "@/entities/task";
import { injection } from "@/util/inject";
import { TaskState } from "@xmcl/runtime-api";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  item: TaskItem;
  showNumber?: boolean;
}>();

const emit = defineEmits(["cancel", "resume", "pause"]);

const hover = ref(false);
const { t } = useI18n();
const { isDark } = injection(kTheme);

const color = computed(() => {
  switch (props.item.state) {
    case TaskState.Succeed:
      return "success";
    case TaskState.Cancelled:
    case TaskState.Running:
    case TaskState.Paused:
      // case TaskState.Queued: // Removed if Queued doesn't exist
      return isDark.value ? "white" : "primary";
    case TaskState.Failed:
      return "error";
    default:
      return isDark.value ? "white" : "default";
  }
});

const indeterminate = computed(
  () => !props.item.total || props.item.total === -1
);
const percentage = computed(() => {
  if (indeterminate.value) return 0;
  return (props.item.progress! / props.item.total!) * 100;
});

const icon = computed(() => {
  if (hover.value && props.item.state === TaskState.Running) {
    return "close";
  }
  switch (props.item.state) {
    case TaskState.Succeed:
      return props.item.children && props.item.children.length > 0
        ? "done_all"
        : "check";
    case TaskState.Cancelled:
      return "stop";
    case TaskState.Failed:
      return "error_outline";
    case TaskState.Paused:
      return "play_arrow";
    // case TaskState.Queued: // Removed if Queued doesn't exist
    //   return "schedule";
    default:
      return "device_unknown";
  }
});

const tooltipText = computed(() => {
  if (hover.value && props.item.state === TaskState.Running) {
    return t("task.cancel");
  }
  switch (props.item.state) {
    case TaskState.Succeed:
      return t("task.view_result");
    case TaskState.Cancelled:
      return t("task.cancelled");
    case TaskState.Failed:
      return t("task.view_error");
    case TaskState.Paused:
      return t("task.resume");
    // case TaskState.Queued: // Removed if Queued doesn't exist
    //   return t("task.queued");
    default:
      return t("task.unknown");
  }
});

const onClick = () => {
  if (props.item.state === TaskState.Running) {
    emit("cancel");
  } else if (props.item.state === TaskState.Paused) {
    emit("resume");
  }
};

const onPause = () => {
  emit("pause");
};
</script>

<style scoped>
.icon-button {
  border-radius: 50%;
  padding: 2px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.icon-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
}
.theme--dark .icon-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>
