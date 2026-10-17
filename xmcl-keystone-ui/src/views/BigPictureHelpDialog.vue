<template>
  <v-dialog
    :model-value="modelValue"
    max-width="750"
    content-class="elevation-0"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="bp-subpage-card !m-0 !p-6 max-h-[85vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <v-icon color="primary" size="24">quiz</v-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold">{{ t('help') }} & {{ t('gamepad.guideTitle') }}</h2>
            <div class="text-xs text-white/60">
              Steam Big Picture style navigation and gamepad controls
            </div>
          </div>
        </div>

        <v-btn
          icon="close"
          variant="text"
          size="small"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto py-4 custom-scrollbar flex flex-col gap-5">
        <!-- Controller Layout Mapping -->
        <div class="surface-panel p-4 rounded-xl bg-white/5 border border-white/10">
          <div class="text-sm font-bold text-white/90 mb-3 flex items-center gap-2">
            <v-icon size="18" color="primary">sports_esports</v-icon>
            <span>Gamepad Controls</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div class="flex items-center gap-3 p-2 rounded-lg bg-white/5">
              <span class="bp-glyph bp-glyph--a">{{ gamepad.buttonA }}</span>
              <span><strong>Confirm / Play</strong> — Launch game, activate item</span>
            </div>
            <div class="flex items-center gap-3 p-2 rounded-lg bg-white/5">
              <span class="bp-glyph bp-glyph--b">{{ gamepad.buttonB }}</span>
              <span><strong>Back / Cancel</strong> — Exit view or close modal</span>
            </div>
            <div class="flex items-center gap-3 p-2 rounded-lg bg-white/5">
              <span class="bp-glyph bp-glyph--x">{{ gamepad.buttonX }}</span>
              <span><strong>Options</strong> — Instance settings & options</span>
            </div>
            <div class="flex items-center gap-3 p-2 rounded-lg bg-white/5">
              <span class="bp-glyph bp-glyph--y">{{ gamepad.buttonY }}</span>
              <span><strong>Folder</strong> — Open instance directory</span>
            </div>
            <div class="flex items-center gap-3 p-2 rounded-lg bg-white/5">
              <span class="bp-glyph">{{ gamepad.labels.value.bumpers }}</span>
              <span><strong>Switch Tabs</strong> — Library, Market, Multiplayer, Settings</span>
            </div>
            <div class="flex items-center gap-3 p-2 rounded-lg bg-white/5">
              <span class="bp-glyph">{{ gamepad.labels.value.menu }}</span>
              <span><strong>Quick Menu</strong> — Search & commands palette</span>
            </div>
            <div class="flex items-center gap-3 p-2 rounded-lg bg-white/5">
              <span class="bp-glyph">{{ gamepad.labels.value.back }}</span>
              <span><strong>Tasks</strong> — Background downloads & task queue</span>
            </div>
            <div class="flex items-center gap-3 p-2 rounded-lg bg-white/5">
              <span class="bp-glyph">D-Pad / L-Stick</span>
              <span><strong>Navigate</strong> — Spatial focus movement</span>
            </div>
          </div>
        </div>

        <!-- Keyboard Shortcuts -->
        <div class="surface-panel p-4 rounded-xl bg-white/5 border border-white/10">
          <div class="text-sm font-bold text-white/90 mb-3 flex items-center gap-2">
            <v-icon size="18" color="primary">keyboard</v-icon>
            <span>Keyboard Shortcuts</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-white/70">
            <div><kbd class="px-2 py-0.5 rounded bg-white/10 text-white">Esc</kbd> Back / Return to Library / Exit</div>
            <div><kbd class="px-2 py-0.5 rounded bg-white/10 text-white">Enter</kbd> Select / Activate</div>
            <div><kbd class="px-2 py-0.5 rounded bg-white/10 text-white">F11</kbd> Toggle Fullscreen</div>
            <div><kbd class="px-2 py-0.5 rounded bg-white/10 text-white">Ctrl+Shift+C</kbd> Quick Action Palette</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="pt-3 border-t border-white/10 flex items-center justify-end">
        <v-btn
          color="primary"
          variant="tonal"
          class="rounded-xl font-semibold"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        >
          {{ t('shared.close') }}
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGamepad } from '@/composables/gamepad'

const props = withDefaults(defineProps<{
  modelValue?: boolean
}>(), {
  modelValue: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const { t } = useI18n()
const gamepad = useGamepad()
</script>
