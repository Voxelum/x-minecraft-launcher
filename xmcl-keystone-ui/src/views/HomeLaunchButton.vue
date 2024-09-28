<template>
  <div class="flex flex-grow-0 gap-[3px]">
    <v-badge
      left
      color="primary"
      bordered
      overlap
      :value="count !== 0"
    >
      <template #badge>
        <span v-ripple>{{ count }}</span>
      </template>
      <v-btn
        id="launch-button"
        :disabled="isValidating"
        :color="color"
        :x-large="!compact"
        :large="compact"
        class="px-12 text-lg transition-all btn-left"
        @click="onClick()"
        @mouseenter="emit('mouseenter')"
        @mouseleave="emit('mouseleave')"
      >
        <v-icon
          v-if="leftIcon"
          class="-ml-1 pr-2 text-2xl"
        >
          {{ leftIcon }}
        </v-icon>
        {{ text }}
        <v-icon
          v-if="!loading && icon"
          right
          class="pl-3 text-2xl"
        >
          {{ icon }}
        </v-icon>
        <v-progress-circular
          v-else-if="loading"
          class="v-icon--right"
          indeterminate
          :size="20"
          :width="2"
        />
      </v-btn>
    </v-badge>
    <v-menu
      v-model="isShown"
      offset-y
      left
      :top="isFocus"
      transition="scroll-y-transition"
    >
      <template #activator="{ on }">
        <v-btn
          :disabled="isValidating"
          class="min-w-unset! max-w-5! px-0! btn-right"
          :color="color"
          :x-large="!compact"
          :large="compact"
          v-on="on"
        >
          <v-icon>
            arrow_drop_down
          </v-icon>
        </v-btn>
      </template>
      <HomeLaunchButtonMenuList />
    </v-menu>
  </div>
</template>
<script lang="ts" setup>
import { kLaunchButton } from '@/composables/launchButton'
import { injection } from '@/util/inject'
import HomeLaunchButtonMenuList from './HomeLaunchButtonMenuList.vue'
import { kInstances } from '@/composables/instances'
import { useInFocusMode } from '@/composables/uiLayout'

defineProps<{ compact?: boolean }>()

const isFocus = useInFocusMode()
const emit = defineEmits(['mouseenter', 'mouseleave'])
const { isValidating } = injection(kInstances)

const { onClick, color, icon, text, loading, leftIcon, count } = injection(kLaunchButton)

const isShown = ref(false)
</script>

<style scoped>
.btn-right {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
.btn-left {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
