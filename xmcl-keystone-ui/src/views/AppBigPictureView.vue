<template>
  <div class="bp-container" data-testid="big-picture-container">
    <!-- Ambient top glow & intro cinematic burst -->
    <div class="bp-ambient-glow" />
    <div class="bp-intro-flash" />

    <!-- Top Header -->
    <header class="bp-header">
      <div class="bp-brand">
        <div class="bp-logo-icon">
          <v-icon size="22" color="primary">videogame_asset</v-icon>
        </div>
        <span class="bp-title">XMCL</span>
        <span class="bp-tag">{{ t('bigPicture.title') }}</span>
      </div>

      <!-- Navigation Tabs -->
      <nav class="bp-nav" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="bp-nav-item"
          :class="{ 'active': currentTab === tab.id }"
          role="tab"
          :aria-selected="currentTab === tab.id"
          tabindex="0"
          data-gamepad-focusable
          @click="currentTab = tab.id"
          @keydown.enter.prevent="currentTab = tab.id"
        >
          <v-icon size="18">{{ tab.icon }}</v-icon>
          <span>{{ t(tab.label) }}</span>
        </button>
      </nav>

      <!-- Right Status Bar -->
      <div class="bp-status-bar">
        <!-- Live Game Status Pill (Running or Launching) -->
        <div
          v-if="primaryRunningInstance"
          class="bp-game-status-pill bp-game-status-pill--running"
          role="button"
          tabindex="0"
          data-gamepad-focusable
          :title="`${t('bigPicture.running')}: ${primaryRunningInstance.name}`"
          @click="switchToInstance(primaryRunningInstance.path)"
          @keydown.enter.prevent="switchToInstance(primaryRunningInstance.path)"
        >
          <span class="bp-status-pulse" />
          <v-icon size="16" color="success">sports_esports</v-icon>
          <span class="bp-game-status-name">{{ primaryRunningInstance.name }}</span>
          <button
            type="button"
            class="bp-game-status-kill"
            :title="t('bigPicture.forceKill')"
            @click.stop="forceKillInstance(primaryRunningInstance.path)"
          >
            <v-icon size="14">close</v-icon>
          </button>
        </div>

        <div
          v-else-if="primaryLaunchingInstance"
          class="bp-game-status-pill bp-game-status-pill--launching"
          role="button"
          tabindex="0"
          data-gamepad-focusable
          :title="`${t('bigPicture.launching')}: ${primaryLaunchingInstance.name}`"
          @click="switchToInstance(primaryLaunchingInstance.path)"
          @keydown.enter.prevent="switchToInstance(primaryLaunchingInstance.path)"
        >
          <v-icon size="16" color="primary" class="animate-spin">sync</v-icon>
          <span class="bp-game-status-name">{{ t('bigPicture.launching') }}: {{ primaryLaunchingInstance.name }}</span>
        </div>

        <!-- Quick Action (Menu) -->
        <button
          type="button"
          class="bp-header-btn"
          tabindex="0"
          data-gamepad-focusable
          :title="`${t('bigPicture.quickMenu')} (${menuLabel})`"
          @click="quickActionDialog = true"
          @keydown.enter.prevent="quickActionDialog = true"
        >
          <v-icon size="18" color="warning">bolt</v-icon>
          <span class="text-xs font-semibold">{{ t('bigPicture.quickMenu') }}</span>
        </button>

        <!-- Tasks Manager -->
        <button
          type="button"
          class="bp-header-btn transition-all duration-300 relative overflow-hidden"
          :class="runningTaskCount > 0
            ? '!bg-primary/20 !border-primary/50 text-white shadow-[0_0_15px_rgba(var(--v-theme-primary),0.35)]'
            : ''"
          tabindex="0"
          data-gamepad-focusable
          :title="`${t('task.name', 2)} (${backLabel})`"
          @click="taskDialog = true"
          @keydown.enter.prevent="taskDialog = true"
        >
          <v-icon
            v-if="runningTaskCount > 0"
            size="18"
            color="primary"
            class="animate-spin"
          >
            sync
          </v-icon>
          <v-icon v-else size="18" color="medium-emphasis">
            task_alt
          </v-icon>

          <span v-if="runningTaskCount > 0" class="bp-badge">{{ runningTaskCount }}</span>

          <span class="text-xs font-semibold">
            <template v-if="runningTaskCount > 0">
              <span class="hidden md:inline">{{ activeTaskSummary }}</span>
              <span class="md:hidden">{{ activeTaskPercentage }}%</span>
            </template>
            <template v-else>
              <span>{{ t('task.name', 2) }}</span>
            </template>
          </span>

          <!-- Animated bottom progress line -->
          <div
            v-if="runningTaskCount > 0"
            class="absolute bottom-0 left-0 h-[2px] bg-primary transition-all duration-300 shadow-[0_0_8px_rgba(var(--v-theme-primary),0.8)]"
            :style="{ width: `${activeTaskPercentage}%` }"
          />
        </button>

        <!-- Help & Gamepad Guide -->
        <button
          type="button"
          class="bp-header-btn"
          tabindex="0"
          data-gamepad-focusable
          :title="`${t('help')} (L3)`"
          @click="helpDialog = true"
          @keydown.enter.prevent="helpDialog = true"
        >
          <v-icon size="18">quiz</v-icon>
        </button>

        <!-- Feedback & Bugs -->
        <button
          type="button"
          class="bp-header-btn"
          tabindex="0"
          data-gamepad-focusable
          :title="t('feedback.name')"
          @click="feedbackDialog = true"
          @keydown.enter.prevent="feedbackDialog = true"
        >
          <v-icon size="18">bug_report</v-icon>
        </button>

        <!-- On-Screen Virtual Keyboard -->
        <button
          v-if="gamepadConnected || isSteamDeck"
          type="button"
          class="bp-header-btn"
          tabindex="0"
          data-gamepad-focusable
          :title="`${t('bigPicture.virtualKeyboard')} (R3)`"
          @click="() => triggerVirtualKeyboard()"
          @keydown.enter.prevent="() => triggerVirtualKeyboard()"
        >
          <v-icon size="18">keyboard</v-icon>
        </button>

        <!-- Battery (if supported) -->
        <div v-if="batterySupported" class="bp-indicator">
          <v-icon size="18" :color="batteryCharging ? 'warning' : 'white'">
            {{ batteryCharging ? 'battery_charging_full' : 'battery_full' }}
          </v-icon>
          <span class="text-xs font-semibold">{{ batteryLevel }}%</span>
        </div>

        <!-- Clock -->
        <div class="bp-clock">
          {{ currentTime }}
        </div>

        <!-- User Profile Avatar -->
        <div
          v-if="userProfile"
          class="cursor-pointer flex items-center gap-2 pl-2"
          role="button"
          tabindex="0"
          data-gamepad-focusable
          :title="gameProfileName"
          @click="openUserProfile"
          @keydown.enter.prevent="openUserProfile"
        >
          <PlayerAvatar
            class="overflow-hidden rounded-full ring-2 ring-white/20"
            :src="avatarUrl"
            :dimension="32"
          />
        </div>

        <!-- Exit Big Picture Button -->
        <button
          type="button"
          class="bp-exit-btn"
          tabindex="0"
          data-gamepad-focusable
          :aria-label="t('bigPicture.exit')"
          :title="t('bigPicture.exit')"
          @click="exitBigPicture"
          @keydown.enter.prevent="exitBigPicture"
        >
          <v-icon size="20">power_settings_new</v-icon>
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="bp-content">
      <transition name="bp-tab" mode="out-in">
        <BigPictureLibrary
          v-if="currentTab === 'library'"
          @browse-market="onBrowseMarket"
        />
        <BigPictureMarket
          v-else-if="currentTab === 'discover'"
          :initial-category="marketCategory"
        />
        <BigPictureMultiplayer v-else-if="currentTab === 'multiplayer'" />
        <BigPictureSettings v-else-if="currentTab === 'settings'" />
      </transition>
    </main>

    <!-- Dialogs -->
    <BigPictureAccountDialog v-model="accountDialog" />
    <BigPictureHelpDialog v-model="helpDialog" />
    <BigPictureFeedbackDialog v-model="feedbackDialog" />
    <BigPictureTaskDialog v-model="taskDialog" />
    <BigPictureQuickActionDialog
      v-model="quickActionDialog"
      @action="onQuickAction"
    />
    <BigPictureAddInstanceDialog v-model="addInstanceDialog" />
    <BigPictureInstanceSettingsDialog v-model="instanceSettingsDialog" />
    <BigPictureModsDrawer v-model="modsDrawer" />

    <!-- Bottom Action Legend Bar (shown only when gamepad is connected) -->
    <footer v-if="gamepadConnected" class="bp-footer">
      <div class="bp-footer-left flex items-center gap-4">
        <!-- Controller Status Badge at Bottom Left -->
        <div
          class="bp-controller-badge"
          :title="gamepadName || t('gamepad.connected')"
        >
          <div class="bp-controller-badge-icon">
            <v-icon size="16" color="primary">sports_esports</v-icon>
          </div>
          <span class="bp-controller-badge-name">
            {{ gamepadName || t('gamepad.connected') }}
          </span>
        </div>

        <div class="bp-legend-group">
          <div class="bp-legend-item">
            <span class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
            <span>{{ t('bigPicture.play') }} / {{ t('gamepad.guide.confirm') }}</span>
          </div>
          <div class="bp-legend-item">
            <span class="bp-glyph bp-glyph--b">{{ buttonBLabel }}</span>
            <span>{{ t('shared.back') }}</span>
          </div>
          <div v-if="currentTab === 'library'" class="bp-legend-item">
            <span class="bp-glyph bp-glyph--x">{{ buttonXLabel }}</span>
            <span>{{ t('bigPicture.instanceSettings') }}</span>
          </div>
          <div v-if="currentTab === 'library'" class="bp-legend-item">
            <span class="bp-glyph bp-glyph--y">{{ buttonYLabel }}</span>
            <span>{{ t('bigPicture.openFolder') }}</span>
          </div>
          <div class="bp-legend-item">
            <span class="bp-glyph">{{ bumpersLabel }}</span>
            <span>{{ t('bigPicture.switchTab') }}</span>
          </div>
          <div v-if="primaryRunningInstance" class="bp-legend-item text-red-400">
            <span class="bp-glyph !border-red-500/60 !text-red-400">LB+RB+B</span>
            <span>{{ t('bigPicture.forceKill') }}</span>
          </div>
        </div>
      </div>

      <div class="bp-legend-group">
        <div class="bp-legend-item">
          <span class="bp-glyph">{{ menuLabel }}</span>
          <span>{{ t('bigPicture.quickMenu') }}</span>
        </div>
        <div class="bp-legend-item">
          <span class="bp-glyph">{{ backLabel }}</span>
          <span>{{ t('task.name', 2) }}</span>
        </div>
        <div class="bp-legend-item">
          <span class="bp-glyph">L3</span>
          <span>{{ t('help') }}</span>
        </div>
        <div class="bp-legend-item">
          <span class="bp-glyph">R3</span>
          <span>{{ t('bigPicture.virtualKeyboard') }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BaseServiceKey, LaunchServiceKey, BedrockServiceKey, TaskState } from '@xmcl/runtime-api'
import { useService } from '@/composables/service'
import { useBigPicture } from '@/composables/bigPicture'
import { useGamepad } from '@/composables/gamepad'
import { kUserContext } from '@/composables/user'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { kInstanceLaunchCoordinator } from '@/composables/instanceLaunchCoordinator'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { useNotifier } from '@/composables/notifier'
import { kTaskManager } from '@/composables/taskManager'
import { kNetworkStatus } from '@/composables/useNetworkStatus'
import { useLocalizedTaskFunc } from '@/composables/task'
import { kLaunchButton } from '@/composables/launchButton'
import { getExpectedSize } from '@/util/size'
import { injection } from '@/util/inject'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import BigPictureLibrary from './BigPictureLibrary.vue'
import BigPictureMarket from './BigPictureMarket.vue'
import BigPictureMultiplayer from './BigPictureMultiplayer.vue'
import BigPictureSettings from './BigPictureSettings.vue'
import BigPictureHelpDialog from './BigPictureHelpDialog.vue'
import BigPictureFeedbackDialog from './BigPictureFeedbackDialog.vue'
import BigPictureAccountDialog from './BigPictureAccountDialog.vue'
import BigPictureTaskDialog from './BigPictureTaskDialog.vue'
import BigPictureQuickActionDialog from './BigPictureQuickActionDialog.vue'
import BigPictureAddInstanceDialog from './BigPictureAddInstanceDialog.vue'
import BigPictureInstanceSettingsDialog from './BigPictureInstanceSettingsDialog.vue'
import BigPictureModsDrawer from './BigPictureModsDrawer.vue'
import './bigPicture.css'

const { t } = useI18n()
const router = useRouter()
const { exitBigPicture, registerVirtualKeyboardHandler } = useBigPicture()
const gamepad = useGamepad()

const { showVirtualKeyboard, getEnvironment, openDirectory } = useService(BaseServiceKey)

const isSteamDeck = ref(false)
onMounted(async () => {
  try {
    const env = await getEnvironment()
    if (env?.steamDeck) {
      isSteamDeck.value = true
    }
  } catch {}
})

const gamepadConnected = gamepad.connected
const gamepadName = gamepad.name
const isSteamController = computed(() => {
  const name = (gamepadName.value || '').toLowerCase()
  return isSteamDeck.value || name.includes('steam deck') || name.includes('valve') || name.includes('steam')
})

async function triggerVirtualKeyboard(preferSteam?: boolean) {
  try {
    await showVirtualKeyboard(preferSteam ?? isSteamController.value)
  } catch (err) {
    console.warn('Failed to open virtual keyboard:', err)
  }
}

registerVirtualKeyboardHandler((preferSteam) => triggerVirtualKeyboard(preferSteam).then(() => true).catch(() => false))

let lastKeyboardTrigger = 0
function handleFocusIn(e: FocusEvent) {
  const target = e.target as HTMLElement | null
  if (!target) return
  const tag = target.tagName ? target.tagName.toLowerCase() : ''
  const isTextInput =
    tag === 'textarea' ||
    (tag === 'input' && !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color', 'hidden'].includes((target as HTMLInputElement).type?.toLowerCase()))

  if (isTextInput && (gamepadConnected.value || isSteamController.value)) {
    const now = Date.now()
    if (now - lastKeyboardTrigger > 1200) {
      lastKeyboardTrigger = now
      triggerVirtualKeyboard()
    }
  }
}

const isPlayStation = gamepad.isPlayStation
const buttonALabel = gamepad.buttonA
const buttonBLabel = gamepad.buttonB
const buttonXLabel = gamepad.buttonX
const buttonYLabel = gamepad.buttonY
const bumpersLabel = computed(() => gamepad.labels.value.bumpers)
const menuLabel = computed(() => gamepad.labels.value.menu)
const backLabel = computed(() => gamepad.labels.value.back)

const { userProfile, gameProfile } = injection(kUserContext)
const { instance: currentInstance, select } = injection(kInstance)
const { instances } = injection(kInstances)
const { isRunning, isLaunching } = injection(kInstanceLaunchCoordinator)
const { kill: killJavaLaunch, abort: abortJavaLaunch } = injection(kInstanceLaunch)
const { getGameProcesses, kill: killProcess } = useService(LaunchServiceKey)
const { killGame: killBedrockGame } = useService(BedrockServiceKey)
const { notify } = useNotifier()

const primaryRunningInstance = computed(() => {
  return instances.value.find((i) => isRunning(i.path))
})

const primaryLaunchingInstance = computed(() => {
  return instances.value.find((i) => isLaunching(i.path))
})

function switchToInstance(path: string) {
  select(path)
  if (currentTab.value !== 'library') {
    currentTab.value = 'library'
  }
}

async function forceKillInstance(instancePath?: string) {
  const targetPath = instancePath || primaryRunningInstance.value?.path || currentInstance.value?.path
  if (!targetPath) return

  const targetInstance = instances.value.find((i) => i.path === targetPath)
  const isBedrockTarget = targetInstance?.edition === 'bedrock'

  try {
    if (isBedrockTarget) {
      await killBedrockGame()
    } else {
      const processes = await getGameProcesses().catch(() => [])
      const matched = processes.filter((p) => p.options.gameDirectory === targetPath)
      if (matched.length > 0) {
        for (const p of matched) {
          await killProcess(p.pid, true).catch(() => {})
        }
      } else {
        await killJavaLaunch('client', true).catch(() => {})
      }
      abortJavaLaunch()
    }
    notify({
      level: 'warning',
      title: t('bigPicture.gameKilled') || 'Гру примусово завершено',
      body: t('bigPicture.gameKilledBody') || 'Процес гри було примусово закрито.',
    })
  } catch (err: any) {
    console.error('Failed to kill game:', err)
  }
}

function onGamepadForceKill() {
  if (primaryRunningInstance.value || isRunning(currentInstance.value?.path || '')) {
    forceKillInstance()
  }
}

const isBedrock = computed(() => currentInstance.value?.edition === 'bedrock')
const gameProfileName = computed(() => gameProfile.value.name || userProfile.value?.username || '')
const avatarUrl = computed(() => userProfile.value?.profiles[userProfile.value?.selectedProfile]?.textures?.SKIN?.url)

const accountDialog = ref(false)
function openUserProfile() {
  accountDialog.value = true
}

// Navigation Tabs
type BigPictureTab = 'library' | 'discover' | 'multiplayer' | 'settings'

const tabs = computed(() => {
  const list: { id: BigPictureTab; label: string; icon: string }[] = [
    { id: 'library', label: 'bigPicture.library', icon: 'sports_esports' },
    { id: 'discover', label: 'bigPicture.discover', icon: 'explore' },
  ]
  if (!isBedrock.value) {
    list.push({ id: 'multiplayer', label: 'bigPicture.multiplayer', icon: 'hub' })
  }
  list.push({ id: 'settings', label: 'bigPicture.settings', icon: 'settings' })
  return list
})

const currentTab = ref<BigPictureTab>('library')

watch(isBedrock, (bedrock) => {
  if (bedrock && currentTab.value === 'multiplayer') {
    currentTab.value = 'library'
  }
})

function nextTab() {
  const list = tabs.value
  const idx = list.findIndex((t) => t.id === currentTab.value)
  if (idx === -1) {
    currentTab.value = list[0].id
    return
  }
  currentTab.value = list[(idx + 1) % list.length].id
}

function prevTab() {
  const list = tabs.value
  const idx = list.findIndex((t) => t.id === currentTab.value)
  if (idx === -1) {
    currentTab.value = list[0].id
    return
  }
  currentTab.value = list[(idx - 1 + list.length) % list.length].id
}

// Clock
const currentTime = ref('')
function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
let timeInterval: any = null

// Battery status via Web Battery API
const batterySupported = ref(false)
const batteryLevel = ref(100)
const batteryCharging = ref(false)

async function setupBattery() {
  if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
    try {
      const battery = await (navigator as any).getBattery()
      batterySupported.value = true
      const updateBattery = () => {
        batteryLevel.value = Math.round(battery.level * 100)
        batteryCharging.value = battery.charging
      }
      updateBattery()
      battery.addEventListener('levelchange', updateBattery)
      battery.addEventListener('chargingchange', updateBattery)
    } catch {}
  }
}

// Task Monitoring & Status Indicator
const { tasks } = injection(kTaskManager)
const { status: networkStatus } = injection(kNetworkStatus)
const localizeTask = useLocalizedTaskFunc()
const { onClick: onLaunchClick } = injection(kLaunchButton)

const runningTasks = computed(() => tasks.value.filter((t) => t.state === TaskState.Running))
const runningTaskCount = computed(() => runningTasks.value.length)
const activeTask = computed(() => runningTasks.value[0])

const activeTaskPercentage = computed(() => {
  if (!activeTask.value) return 0
  const total = activeTask.value.progress?.total ?? -1
  const current = activeTask.value.progress?.progress ?? 0
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((current / total) * 100)))
})

const activeTaskSummary = computed(() => {
  if (!activeTask.value) return ''
  const loc = localizeTask(activeTask.value)
  const speed = networkStatus.value?.downloadSpeed
  const speedStr = speed && speed > 0 ? ` · ${getExpectedSize(speed)}/s` : ''
  if (activeTaskPercentage.value > 0) {
    return `${loc.title} (${activeTaskPercentage.value}%${speedStr})`
  }
  return loc.title + speedStr
})

// Dialogs & Drawers
const taskDialog = ref(false)
const quickActionDialog = ref(false)
const addInstanceDialog = ref(false)
const instanceSettingsDialog = ref(false)
const modsDrawer = ref(false)
const helpDialog = ref(false)
const feedbackDialog = ref(false)
const marketCategory = ref<any>('modpack')

const openPalette = () => { quickActionDialog.value = true }
const openTasks = () => { taskDialog.value = true }

function onQuickAction(id: string) {
  switch (id) {
    case 'launch':
      onLaunchClick()
      break
    case 'add-instance':
      addInstanceDialog.value = true
      break
    case 'tasks':
      taskDialog.value = true
      break
    case 'mods':
      modsDrawer.value = true
      break
    case 'instance-settings':
      instanceSettingsDialog.value = true
      break
    case 'folder':
      if (currentInstance.value?.path) {
        openDirectory(currentInstance.value.path)
      }
      break
    case 'account':
      accountDialog.value = true
      break
    case 'discover':
      currentTab.value = 'discover'
      break
    case 'help':
      helpDialog.value = true
      break
    case 'feedback':
      feedbackDialog.value = true
      break
    case 'exit-big-picture':
      exitBigPicture()
      break
  }
}

function onBrowseMarket(cat?: string) {
  marketCategory.value = cat || 'modpack'
  currentTab.value = 'discover'
}

// Gamepad Context: register Big Picture input overrides
onMounted(() => {
  updateTime()
  timeInterval = setInterval(updateTime, 1000)
  setupBattery()

  gamepad.registerContext('big-picture', {
    onCancel: () => {
      if (quickActionDialog.value) {
        quickActionDialog.value = false
      } else if (taskDialog.value) {
        taskDialog.value = false
      } else if (helpDialog.value) {
        helpDialog.value = false
      } else if (feedbackDialog.value) {
        feedbackDialog.value = false
      } else if (accountDialog.value) {
        accountDialog.value = false
      } else if (addInstanceDialog.value) {
        addInstanceDialog.value = false
      } else if (instanceSettingsDialog.value) {
        instanceSettingsDialog.value = false
      } else if (modsDrawer.value) {
        modsDrawer.value = false
      } else if (currentTab.value !== 'library') {
        currentTab.value = 'library'
      }
    },
    onMenu: () => {
      quickActionDialog.value = !quickActionDialog.value
    },
    onSelect: () => {
      taskDialog.value = !taskDialog.value
    },
    onHelp: () => {
      helpDialog.value = !helpDialog.value
    },
    onFeedback: () => {
      feedbackDialog.value = !feedbackDialog.value
    },
    onKeyboard: () => {
      triggerVirtualKeyboard()
    },
    onTab: (direction) => {
      if (direction === 'next') nextTab()
      else prevTab()
    },
  })
})

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval)
  gamepad.unregisterContext('big-picture')
})

// Keyboard navigation listener (Escape goes back / closes dialogs, Tab cycles tabs)
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (quickActionDialog.value) {
      quickActionDialog.value = false
    } else if (taskDialog.value) {
      taskDialog.value = false
    } else if (helpDialog.value) {
      helpDialog.value = false
    } else if (feedbackDialog.value) {
      feedbackDialog.value = false
    } else if (accountDialog.value) {
      accountDialog.value = false
    } else if (addInstanceDialog.value) {
      addInstanceDialog.value = false
    } else if (instanceSettingsDialog.value) {
      instanceSettingsDialog.value = false
    } else if (modsDrawer.value) {
      modsDrawer.value = false
    } else if (currentTab.value !== 'library') {
      currentTab.value = 'library'
    }
  } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
    e.preventDefault()
    quickActionDialog.value = !quickActionDialog.value
  } else if (e.key === 'F11') {
    e.preventDefault()
    exitBigPicture()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('focusin', handleFocusIn)
  window.addEventListener('gamepad-force-kill', onGamepadForceKill)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('focusin', handleFocusIn)
  window.removeEventListener('gamepad-force-kill', onGamepadForceKill)
})
</script>
