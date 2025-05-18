<template>
  <v-list
    two-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-subheader>
      {{ t('instance.resolution') }}
      <BaseSettingGlobalLabel
        :global="isGlobalResolution"
        @clear="resetResolution"
        @click="gotoSetting"
      />
    </v-subheader>
    
    <v-list-item>
      <v-list-item-content>
        <div class="flex flex-row items-center gap-2">
          <v-text-field
            v-model="resolutionWidth"
            :label="t('instance.width')"
            :disabled="resolutionFullscreen"
            type="number"
            outlined
            dense
            hide-details
            filled
            class="mr-2 max-w-[150px]"
          />
          <v-text-field
            v-model="resolutionHeight"
            :disabled="resolutionFullscreen"
            :label="t('instance.height')"
            type="number"
            outlined
            dense
            hide-details
            filled
            class="ml-2 max-w-[150px]"
          />
          <v-switch
            v-model="resolutionFullscreen"
            :label="t('instance.fullscreen')"
            class="ma-0 pa-0"
            hide-details
          />
        </div>
      </v-list-item-content>
      <v-list-item-action>
         <v-select
            v-model="selectedResolutionPreset"
            :items="resolutionPresets"
            item-text="text"
            item-value="value"
            :label="t('instance.resolutionPreset')"
            outlined
            filled
            dense
            hide-details
            class="mb-4 max-w-[300px]"
          ></v-select>
      </v-list-item-action>
    </v-list-item>
  </v-list>
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
