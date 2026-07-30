<template>
  <SettingCard :title="t('instance.resolution')" icon="aspect_ratio">
    <template #header-action>
      <BaseSettingGlobalLabel
        :global="isGlobalResolution"
        @clear="resetResolution"
        @click="gotoSetting"
      />
    </template>

    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
      <v-text-field
        v-model="resolutionWidth"
        :label="t('instance.width')"
        :disabled="resolutionFullscreen"
        type="number"
        variant="outlined"
        density="compact"
        hide-details
      />
      <v-text-field
        v-model="resolutionHeight"
        :disabled="resolutionFullscreen"
        :label="t('instance.height')"
        type="number"
        variant="outlined"
        density="compact"
        hide-details
      />
      <v-switch
        v-model="resolutionFullscreen"
        :label="t('instance.fullscreen')"
        color="primary"
        density="compact"
        hide-details
        class="ma-0 pa-0"
      />
      <v-select
        v-model="selectedResolutionKey"
        :items="resolutionPresetItems"
        item-title="text"
        item-value="key"
        :label="t('instance.resolutionPreset')"
        variant="outlined"
        density="compact"
        hide-details
      />
    </div>
  </SettingCard>
</template>

<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import { injection } from '@/util/inject'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import BaseSettingGlobalLabel from '@/components/BaseSettingGlobalLabel.vue'
import { ref, computed, watch } from 'vue'
import { useResolutionPresets } from '@/composables/resolutionPresets'

const { t } = useI18n()
const { isGlobalResolution, resetResolution, resolution } = injection(InstanceEditInjectionKey)

// Helper function to navigate to global settings
const { push } = useRouter()
const gotoSetting = () => {
  push('/setting')
}

// Resolution presets
const resolutionPresets = useResolutionPresets()

// Resolution controls
const resolutionFullscreen = ref(resolution.value?.fullscreen)
const resolutionWidth = ref(resolution.value?.width)
const resolutionHeight = ref(resolution.value?.height)

// Watch for changes in the global resolution setting
watch(
  () => resolution.value,
  (newValue) => {
    if (newValue) {
      resolutionFullscreen.value = newValue.fullscreen
      resolutionWidth.value = newValue.width
      resolutionHeight.value = newValue.height
    }
  },
  { immediate: true },
)

// Update resolution when controls change
watch([resolutionFullscreen, resolutionWidth, resolutionHeight], ([full, w, h]) => {
  if (!full && !w && !h) {
    resolution.value = undefined
    return
  }
  resolution.value = {
    fullscreen: full,
    width: Number(w) || undefined,
    height: Number(h) || undefined,
  }
})

// Resolution preset selector – use a stable string key so v-select can match
// the current width/height back to a list entry.
const resolutionPresetItems = computed(() => resolutionPresets.value.map(p => ({
  text: p.text,
  key: `${p.value.width ?? ''}x${p.value.height ?? ''}`,
  value: p.value,
})))

const selectedResolutionKey = computed({
  get: () => `${resolutionWidth.value ?? ''}x${resolutionHeight.value ?? ''}`,
  set: (key: string) => {
    const preset = resolutionPresetItems.value.find(p => p.key === key)
    if (!preset) return
    resolutionWidth.value = preset.value.width
    resolutionHeight.value = preset.value.height
    resolutionFullscreen.value = false
  },
})
</script>
