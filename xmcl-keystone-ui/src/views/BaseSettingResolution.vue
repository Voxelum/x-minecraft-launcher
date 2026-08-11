<template>
  <section class="base-setting-resolution">
    <div class="base-setting-resolution__heading">
      <div class="flex items-center gap-2">
        <v-icon size="small" color="primary">aspect_ratio</v-icon>
        <span>{{ t('instance.resolution') }}</span>
      </div>
      <BaseSettingGlobalLabel
        :global="isGlobalResolution"
        @clear="resetResolution"
        @click="gotoSetting"
      />
    </div>

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
        data-testid="instance-fullscreen-switch"
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
      <v-select
        v-if="monitorItems.length > 1"
        v-model="resolutionMonitor"
        data-testid="instance-monitor-select"
        :items="monitorItems"
        :label="t('instance.monitor')"
        :disabled="!resolutionFullscreen"
        variant="outlined"
        density="compact"
        hide-details
        class="sm:col-span-4"
      />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { injection } from '@/util/inject'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import BaseSettingGlobalLabel from '@/components/BaseSettingGlobalLabel.vue'
import { ref, computed, watch } from 'vue'
import { useResolutionPresets } from '@/composables/resolutionPresets'
import { useMonitorItems } from '@/composables/monitor'

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
const resolutionMonitor = ref(resolution.value?.monitor ?? '')
const monitorItems = useMonitorItems()

// Watch for changes in the global resolution setting
watch(
  () => resolution.value,
  (newValue) => {
    if (newValue) {
      resolutionFullscreen.value = newValue.fullscreen
      resolutionWidth.value = newValue.width
      resolutionHeight.value = newValue.height
      resolutionMonitor.value = newValue.monitor ?? ''
    }
  },
  { immediate: true },
)

// Update resolution when controls change
watch([resolutionFullscreen, resolutionWidth, resolutionHeight, resolutionMonitor], ([full, w, h, monitor]) => {
  if (!full && !w && !h && !monitor) {
    resolution.value = undefined
    return
  }
  resolution.value = {
    fullscreen: full,
    width: Number(w) || undefined,
    height: Number(h) || undefined,
    monitor: monitor || undefined,
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

<style scoped>
.base-setting-resolution {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.base-setting-resolution__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.72);
}
</style>
