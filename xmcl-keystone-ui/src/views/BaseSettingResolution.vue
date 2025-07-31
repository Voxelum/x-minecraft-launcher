<template>
  <v-list-subheader>
    {{ t('instance.resolution') }}
    <BaseSettingGlobalLabel
      :global="isGlobalResolution"
      @clear="resetResolution"
      @click="gotoSetting"
    />
  </v-list-subheader>

  <v-list-item>
    <template #title>
      <div class="flex flex-row items-center gap-2">
        <v-text-field
          v-model="resolutionWidth"
          :label="t('instance.width')"
          :disabled="resolutionFullscreen"
          type="number"
          variant="filled"
          density="compact"
          hide-details
          class="mr-2 max-w-[150px]"
        />
        <v-text-field
          v-model="resolutionHeight"
          :disabled="resolutionFullscreen"
          :label="t('instance.height')"
          type="number"
          variant="filled"
          density="compact"
          hide-details
          class="ml-2 max-w-[150px]"
        />
        <v-switch
          v-model="resolutionFullscreen"
          :label="t('instance.fullscreen')"
          class="ml-2"
          hide-details
        />
      </div>
    </template>
    <template #append>
      <v-list-item-action>
        <v-select
          v-model="selectedResolutionPreset"
          :items="resolutionPresets"
          item-title="text"
          item-value="value"
          :label="t('instance.resolutionPreset')"
          variant="filled"
          density="compact"
          hide-details
          class="mb-4 max-w-[300px] w-40"
        />
      </v-list-item-action>
    </template>
  </v-list-item>
</template>

<script lang="ts" setup>
import { injection } from '@/util/inject'
import { InstanceEditInjectionKey } from '../composables/instanceEdit'
import BaseSettingGlobalLabel from './BaseSettingGlobalLabel.vue'
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
watch(() => resolution.value, (newValue) => {
  if (newValue) {
    resolutionFullscreen.value = newValue.fullscreen
    resolutionWidth.value = newValue.width
    resolutionHeight.value = newValue.height
  }
}, { immediate: true })

// Update resolution when controls change
watch([resolutionFullscreen, resolutionWidth, resolutionHeight], () => {
  resolution.value = {
    fullscreen: resolutionFullscreen.value,
    width: resolutionWidth.value,
    height: resolutionHeight.value,
  }
})

// Resolution preset selector
const selectedResolutionPreset = computed({
  get: () => {
    const width = resolutionWidth.value
    const height = resolutionHeight.value
    const preset = resolutionPresets.value.find(p => p.value.width === width && p.value.height === height)
    return preset ? preset.value : { width, height }
  },
  set: (value) => {
    resolutionWidth.value = value.width
    resolutionHeight.value = value.height
    resolutionFullscreen.value = false
  }
})
</script>
