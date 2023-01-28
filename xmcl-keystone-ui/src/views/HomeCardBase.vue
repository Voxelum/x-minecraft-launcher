<template>
  <v-card class="flex flex-col h-full">
    <v-card-title>
      <v-icon left>
        {{ icon }}
      </v-icon>
      {{ title }}
    </v-card-title>
    <!-- <v-card-subtitle>
      别忘了开 Modloader 哦……
    </v-card-subtitle> -->
    <v-card-text class="flex-grow">
      <template v-if="refreshing">
        <v-skeleton-loader type="paragraph" />
      </template>
      <template v-else>
        {{ text }}
        <div
          v-if="icons.length > 0"
          class="mt-4"
        >
          <v-avatar
            v-for="a of icons"
            :key="a.name"
            :color="a.color ? a.color : !a.icon ? getColor(a.name) : undefined"
            size="30px"
            @mouseenter="onEnter($event, a.name)"
            @mouseleave="onLeave($event)"
          >
            <img
              v-if="a.icon"
              :src="a.icon"
            >
            <span v-else> {{ a.name[0].toUpperCase() }} </span>
          </v-avatar>
        </div>
      </template>
    </v-card-text>
    <v-card-actions>
      <v-btn
        :disabled="refreshing"
        :loading="refreshing"
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
import { kSharedTooltip } from '@/composables/sharedTooltip'
import { getColor } from '@/util/color'

defineProps<{
  icon?: string
  title: string
  text: string
  button: string
  refreshing: boolean
  icons: Array<{ name: string; icon?: string; color?: string }>
}>()
const emit = defineEmits(['navigate'])
const tooltip = inject(kSharedTooltip)
const onEnter = tooltip?.onEnter || (() => { })
const onLeave = tooltip?.onLeave || (() => { })
</script>
