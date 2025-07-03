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
        :color="primaryColor"
        :x-large="!compact"
        :large="compact"
        class="px-10 text-xl/[28px] transition-all btn-left shadow-md !h-12 rounded-l-md"
        @click="loading ? undefined : onClick()"
        @mouseenter="emit('mouseenter')"
        @mouseleave="emit('mouseleave')"
      >
        <span class="text-lg flex items-center">
          {{ text }}
          <v-icon
            v-if="!loading && icon"
            right
            :size="20"
            class="text-md ml-1.5"
          >
            {{ icon }}
          </v-icon>
        </span>
        <v-progress-circular
          v-if="loading"
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
          class="min-w-unset! max-w-8! px-0! btn-right shadow-md !h-12 rounded-r-md"
          :color="primaryColor"
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
import { kTheme } from '@/composables/theme'

defineProps<{ compact?: boolean }>()

const isFocus = useInFocusMode()
const emit = defineEmits(['mouseenter', 'mouseleave'])
const { isValidating } = injection(kInstances)

const { primaryColor } = injection(kTheme)
const { onClick, color, icon, text, loading, count } = injection(kLaunchButton)

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
