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
            <v-icon color="primary" size="24">extension</v-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold">{{ t('mod.name', 2) }}</h2>
            <div class="text-xs text-white/60">
              {{ enabledCount }} / {{ mods.length }} {{ t('mod.enabled', enabledCount) }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="shopping_bag"
            class="rounded-xl font-semibold"
            @click="onBrowseMore"
          >
            {{ t('bigPicture.discover') }}
          </v-btn>
          <v-btn
            icon="close"
            variant="text"
            size="small"
            @click="$emit('update:modelValue', false)"
          />
        </div>
      </div>

      <!-- Search Input -->
      <div class="pt-4 pb-2">
        <v-text-field
          v-model="search"
          prepend-inner-icon="search"
          :append-inner-icon="gamepadConnected ? 'keyboard' : undefined"
          :placeholder="t('mod.filter')"
          variant="outlined"
          density="compact"
          hide-details
          rounded="lg"
          clearable
          class="bg-white/5"
          @click:append-inner="openVirtualKeyboard()"
        />
      </div>

      <!-- Mods List -->
      <div class="flex-1 overflow-y-auto py-2 custom-scrollbar flex flex-col gap-2">
        <div
          v-if="filteredMods.length === 0"
          class="flex flex-col items-center justify-center py-12 text-center text-white/50"
        >
          <v-icon size="48" class="mb-2">extension_off</v-icon>
          <div class="text-base font-semibold">{{ t('modSearch.noModsFound') }}</div>
        </div>

        <div
          v-for="mod in filteredMods"
          :key="mod.path"
          class="bp-setting-row !py-3 !px-4"
          tabindex="0"
          role="checkbox"
          :aria-checked="mod.enabled"
          data-gamepad-focusable
          @click="toggleMod(mod)"
          @keydown.enter.prevent="toggleMod(mod)"
          @keydown.space.prevent="toggleMod(mod)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <img
              v-if="mod.icon"
              :src="mod.icon"
              class="w-10 h-10 rounded-lg object-contain bg-black/40 flex-shrink-0"
              alt="Icon"
            >
            <div v-else class="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <v-icon size="20">extension</v-icon>
            </div>

            <div class="flex flex-col min-w-0">
              <div class="text-sm font-bold truncate text-white">
                {{ mod.name || mod.modId }}
              </div>
              <div class="text-xs text-white/50 truncate flex items-center gap-2">
                <span>{{ mod.version || '1.0.0' }}</span>
                <span v-if="mod.modLoaders && mod.modLoaders.length" class="text-white/30">•</span>
                <span v-if="mod.modLoaders && mod.modLoaders.length">{{ mod.modLoaders.join(', ') }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <v-switch
              :model-value="mod.enabled"
              color="primary"
              hide-details
              density="compact"
              inset
              @click.stop="toggleMod(mod)"
            />
          </div>
        </div>
      </div>

      <!-- Footer legend -->
      <div v-if="gamepadConnected" class="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
        <div class="flex items-center gap-2">
          <span class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
          <span>{{ t('gamepad.toggle') }}</span>
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
import { computed, ref } from 'vue'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { useGamepad } from '@/composables/gamepad'
import { useBigPicture } from '@/composables/bigPicture'
import { injection } from '@/util/inject'
import type { ModFile } from '@/util/mod'

const { openVirtualKeyboard } = useBigPicture()

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
const { path: instancePath } = injection(kInstance)
const { mods, enable, disable } = injection(kInstanceModsContext)

const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonALabel = gamepad.buttonA
const buttonBLabel = gamepad.buttonB

const search = ref('')

const enabledCount = computed(() => mods.value.filter(m => m.enabled).length)

const filteredMods = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return mods.value
  return mods.value.filter(m =>
    (m.name && m.name.toLowerCase().includes(query)) ||
    (m.modId && m.modId.toLowerCase().includes(query))
  )
})

function toggleMod(mod: ModFile) {
  if (mod.enabled) {
    disable({ path: instancePath.value, files: [mod.path] })
  } else {
    enable({ path: instancePath.value, files: [mod.path] })
  }
}

function onBrowseMore() {
  emit('update:modelValue', false)
  emit('browse-market')
}
</script>
