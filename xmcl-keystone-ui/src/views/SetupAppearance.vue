<template>
  <div class="">
    <v-list
      class="non-moveable w-full"
      color="transparent"
      three-line
      subheader
    >
      <v-list-item class="items-center justify-center">
        <v-list-item-content>
          <v-list-item-title>
            {{
              t("setting.darkTheme")
            }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{
              t("setting.darkThemeDescription")
            }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-select
            v-model="data.theme"
            filled
            style="max-width: 185px"
            hide-details
            :items="themes"
          />
        </v-list-item-action>
      </v-list-item>

      <v-list-item class="items-center justify-center">
        <v-list-item-content>
          <v-list-item-title>
            {{
              t("setting.layoutTitle")
            }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{
              t("setting.layoutDescription")
            }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-select
            v-model="layout"
            filled
            style="max-width: 185px"
            hide-details
            :items="layouts"
          />
        </v-list-item-action>
      </v-list-item>
      
      <v-list-item class="items-center justify-center">
        <v-list-item-content>
          <v-list-item-title>
            {{
              t("setting.themePresets")
            }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{
              t("setting.themePresetsDescription")
            }}
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
    </v-list>

    <!-- Theme Presets Selection -->
    <v-item-group
      v-model="selectedThemePreset"
      mandatory
      class="mx-auto flex max-w-[90vw] items-center justify-center gap-4 p-2"
    >
      <v-item
        :key="0"
        v-slot="{ active, toggle }"
      >
        <v-card
          :elevation="active ? 8 : 0"
          @click="toggle"
          class="theme-preset-card"
          :style="{ backgroundImage: `url(${themePresets[0].backgroundPreviewUrl})`, backgroundSize: 'cover' }"
        >
          <div class="theme-preset-content pa-4">
            <h3 class="theme-preset-title white--text">{{ themePresets[0].name }}</h3>
            <div class="theme-preset-colors d-flex mt-2">
              <div
                v-for="(color, i) in themePresets[0].colorPalette"
                :key="i"
                class="color-sample mr-1"
                :style="{ backgroundColor: color }"
              ></div>
            </div>
          </div>
        </v-card>
      </v-item>
      <v-item
        :key="1"
        v-slot="{ active, toggle }"
      >
        <v-card
          :elevation="active ? 8 : 0"
          @click="toggle"
          class="theme-preset-card"
          :style="{ backgroundImage: `url(${themePresets[1].backgroundPreviewUrl})`, backgroundSize: 'cover' }"
        >
          <div class="theme-preset-content pa-4">
            <h3 class="theme-preset-title white--text">{{ themePresets[1].name }}</h3>
            <div class="theme-preset-colors d-flex mt-2">
              <div
                v-for="(color, i) in themePresets[1].colorPalette"
                :key="i"
                class="color-sample mr-1"
                :style="{ backgroundColor: color }"
              ></div>
            </div>
          </div>
        </v-card>
      </v-item>
    </v-item-group>

    <div class="max-w-180 mx-auto mt-4 mb-4 flex items-center justify-center">
      {{ selectedThemePreset === 0 ? themePresets[0].description : themePresets[1].description }}
    </div>
    
    <v-item-group
      v-model="layoutModel"
      mandatory
      class="mx-auto flex max-w-[90vw] items-center justify-center gap-4 p-2"
    >
      <v-item
        :key="0"
        v-slot="{ active, toggle }"
      >
        <v-card
          :elevation="active ? 8 : 0"
          @click="toggle"
        >
          <SetupLayoutPreview
            :dark="isDark"
            :type="'default'"
          />
        </v-card>
      </v-item>
      <v-item
        :key="1"
        v-slot="{ active, toggle }"
      >
        <v-card
          :elevation="active ? 8 : 0"
          @click="toggle"
        >
          <SetupLayoutPreview
            :dark="isDark"
            :type="'focus'"
          />
        </v-card>
      </v-item>
    </v-item-group>

    <div class="max-w-180 mx-auto mt-4 flex items-center justify-center">
      <span
        v-if="layoutModel === 0"
      >
        {{ t('setup.defaultLayoutDescription') }}
      </span>
      <span
        v-else
      >
        {{ t('setup.focusLayoutDescription') }}
      </span>
    </div>
  </div>
</template>
<script lang=ts setup>
import SetupLayoutPreview from '@/components/SetupLayoutPreview.vue'
import { BackgroundType, kTheme, ParticleMode } from '@/composables/theme'
import { kUILayout } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import { MediaData } from '@xmcl/runtime-api'

const { t } = useI18n()

defineProps<{ value: string }>()

const data = injection('setup' as any) as any
const { isDark, currentTheme, selectedThemeName, applyThemePreset: applyTheme } = injection(kTheme)

const layoutModel = computed({
  get() { return layout.value === 'default' ? 0 : 1 },
  set(v) { if (v) { layout.value = 'focus' } else { layout.value = 'default' } },
})

const layout = injection(kUILayout)

const themes = computed(() => [{
  text: t('setting.theme.dark'),
  value: 'dark',
}, {
  text: t('setting.theme.light'),
  value: 'light',
}, {
  text: t('setting.theme.system'),
  value: 'system',
}])

const layouts = computed(() => [{
  text: t('setting.layout.default'),
  value: 'default',
}, {
  text: t('setting.layout.focus'),
  value: 'focus',
}])

// Theme presets from the theme.ts composable
import { BUILTIN_THEME_PRESETS } from '@/composables/theme'
const themePresets = ref(BUILTIN_THEME_PRESETS)

const selectedThemePreset = ref(0)

// Apply theme preset using the centralized function from theme.ts
function applyThemePreset(preset) {
  // Apply the theme preset using the centralized function
  const themeName = applyTheme(preset, true)
  
  // Store the selected preset in the parent component
  if (data) {
    // Make a shallow copy of the preset to ensure it's properly stored
    data.themePreset = { ...preset };
    console.log('Set data.themePreset to:', data.themePreset.name);
  }
}

// Apply theme preset when changed
watch(selectedThemePreset, (newValue) => {
  const preset = themePresets.value[newValue]
  applyThemePreset(preset)
  console.log('Theme preset selected:', preset.name, 'data.themePreset set:', data.themePreset ? data.themePreset.name : 'none')
})

const emit = defineEmits(['input'])
</script>

<style lang="css" scoped>
.theme-preset-card {
  width: 240px;
  height: 160px;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.theme-preset-card:hover {
  transform: translateY(-5px);
}

.theme-preset-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
}

.theme-preset-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
}

.color-sample {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}
</style>
