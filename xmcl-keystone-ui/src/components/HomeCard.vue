<template>
  <v-card
    class="flex h-full flex-col"
    :color="error ? 'red' : cardColor"
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
    <v-card-text class="flex-grow relative">
      <template v-if="refreshing && icons.length === 0">
        <v-skeleton-loader type="paragraph" />
      </template>
      <template v-else>
        {{ error ? (error.message || error) : text }}
        <div
          v-if="icons.length > 0"
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
const emit = defineEmits(['navigate'])
const { cardColor } = injection(kTheme)
</script>
