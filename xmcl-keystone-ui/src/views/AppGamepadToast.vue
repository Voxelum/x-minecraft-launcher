<template>
  <teleport to="body">
    <transition name="gp-hud">
      <div
        v-if="toastShown"
        class="gp-hud-toast"
        :class="toastType === 'connected' ? 'gp-hud-toast--connect' : 'gp-hud-toast--disconnect'"
      >
        <!-- Ambient outer glow -->
        <div
          class="gp-hud-glow"
          :class="toastType === 'connected' ? 'gp-hud-glow--green' : 'gp-hud-glow--amber'"
        />

        <div class="gp-hud-content">
          <!-- Controller icon badge with pulse ring -->
          <div
            class="gp-hud-icon-badge"
            :class="toastType === 'connected' ? 'gp-hud-icon-badge--green' : 'gp-hud-icon-badge--amber'"
          >
            <v-icon size="20" :color="toastType === 'connected' ? 'success' : 'warning'">
              {{ toastType === 'connected' ? 'sports_esports' : 'phonelink_erase' }}
            </v-icon>
            <span v-if="toastType === 'connected'" class="gp-hud-pulse-ring" />
          </div>

          <!-- Text block -->
          <div class="flex flex-col text-left min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-white">
                {{ toastType === 'connected' ? t('gamepad.connected') : t('gamepad.disconnected') }}
              </span>
              <span
                v-if="toastType === 'connected'"
                class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
              />
            </div>
            <div
              v-if="padName"
              class="text-xs text-white/60 font-medium truncate max-w-[260px]"
            >
              {{ padName }}
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGamepad, vibrateGamepad } from '@/composables/gamepad'

const { t } = useI18n()
const gamepad = useGamepad()

const toastShown = ref(false)
const toastType = ref<'connected' | 'disconnected'>('connected')
const padName = ref('')
const lastKnownName = ref('')

let hideTimer: any = null

function triggerToast(type: 'connected' | 'disconnected', name = '') {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  toastType.value = type
  padName.value = name
  toastShown.value = true

  if (type === 'connected') {
    vibrateGamepad({ duration: 250, strongMagnitude: 0.5, weakMagnitude: 0.5 })
  }

  hideTimer = setTimeout(() => {
    toastShown.value = false
  }, 3500)
}

watch(gamepad.connected, (connected, prev) => {
  if (prev === undefined) return
  if (connected) {
    const currentName = gamepad.name.value
    if (currentName) lastKnownName.value = currentName
    triggerToast('connected', currentName)
  } else {
    triggerToast('disconnected', lastKnownName.value)
  }
})

onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<style scoped>
.gp-hud-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999999;
  display: flex;
  align-items: center;
  user-select: none;
  pointer-events: none;
  filter: drop-shadow(0 12px 30px rgba(0, 0, 0, 0.7));
}

.gp-hud-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 18px 8px 12px;
  border-radius: 9999px;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.gp-hud-toast--connect .gp-hud-content {
  border-color: rgba(52, 211, 153, 0.45);
}

.gp-hud-toast--disconnect .gp-hud-content {
  border-color: rgba(251, 191, 36, 0.45);
}

.gp-hud-icon-badge {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gp-hud-icon-badge--green {
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(52, 211, 153, 0.5);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
}

.gp-hud-icon-badge--amber {
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid rgba(251, 191, 36, 0.5);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
}

.gp-hud-pulse-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1.5px solid rgba(52, 211, 153, 0.75);
  animation: gp-hud-ring-pulse 2s infinite ease-out;
}

@keyframes gp-hud-ring-pulse {
  0% { transform: scale(0.9); opacity: 1; }
  100% { transform: scale(1.4); opacity: 0; }
}

.gp-hud-glow {
  position: absolute;
  inset: -10px;
  border-radius: 9999px;
  filter: blur(14px);
  opacity: 0.6;
  z-index: -1;
}

.gp-hud-glow--green {
  background: radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, rgba(16, 185, 129, 0) 70%);
}

.gp-hud-glow--amber {
  background: radial-gradient(circle, rgba(245, 158, 11, 0.45) 0%, rgba(245, 158, 11, 0) 70%);
}

/* Fluid spring toast entrance & exit */
.gp-hud-enter-active {
  transition: all 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.gp-hud-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.gp-hud-enter-from {
  opacity: 0;
  transform: translate(-50%, -24px) scale(0.85);
  filter: blur(8px);
}

.gp-hud-leave-to {
  opacity: 0;
  transform: translate(-50%, -16px) scale(0.92);
  filter: blur(6px);
}
</style>
