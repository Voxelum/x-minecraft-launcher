<template>
  <v-dialog
    v-model="dialogShown"
    max-width="480"
    persistent
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div class="gp-dialog gp-steamdeck-dialog">
      <div class="gp-dialog__glow gp-dialog__glow--accent" />

      <div class="gp-dialog__content">
        <div class="gp-dialog__icon-wrap">
          <div class="gp-dialog__icon-badge gp-dialog__icon-badge--accent" style="background: linear-gradient(135deg, #10b981, #059669)">
            <v-icon size="28" color="white">sports_esports</v-icon>
          </div>
        </div>

        <div class="text-lg font-bold tracking-tight mt-4 mb-1" style="color: rgba(var(--v-theme-on-surface), 0.95)">
          {{ $t('gamepad.steamDeckTitle') }}
        </div>

        <p class="text-sm mb-6" style="color: rgba(var(--v-theme-on-surface), 0.55); line-height: 1.6;">
          {{ $t('gamepad.steamDeckDesc') }}
        </p>

        <!-- Actions -->
        <div class="flex gap-3 w-full">
          <v-btn
            class="flex-1 gp-btn gp-btn--secondary"
            variant="flat"
            size="large"
            @click="cancelSteamDeckPrompt"
          >
            <span class="gp-btn__key mr-2">{{ buttonBLabel }}</span>
            {{ $t('gamepad.steamDeckCancelBtn', { btn: '' }).replace('()', '').trim() }}
          </v-btn>
          <v-btn
            class="flex-1 gp-btn gp-btn--primary"
            variant="flat"
            size="large"
            :loading="addingSteam"
            @click="addSteamFromDeck"
          >
            <span class="gp-btn__key gp-btn__key--primary mr-2">{{ buttonALabel }}</span>
            {{ $t('gamepad.steamDeckAddBtn', { btn: '' }).replace('()', '').trim() }}
          </v-btn>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotifier } from '@/composables/notifier'
import { useDialog } from '@/composables/dialog'
import { useService } from '@/composables/service'
import { injection } from '@/util/inject'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { kGamepad } from '@/composables/gamepad'
import './gamepad.css'

const { t } = useI18n()
const { notify } = useNotifier()

const gamepad = injection(kGamepad)
const buttonALabel = gamepad.buttonA
const buttonBLabel = gamepad.buttonB

const { addSteamShortcut, getEnvironment } = useService(BaseServiceKey)

const { isShown: dialogShown, show, hide } = useDialog('gamepadSteamDeck')
const addingSteam = ref(false)

async function checkSteamDeck() {
  const dismissed = localStorage.getItem('steam_deck_prompt_dismissed') === 'true'
  if (dismissed) return
  try {
    const envData = await getEnvironment()
    if (envData && envData.steamDeck) {
      show()
    }
  } catch (err) {
    // Ignore error
  }
}

async function addSteamFromDeck() {
  addingSteam.value = true
  try {
    const added = await addSteamShortcut()
    if (added) {
      notify({
        title: t('gamepad.settingSteamTitle'),
        body: t('gamepad.steamAddedNotify'),
        level: 'success',
      })
    } else {
      notify({
        title: t('gamepad.settingSteamTitle'),
        body: t('gamepad.steamAlreadyAddedNotify'),
        level: 'info',
      })
    }
    localStorage.setItem('steam_deck_prompt_dismissed', 'true')
    hide()
  } catch (err: any) {
    notify({
      title: t('gamepad.settingSteamTitle'),
      body: err.message || String(err),
      level: 'error',
    })
  } finally {
    addingSteam.value = false
  }
}

function cancelSteamDeckPrompt() {
  hide()
  localStorage.setItem('steam_deck_prompt_dismissed', 'true')
}

onMounted(() => { checkSteamDeck() })

// Route A/B while the dialog is open.
watch(dialogShown, (shown) => {
  if (shown) {
    gamepad.registerContext('steam-deck', {
      onConfirm: addSteamFromDeck,
      onCancel: cancelSteamDeckPrompt,
      root: () => document.querySelector('.gp-steamdeck-dialog'),
    })
  } else {
    gamepad.unregisterContext('steam-deck')
  }
})
</script>
