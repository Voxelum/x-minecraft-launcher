<template>
  <v-menu
    v-model="showMenu"
    offset-y
    left
    transition="scroll-y-transition"
    :top="inFoucsMode"
    :bottom="!inFoucsMode"
  >
    <template #activator="{ attrs }">
      <HomeLaunchButtonStatusItem
        v-bind="attrs"
        class="flex-shrink-1 mr-4 flex-grow-0"
        :active="active || showMenu"
        :item="menuItems[0]"
        @mouseenter="onMouseEnter"
        @mouseleave="onMouseLeave"
      />
    </template>
    <div
      v-show="menuItems.length > 1"
      class="select-none"
      @mouseenter="$emit('mouseenter', $event)"
      @mouseleave="$emit('mouseleave', $event)"
    >
      <v-list
        nav
        color="rgba(0,0,0,0.5)"
      >
        <template v-for="(item, index) in menuItems.slice(1)">
          <HomeLaunchButtonStatusItem
            :key="index"
            :item="item"
            :active="true"
            @mouseenter="onMouseEnter"
            @mouseleave="onMouseLeave"
          />
        </template>
      </v-list>
    </div>
  </v-menu>
</template>
<script lang="ts" setup>
import { kLaunchButton, useLaunchButton } from '@/composables/launchButton'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import HomeLaunchButtonStatusItem from './HomeLaunchButtonStatusItem.vue'

defineProps<{ active?: boolean }>()

const inFoucsMode = useInFocusMode()
const { t } = useI18n()

const { loading, menuItems } = injection(kLaunchButton)

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
