<template>
  <div
    v-roving-tabindex
    role="group"
    aria-orientation="horizontal"
    :aria-label="text"
    class="flex flex-grow-0 gap-[3px]"
  >
    <v-badge
      :model-value="count !== 0"
      location="top start"
      color="primary"
      :content="count"
    >
      <v-btn
        id="launch-button"
        data-testid="launch-button"
        :disabled="isValidating"
        :color="color"
        :size="compact ? 'large' : 'x-large'"
        class="px-12 text-lg transition-all btn-left"
        :aria-label="text"
        @click="onClick()"
        @mouseenter="emit('mouseenter')"
        @mouseleave="emit('mouseleave')"
      >
        <v-icon
          v-if="leftIcon"
          start
          size="large"
        >
          {{ leftIcon }}
        </v-icon>
        {{ text }}
        <v-icon
          v-if="!loading && icon"
          end
          size="large"
        >
          {{ icon }}
        </v-icon>
        <v-progress-circular
          v-if="loading"
          class="ml-2"
          indeterminate
          :size="20"
          :width="2"
        />
      </v-btn>
    </v-badge>
    <v-menu
      v-model="isShown"
      :location="top ? 'top end' : 'bottom end'"
      transition="scroll-y-transition"
    >
      <template #activator="{ props: activatorProps }">
        <v-btn
          :disabled="isValidating"
          class="min-w-unset! max-w-5! px-0! btn-right"
          :color="color"
          :size="compact ? 'large' : 'x-large'"
          :aria-label="t('launch.launchAs')"
          :aria-haspopup="'menu'"
          :aria-expanded="isShown"
          v-bind="activatorProps"
        >
          <v-icon aria-hidden="true">
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
import { vRovingTabindex } from '@/directives/rovingTabindex'

defineProps<{ compact?: boolean; top?: boolean }>()

const emit = defineEmits(['mouseenter', 'mouseleave'])
const { isValidating } = injection(kInstances)

const { onClick, color, icon, text, loading, leftIcon, count } = injection(kLaunchButton)
const { t } = useI18n()

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

@media (max-width: 850px) {
  .btn-left {
    max-width: 196px;
  }
}
</style>
