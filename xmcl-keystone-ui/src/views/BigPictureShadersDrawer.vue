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
            <v-icon color="primary" size="24">wb_sunny</v-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold">{{ t('shaderPack.name', 2) }}</h2>
            <div class="text-xs text-white/60">
              <span v-if="shaderMod" class="text-primary font-semibold">{{ shaderMod.name }} Active</span>
              <span v-else class="text-warning">Iris or Optifine recommended</span>
              • {{ shaderPacks.length }} installed
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

      <!-- Shaders List -->
      <div class="flex-1 overflow-y-auto py-3 custom-scrollbar flex flex-col gap-2">
        <!-- Disabled / Internal Option -->
        <div
          class="bp-setting-row !py-3 !px-4"
          :class="{ '!border-primary/60 !bg-primary/10': !selectedShader }"
          tabindex="0"
          role="radio"
          :aria-checked="!selectedShader"
          data-gamepad-focusable
          @click="selectShader(undefined)"
          @keydown.enter.prevent="selectShader(undefined)"
          @keydown.space.prevent="selectShader(undefined)"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <v-icon size="20">block</v-icon>
            </div>
            <div>
              <div class="text-sm font-bold text-white">{{ t('shaderPack.off') }}</div>
              <div class="text-xs text-white/40">Disable external shaders</div>
            </div>
          </div>
          <v-icon v-if="!selectedShader" color="primary">check_circle</v-icon>
        </div>

        <!-- Empty State -->
        <div
          v-if="shaderPacks.length === 0"
          class="flex flex-col items-center justify-center py-12 text-center text-white/50"
        >
          <v-icon size="48" class="mb-2">wb_twilight</v-icon>
          <div class="text-base font-semibold">{{ t('shaderPack.noPacks') }}</div>
          <div class="text-xs text-white/40 mb-4">{{ t('shaderPack.noPacksInstalled') }}</div>
          <v-btn
            color="primary"
            class="rounded-xl font-bold"
            data-gamepad-focusable
            @click="onBrowseMore"
          >
            {{ t('bigPicture.discover') }}
          </v-btn>
        </div>

        <!-- Installed Shaderpacks -->
        <div
          v-for="sp in shaderPacks"
          :key="sp.fileName"
          class="bp-setting-row !py-3 !px-4"
          :class="{ '!border-primary/60 !bg-primary/10': selectedShader === sp.fileName }"
          tabindex="0"
          role="radio"
          :aria-checked="selectedShader === sp.fileName"
          data-gamepad-focusable
          @click="selectShader(sp.fileName)"
          @keydown.enter.prevent="selectShader(sp.fileName)"
          @keydown.space.prevent="selectShader(sp.fileName)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <v-icon size="20" color="primary">auto_awesome</v-icon>
            </div>
            <div class="flex flex-col min-w-0">
              <div class="text-sm font-bold truncate text-white">
                {{ sp.fileName }}
              </div>
              <div class="text-xs text-white/50 truncate">
                {{ formatSize(sp.size) }}
              </div>
            </div>
          </div>

          <v-icon v-if="selectedShader === sp.fileName" color="primary">check_circle</v-icon>
        </div>
      </div>

      <!-- Footer legend -->
      <div v-if="gamepadConnected" class="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
        <div class="flex items-center gap-2">
          <span class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
          <span>{{ t('gamepad.guide.confirm') }}</span>
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
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
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
const shaderPacksContext = injection(kInstanceShaderPacks)
const shaderPacks = computed(() => shaderPacksContext?.shaderPacks?.value || [])
const shaderMod = computed(() => shaderPacksContext?.shaderMod?.value)
const selectedShader = computed(() => shaderPacksContext?.shaderPack?.value)

const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonALabel = gamepad.buttonA
const buttonBLabel = gamepad.buttonB

function selectShader(fileName: string | undefined) {
  if (shaderPacksContext?.shaderPack) {
    shaderPacksContext.shaderPack.value = fileName
  }
}

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
