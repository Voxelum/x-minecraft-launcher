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
            <v-icon color="primary" size="24">view_in_ar</v-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold">{{ t('blueprint.name', 2) }}</h2>
            <div class="text-xs text-white/60">
              {{ blueprintsList.length }} blueprints and schematics in this instance
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

      <!-- Blueprints List -->
      <div class="flex-1 overflow-y-auto py-3 custom-scrollbar flex flex-col gap-3">
        <!-- Empty State -->
        <div
          v-if="blueprintsList.length === 0"
          class="flex flex-col items-center justify-center py-12 text-center text-white/50"
        >
          <v-icon size="48" class="mb-2">layers_clear</v-icon>
          <div class="text-base font-semibold">{{ t('blueprint.empty') }}</div>
          <div class="text-xs text-white/40 mb-4">{{ t('blueprint.selectHint') }}</div>
          <v-btn
            color="primary"
            class="rounded-xl font-bold"
            data-gamepad-focusable
            @click="onBrowseMore"
          >
            {{ t('bigPicture.discover') }}
          </v-btn>
        </div>

        <!-- Blueprint Cards -->
        <div
          v-for="bp in blueprintsList"
          :key="bp.path"
          class="bp-setting-row !py-3 !px-4 hover:border-primary/50 transition-colors"
          tabindex="0"
          role="button"
          data-gamepad-focusable
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 border border-primary/20">
              <v-icon size="24" color="primary">architecture</v-icon>
            </div>

            <div class="flex flex-col min-w-0">
              <div class="text-sm font-bold truncate text-white">
                {{ bp.fileName }}
              </div>
              <div class="text-xs text-white/50 truncate flex items-center gap-2">
                <span v-if="bp.format" class="uppercase text-primary/80 font-semibold">{{ bp.format }}</span>
                <span v-if="bp.dimensions">• {{ bp.dimensions.x }}×{{ bp.dimensions.y }}×{{ bp.dimensions.z }}</span>
                <span v-if="bp.blockCount">• {{ bp.blockCount }} blocks</span>
                <span v-if="bp.author">• by {{ bp.author }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs text-white/40">{{ formatSize(bp.size) }}</span>
          </div>
        </div>
      </div>

      <!-- Footer legend -->
      <div v-if="gamepadConnected" class="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
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
import { kInstanceBlueprints } from '@/composables/instanceBlueprints'
import { useGamepad } from '@/composables/gamepad'
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
const blueprintsContext = injection(kInstanceBlueprints)
const blueprintsList = computed(() => blueprintsContext?.blueprints?.value || [])

const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonBLabel = gamepad.buttonB

function onBrowseMore() {
  emit('update:modelValue', false)
  emit('browse-market')
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>
