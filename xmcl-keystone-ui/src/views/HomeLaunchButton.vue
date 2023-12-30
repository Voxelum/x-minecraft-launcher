<template>
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
    <v-menu
      v-model="showMenu"
      offset-y
      transition="scroll-y-transition"
      :top="inFoucsMode"
      :bottom="!inFoucsMode"
    >
      <template #activator="{ attrs }">
        <v-btn
          id="launch-button"
          :color="color"
          :x-large="!compact"
          :large="compact"
          v-bind="attrs"
          class="px-12 text-lg transition-all"
          @mouseenter="onMouseEnter"
          @mouseleave="onMouseLeave"
          @click="onClick()"
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
      </template>
      <HomeLaunchButtonMenu
        :items="menuItems"
        @mouseenter="onMouseEnter"
        @mouseleave="onMouseLeave"
      />
    </v-menu>
  </v-badge>
</template>
<script lang="ts" setup>
import { useLaunchButton } from '@/composables/launchButton'
import { useInFocusMode } from '@/composables/uiLayout'
import HomeLaunchButtonMenu from './HomeLaunchButtonMenu.vue'

defineProps<{ compact?: boolean }>()

const inFoucsMode = useInFocusMode()

const { onClick, color, icon, text, loading, leftIcon, count, menuItems } = useLaunchButton()

let handle: any
const showMenu = ref(false)

function onMouseEnter() {
  if (handle) clearTimeout(handle)
  if (loading.value) return
  showMenu.value = true
}

function onMouseLeave() {
  if (handle) clearTimeout(handle)
  handle = setTimeout(() => {
    showMenu.value = false
  }, 100)
}

</script>
