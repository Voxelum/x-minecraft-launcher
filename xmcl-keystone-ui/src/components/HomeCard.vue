<template>
  <v-card
    class="flex h-full flex-col transition-all duration-500 home-card rounded-card"
    :class="{ highlighted: isHighlighted, 'card-hover': isHovered }"
    style="box-sizing: border-box"
    outlined
    :style="cardStyle"
    :color="isHighlighted ? 'yellow darken-2' : cardColor"
    @dragover="onDragOver"
    @drop="onDrop"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <v-progress-linear
      v-if="refreshing"
      class="absolute left-0 bottom-0 z-20 m-0 p-0"
      indeterminate
    />
    <v-card-title class="pb-2">
      <v-icon left class="mr-2">
        {{ icon }}
      </v-icon>
      {{ title }}
    </v-card-title>
    <v-card-text class="flex-grow relative pb-0">
      <template v-if="refreshing && icons.length === 0">
        <v-skeleton-loader type="paragraph" />
      </template>
      <template v-else-if="slots.default">
        <slot />
      </template>
      <template v-else>
        <span v-if="!error" class="text-content">
          {{ text }}
        </span>
        <span v-else class="color-red">
          <v-icon color="red" small> warning </v-icon>
          {{ error.message || error }}
        </span>
        <div
          v-if="!globalDragover && icons.length > 0"
          class="mt-4 flex flex-wrap gap-2"
        >
          <v-avatar
            v-for="appIcon of icons"
            :key="appIcon.name"
            v-shared-tooltip="appIcon.name"
            :color="getIconColor(appIcon)"
            size="30px"
            class="flex-shrink-0"
          >
            <img
              v-if="appIcon.icon"
              :src="appIcon.icon"
              v-fallback-img="BuiltinImages.unknownServer"
              draggable="false"
            />
            <span v-else> {{ appIcon.name[0]?.toUpperCase() }} </span>
          </v-avatar>
        </div>
      </template>
    </v-card-text>
    <v-card-actions
      class="justify-between pt-3"
      v-if="button || additionButton"
    >
      <v-btn
        v-if="button"
        text
        ref="btnElem"
        @click="emit('navigate')"
        class="rounded-btn px-4 py-2 btn-primary"
      >
        <v-icon v-if="button.icon" left>
          {{ button.icon }}
        </v-icon>
        <span :style="{ color: isButtonOverflowed ? 'transparent' : '' }">
          {{ button.text }}
        </span>
      </v-btn>
      <v-spacer v-else />
      <v-btn
        v-if="additionButton"
        color="primary"
        text
        @click="emit('navigate-addition')"
        class="rounded-btn px-4 py-2 btn-secondary"
      >
        <v-icon class="material-icons-outlined" left>
          {{ additionButton.icon || "add" }}
        </v-icon>
        <span>
          {{ additionButton.text }}
        </span>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
// Imports
import { kDropHandler } from "@/composables/dropHandler";
import { kTheme } from "@/composables/theme";
import { BuiltinImages } from "@/constant";
import { vFallbackImg } from "@/directives/fallbackImage";
import { vSharedTooltip } from "@/directives/sharedTooltip";
import { getColor } from "@/util/color";
import { injection } from "@/util/inject";
import Vue from "vue";

// Refs
const btnElem = ref(null as Vue | null);
const isHovered = ref(false);
const dragCounter = ref(0);
const mouseCounter = ref(0);

// Computed properties
const cardStyle = computed(() => ({
  borderColor: mouseCounter.value > 0 ? "white" : "",
  "backdrop-filter": `blur(${blurCard}px)`,
  transform:
    isHovered.value && !isHighlighted.value
      ? "scale(1.02)"
      : isHighlighted.value
      ? "scale(1.05)"
      : "scale(1)",
}));

const isHighlighted = computed(
  () => globalDragover.value && dragCounter.value > 0
);

const isButtonOverflowed = computed(() => {
  const el = btnElem.value?.$el;
  if (!el) return false;
  return el.scrollWidth > el.clientWidth;
});

// Helper function for icon color
const getIconColor = (iconItem: {
  name: string;
  icon?: string;
  color?: string;
}) => {
  if (iconItem.color) return iconItem.color;
  if (!iconItem.icon) return getColor(iconItem.name);
  return undefined;
};

// Props and Emits
const props = defineProps<{
  icon?: string;
  title: string;
  subtitle?: string;
  text: string;
  button?: { text: string; icon?: string };
  additionButton?: { text: string; icon?: string };
  refreshing: boolean;
  error?: any;
  icons: Array<{ name: string; icon?: string; color?: string }>;
}>();

const emit = defineEmits([
  "navigate",
  "drop",
  "dragover",
  "dragenter",
  "dragleave",
  "navigate-addition",
]);

// Injections
const { cardColor, blurCard } = injection(kTheme);
const slots = useSlots();
const { dragover: globalDragover } = injection(kDropHandler);

// Event handlers
const onMouseEnter = () => {
  mouseCounter.value += 1;
  isHovered.value = true;
};

const onMouseLeave = () => {
  mouseCounter.value -= 1;
  isHovered.value = false;
};

const onDragEnter = () => {
  dragCounter.value += 1;
};

const onDragLeave = () => {
  dragCounter.value -= 1;
};

const onDrop = (event: DragEvent) => {
  emit("drop", event);
  dragCounter.value = 0; // Reset drag counter on drop
};

const onDragOver = (event: DragEvent) => {
  emit("dragover", event);
};
</script>

<style scoped>
/* Text content styling */
.text-content {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Card base styling */
.home-card {
  container-type: size;
  width: 100%;
  transition: all 0.3s ease, transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* Hidden button placeholder */
.btn {
  display: none;
}

/* Rounded card with shadow and border */
.rounded-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1), 0 6px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(255, 255, 255, 0.05);
}

/* Hover effect for card */
.card-hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15), 0 12px 32px rgba(0, 0, 0, 0.15);
}

/* Button styling */
.rounded-btn {
  border-radius: 24px;
  text-transform: none;
  font-weight: 500;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: 0.25px;
  min-width: auto;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

/* Button hover effects */
.rounded-btn::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    120deg,
    rgba(255, 255, 255, 0.1),
    rgba(255, 255, 255, 0)
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.rounded-btn:hover::before {
  opacity: 1;
}

/* Primary button styling */
.btn-primary {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
}

.btn-primary:hover {
  background-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Secondary button styling */
.btn-secondary {
  padding: 8px 16px;
}

.btn-secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Container query */
@container (min-width: 300px) {
  .btn {
    display: block;
  }
}
</style>
