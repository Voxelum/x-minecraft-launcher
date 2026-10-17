<template>
  <v-dialog
    :model-value="modelValue"
    max-width="850"
    content-class="elevation-0"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="bp-subpage-card !m-0 !p-6 max-h-[85vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <v-icon color="primary" size="24">map</v-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold">{{ t('save.name', 2) }}</h2>
            <div class="text-xs text-white/60">
              {{ saves.length }} worlds in current instance
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="shopping_bag"
            class="rounded-xl font-semibold"
            data-gamepad-focusable
            @click="onBrowseMore"
          >
            {{ t('bigPicture.discover') }}
          </v-btn>
          <v-btn
            icon="close"
            variant="text"
            size="small"
            data-gamepad-focusable
            @click="$emit('update:modelValue', false)"
          />
        </div>
      </div>

      <!-- Saves List -->
      <div class="flex-1 overflow-y-auto py-3 custom-scrollbar flex flex-col gap-3">
        <!-- Empty State -->
        <div
          v-if="saves.length === 0"
          class="flex flex-col items-center justify-center py-12 text-center text-white/50"
        >
          <v-icon size="48" class="mb-2">public_off</v-icon>
          <div class="text-base font-semibold">{{ t('save.empty') }}</div>
          <div class="text-xs text-white/40 mb-4">No worlds found in this instance yet.</div>
          <v-btn
            color="primary"
            class="rounded-xl font-bold"
            data-gamepad-focusable
            @click="onBrowseMore"
          >
            {{ t('bigPicture.discover') }}
          </v-btn>
        </div>

        <!-- World Cards -->
        <div
          v-for="world in saves"
          :key="world.path"
          class="bp-setting-row !py-3 !px-4 hover:border-primary/50 transition-colors"
          tabindex="0"
          role="button"
          data-gamepad-focusable
          @click="playWorld(world)"
          @keydown.enter.prevent="playWorld(world)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <img
              v-if="world.icon"
              :src="world.icon"
              class="w-12 h-12 rounded-lg object-cover bg-black/40 flex-shrink-0 border border-white/10"
              alt="Icon"
            >
            <div v-else class="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <v-icon size="24" color="primary">terrain</v-icon>
            </div>

            <div class="flex flex-col min-w-0">
              <div class="text-sm font-bold truncate text-white">
                {{ world.levelName || world.path }}
              </div>
              <div class="text-xs text-white/50 truncate flex items-center gap-2">
                <span v-if="world.mode" class="capitalize">{{ world.mode }}</span>
                <span v-if="world.mode">•</span>
                <span v-if="world.lastPlayed">{{ formatDate(world.lastPlayed) }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <v-btn
              color="primary"
              variant="tonal"
              prepend-icon="play_arrow"
              class="rounded-xl font-bold"
              @click.stop="playWorld(world)"
            >
              {{ t('bigPicture.play') }}
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Footer legend -->
      <div v-if="gamepadConnected" class="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
        <div class="flex items-center gap-2">
          <span class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
          <span>{{ t('bigPicture.play') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="bp-glyph bp-glyph--b">{{ buttonBLabel }}</span>
          <span>{{ t('shared.back') }}</span>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { kInstanceSave } from '@/composables/instanceSave'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { useGamepad } from '@/composables/gamepad'
import { useNotifier } from '@/composables/notifier'
import { injection } from '@/util/inject'

const props = withDefaults(defineProps<{
  modelValue?: boolean
}>(), {
  modelValue: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'browse-market'): void
}>()

const { t } = useI18n()
const { notify } = useNotifier()
const saveContext = injection(kInstanceSave)
const saves = computed(() => saveContext?.saves?.value || [])
const { launch } = injection(kInstanceLaunch)

const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonALabel = gamepad.buttonA
const buttonBLabel = gamepad.buttonB

async function playWorld(world: any) {
  try {
    emit('update:modelValue', false)
    await launch('client', { world: world.path })
  } catch (e: any) {
    notify({ level: 'error', title: e.message || 'Failed to launch world' })
  }
}

function onBrowseMore() {
  emit('update:modelValue', false)
  emit('browse-market')
}

function formatDate(timestamp: number) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>
