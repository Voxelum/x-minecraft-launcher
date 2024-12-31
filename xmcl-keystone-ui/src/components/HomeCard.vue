<template>
  <v-card
    class="flex h-full flex-col transition-colors transition-transform"
    :class="{ highlighted: highlighted }"
    style="box-sizing: border-box"
    :color="highlighted ? 'yellow darken-2' : cardColor"
    @dragover="emit('dragover', $event)"
    @drop="emit('drop', $event); dragover = 0;"
    @dragenter="dragover += 1"
    @dragleave="dragover -= 1"
  >
    <v-progress-linear
      v-if="refreshing"
      class="absolute left-0 bottom-0 z-20 m-0 p-0"
      indeterminate
    />
    <v-card-title>
      <v-icon left>
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
        <span
          v-if="!error"
          class="text-content"
        >
          {{ text }}
        </span>
        <span
          v-else
          class="color-red"
        >
          <v-icon
            color="red"
            small
          > warning </v-icon>
          {{ (error.message || error) }}
        </span>
        <div
          v-if="!globalDragover && icons.length > 0"
          class="mt-4"
        >
          <v-avatar
            v-for="a of icons"
            :key="a.name"
            v-shared-tooltip="a.name"
            :color="a.color ? a.color : !a.icon ? getColor(a.name) : undefined"
            size="30px"
          >
            <img
              v-if="a.icon"
              :src="a.icon"
              draggable="false"
            >
            <span v-else> {{ a.name[0]?.toUpperCase() }} </span>
          </v-avatar>
        </div>
      </template>
    </v-card-text>
    <v-card-actions>
      <v-btn
        color="teal accent-4"
        text
        @click="emit('navigate')"
      >
        {{ button }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts" setup>
import { kDropHandler } from '@/composables/dropHandler'
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getColor } from '@/util/color'
import { injection } from '@/util/inject'

defineProps<{
  icon?: string
  title: string
  subtitle?: string
  text: string
  button: string
  refreshing: boolean
  error?: any
  icons: Array<{ name: string; icon?: string; color?: string }>
}>()
const emit = defineEmits(['navigate', 'drop', 'dragover', 'dragenter', 'dragleave'])
const { cardColor, accentColor } = injection(kTheme)

const slots = useSlots()

const dragover = ref(0)
const { dragover: globalDragover } = injection(kDropHandler)
const highlighted = computed(() => globalDragover.value && dragover.value > 0)
</script>

<style scoped>
.highlighted {
  transform: scale(1.05);
}

.text-content {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
