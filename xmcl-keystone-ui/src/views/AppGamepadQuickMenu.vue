<template>
  <!-- Left: key hints card (floats in from the left) -->
  <Transition name="gp-qm-left">
    <div
      v-if="visible"
      class="gp-qm-card gp-qm-card--left"
      data-testid="gamepad-hints-card"
    >
      <div class="gp-qm-card__title">
        <v-icon size="18" class="mr-2" color="primary">sports_esports</v-icon>
        {{ t('gamepad.guideTitle') }}
      </div>
      <div class="gp-guide" data-testid="gamepad-key-guide">
        <div
          v-for="item in keyGuide"
          :key="item.action"
          class="gp-guide__row"
        >
          <span class="gp-guide__keys">
            <span
              v-for="k in item.keys"
              :key="k"
              class="gp-btn__key"
            >{{ k }}</span>
          </span>
          <span class="gp-guide__label">{{ item.action }}</span>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Right: enable/disable switcher (floats in from the right) -->
  <Transition name="gp-qm-right">
    <div
      v-if="visible"
      class="gp-qm-card gp-qm-card--right"
      data-testid="gamepad-toggle-card"
    >
      <div class="gp-qm-card__title">
        <v-icon size="18" class="mr-2">{{ isPlayStation ? 'sports_esports' : 'videogame_asset' }}</v-icon>
        {{ gamepadName || (isPlayStation ? 'PlayStation Controller' : 'Xbox / Steam Deck Controller') }}
      </div>

      <div class="gp-qm-switch">
        <div class="gp-qm-switch__text">
          <div class="gp-qm-switch__label">{{ t('gamepad.enableSwitchLabel') }}</div>
          <div class="gp-qm-switch__state">
            {{ enabled ? t('gamepad.enabledState') : t('gamepad.disabledState') }}
          </div>
        </div>
        <v-switch
          :model-value="enabled"
          color="primary"
          hide-details
          density="comfortable"
          inset
          @update:model-value="(v) => setEnabled(!!v)"
        />
      </div>

      <div v-if="!enabled" class="gp-qm-hints">
        <span class="gp-qm-hint"><span class="gp-btn__key">{{ buttonALabel }}</span> {{ t('gamepad.toggle') }}</span>
        <span class="gp-qm-hint"><span class="gp-btn__key">{{ buttonBLabel }}</span> {{ t('shared.back') }}</span>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotifier } from '@/composables/notifier'
import { useCommandPaletteBus, useCommandPaletteVisible } from '@/composables/commandPalette'
import { injection } from '@/util/inject'
import { kGamepad } from '@/composables/gamepad'
import './gamepad.css'

const { t } = useI18n()
const { notify } = useNotifier()
const paletteBus = useCommandPaletteBus()

const gamepad = injection(kGamepad)
const enabled = gamepad.enabled
const gamepadName = gamepad.name
const buttonALabel = gamepad.buttonA
const buttonBLabel = gamepad.buttonB
const isPlayStation = gamepad.isPlayStation
const labels = gamepad.labels

// The cards flank the command palette: shown while it's open and a controller
// is connected (they slide in from the left / right around the centred palette).
const paletteShown = useCommandPaletteVisible()
const visible = computed(() => paletteShown.value && gamepad.connected.value)

// Legend teaching the button mapping.
const keyGuide = computed(() => [
  { keys: [buttonALabel.value], action: t('gamepad.guide.confirm') },
  { keys: [buttonBLabel.value], action: t('shared.back') },
  { keys: [labels.value.backspace], action: t('gamepad.guide.launch') },
  { keys: [labels.value.keyboard], action: t('gamepad.guide.instanceSettings') },
  { keys: ['D-Pad'], action: t('gamepad.guide.navigate') },
  { keys: [labels.value.bumpers], action: t('gamepad.guide.tabs') },
  { keys: [labels.value.triggers], action: t('gamepad.guide.sections') },
  { keys: [labels.value.menu], action: t('shared.search') },
  { keys: [labels.value.back], action: t('task.manager') },
])

function setEnabled(value: boolean) {
  gamepad.setEnabled(value)
  notify({
    title: value ? t('gamepad.detectedTitle') : t('gamepad.guideTitle'),
    body: value
      ? t('gamepad.enabledNotify', { btnA: buttonALabel.value, btnB: buttonBLabel.value })
      : t('gamepad.disabledNotify'),
    level: value ? 'success' : 'info',
  })
}

function close() {
  paletteBus.emit('hide')
  // Don't keep auto-opening the onboarding cards once dismissed while disabled.
  if (!enabled.value) gamepad.dismissPrompt()
}

// Two focus zones while the menu is open: the command list (palette) on the
// left and the enable/disable switch (right card) on the right.
type Zone = 'list' | 'switch'
const zone = ref<Zone>('list')

const paletteInput = () => document.querySelector<HTMLElement>('.palette-card input')
const switchInput = () => document.querySelector<HTMLElement>('.gp-qm-card--right input')

function focusList() {
  zone.value = 'list'
  paletteInput()?.focus()
}
function focusSwitch() {
  zone.value = 'switch'
  switchInput()?.focus()
}
/** Drive the palette's own keyboard navigation with a synthetic key event. */
function sendToList(key: string) {
  const input = paletteInput()
  if (!input) return
  input.focus()
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

function onNavigate(dir: 'up' | 'down' | 'left' | 'right') {
  if (dir === 'right') { focusSwitch(); return }
  if (dir === 'left') { focusList(); return }
  // Up / down only mean something on the command list.
  if (zone.value === 'list') sendToList(dir === 'up' ? 'ArrowUp' : 'ArrowDown')
}

function onConfirm() {
  if (zone.value === 'switch') setEnabled(!enabled.value)
  else sendToList('Enter')
}

// While the menu is open: left/right switch zones, A confirms in the current
// zone, B or Start close it.
watch(visible, (v) => {
  if (v) {
    zone.value = 'list'
    gamepad.registerContext('gamepad-menu', {
      onConfirm,
      onCancel: () => close(),
      onMenu: () => close(),
      onNavigate,
    })
  } else {
    gamepad.unregisterContext('gamepad-menu')
  }
}, { immediate: true })
</script>

<style scoped>
/* Cards flank the centred command palette, fixed to the screen edges. They sit
   above the palette's overlay so they read as part of the same "Start" surface,
   but only the cards capture pointer events (the rest passes through). */
/* The command palette is centred at width 720 / max 92vw (half = min(360px,46vw)).
   Each card fills the gutter BESIDE that reserved centre and is anchored by its
   inner edge 16px away from the palette, so it can NEVER overlap the palette.
   The width collapses to 0 on narrow screens, and we hide them under ~1024px
   where the gutter is too small to be useful. */
.gp-qm-card {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2500;
  width: min(340px, calc(50vw - min(360px, 46vw) - 32px));
  padding: 22px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(18, 18, 22, 0.95);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  overflow: hidden;
  pointer-events: auto;
  box-sizing: border-box;
}
/* Anchor the inner edge to the palette gutter (16px gap), width grows outward. */
.gp-qm-card--left {
  right: calc(50% + min(360px, 46vw) + 16px);
}
.gp-qm-card--right {
  left: calc(50% + min(360px, 46vw) + 16px);
}

@media (max-width: 1024px) {
  .gp-qm-card {
    display: none;
  }
}

.gp-qm-card__title {
  display: flex;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 700;
  color: rgba(var(--v-theme-on-surface), 0.92);
  margin-bottom: 16px;
  min-width: 0;
}

/* Right card: enable/disable switch */
.gp-qm-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 4px 8px 12px;
  border-radius: 14px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.gp-qm-switch__label {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.9);
}
.gp-qm-switch__state {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.gp-qm-hints {
  display: flex;
  gap: 16px;
  margin-top: 16px;
}
.gp-qm-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* Transitions: cards float in from their side (keeping the -50% vertical centre). */
.gp-qm-left-enter-active,
.gp-qm-left-leave-active,
.gp-qm-right-enter-active,
.gp-qm-right-leave-active {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease;
}
.gp-qm-left-enter-from,
.gp-qm-left-leave-to {
  transform: translate(-130%, -50%);
  opacity: 0;
}
.gp-qm-right-enter-from,
.gp-qm-right-leave-to {
  transform: translate(130%, -50%);
  opacity: 0;
}
</style>
