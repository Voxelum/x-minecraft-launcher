<template>
  <!-- Install Status when task is running -->
  <div
    v-if="status === 0"
    class="w-43 cursor-pointer select-none text-gray-400 hover:text-unset transition-color"
    @click="showTask()"
  >
    <span class="whitespace-nowrap text-center text-sm font-bold">
      {{ taskName }}
    </span>
    <v-progress-linear
      rounded
      color="blue"
      :value="percentage"
      height="6"
    />
    <span class="whitespace-nowrap text-center text-sm font-bold">
      {{ getExpectedSize(Math.abs(progress)) + ' / ' + getExpectedSize(Math.abs(total)) }}
    </span>
  </div>
  <!-- Launch Button Status Menu -->
  <v-menu
    v-else
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
        class="flex-shrink-1 flex-grow-0"
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
import { kLaunchButton } from '@/composables/launchButton'
import { kLaunchTask } from '@/composables/launchTask'
import { useLocalizedTaskFunc } from '@/composables/task'
import { useDialog } from '@/composables/dialog'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import HomeLaunchButtonStatusItem from './HomeLaunchButtonStatusItem.vue'
import { } from '@xmcl/runtime-api'

defineProps<{ active?: boolean }>()

// Install status
const { progress, total, status, task } = injection(kLaunchTask)
const localizeTask = useLocalizedTaskFunc()
const taskName = computed(() => task.value ? localizeTask(task.value).title : '')
const { show: showTask } = useDialog('task')
const percentage = computed(() => progress.value / total.value * 100)

// Launch button status menu
const inFoucsMode = useInFocusMode()
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
