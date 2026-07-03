<template>
  <div>
    <AppGamepadQuickMenu />
    <AppGamepadModDialog />
    <AppGamepadSteamDeckDialog />
  </div>
</template>

<script lang="ts" setup>
import { computed, provide, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGamepad, kGamepad } from '@/composables/gamepad'
import { useCommandPaletteBus } from '@/composables/commandPalette'
import { useDialog } from '@/composables/dialog'
import AppGamepadQuickMenu from './AppGamepadQuickMenu.vue'
import AppGamepadModDialog from './AppGamepadModDialog.vue'
import AppGamepadSteamDeckDialog from './AppGamepadSteamDeckDialog.vue'

const router = useRouter()
const paletteBus = useCommandPaletteBus()
const openPalette = () => paletteBus.emit('show')

// Select toggles the background task dialog.
const { isShown: taskShown, show: showTasks, hide: hideTasks } = useDialog('task')
const toggleTasks = () => (taskShown.value ? hideTasks() : showTasks())

// Top level tabs the bumpers (L1/R1) cycle through.
const ROUTES = ['/me', '/store', '/', '/setting']
function navigateTab(direction: 'prev' | 'next') {
  const currentPath = router.currentRoute.value.path
  let idx = ROUTES.indexOf(currentPath)
  if (idx === -1) {
    idx = ROUTES.findIndex((r) => r !== '/' && currentPath.startsWith(r))
    if (idx === -1) idx = 0
  }
  idx = direction === 'next' ? (idx + 1) % ROUTES.length : (idx - 1 + ROUTES.length) % ROUTES.length
  router.push(ROUTES[idx])
}

// The single gamepad driver for the window; shared with the dialogs via inject.
const gamepad = useGamepad({
  actions: {
    navigateTab,
    openTasks: toggleTasks,
    // Start opens the command palette; the gamepad cards flank it.
    quickAction: openPalette,
    back: () => router.back(),
  },
  // While disabled, the first button press opens the palette so the onboarding
  // enable switch (a flanking card) is reachable.
  onEnablePrompt: openPalette,
})
provide(kGamepad, gamepad)

// Toggle the global focus-ring styling while the gamepad is active & connected.
const isActive = computed(() => gamepad.enabled.value && gamepad.connected.value)
watch(
  isActive,
  (active) => {
    document.documentElement.classList.toggle('gamepad-active', active)
  },
  { immediate: true },
)
</script>
