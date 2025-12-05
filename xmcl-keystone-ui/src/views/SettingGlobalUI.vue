<!-- src/components/SettingGlobalUI.vue -->
<template>
  <v-card class="mb-4" elevation="2" color="transparent">
    <v-card-title class="text-subtitle-1 pb-2">
      <v-icon left color="primary" small>brush</v-icon>
      {{ t('setting.appearance') }}
    </v-card-title>
    <v-card-subtitle>
      {{ t('setting.appearanceDescription') }}
    </v-card-subtitle>

    <v-card-text class="pa-4">
      <v-tabs v-model="activeTab" background-color="transparent" color="primary" grow>
        <v-tab>
          <v-icon left small>home</v-icon>
          {{ t('setting.myStuffStyle') }}
        </v-tab>
        <v-tab>
          <v-icon left small>dashboard</v-icon>
          {{ t('setting.sidebarSettings') }}
        </v-tab>
      </v-tabs>

      <v-tabs-items v-model="activeTab" class="mt-4 transparent-bg">
        <!-- Home Page Style Tab -->
        <v-tab-item>
          <v-row>
            <v-col cols="12" md="6">
              <v-card
                :class="['style-option-card', { 'selected': myStuffStyleIndex === 0 }]"
                @click="myStuffStyleIndex = 0"
                outlined
                hover
                class="fill-height"
              >
                <v-card-text class="pa-4 d-flex flex-column align-center text-center fill-height">
                  <div class="style-preview-container mb-4 elevation-1">
                    <div class="style-preview-old">
                      <div class="preview-header"></div>
                      <div class="d-flex fill-height">
                        <div class="preview-sidebar">
                          <div class="preview-sidebar-item"></div>
                          <div class="preview-sidebar-item"></div>
                        </div>
                        <div class="preview-content">
                          <div class="preview-content-row"></div>
                          <div class="preview-content-row"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="text-h6 font-weight-bold mb-1">{{ t('setting.myStuffStyleOld') }}</div>
                  <div class="text-caption grey--text">{{ t('setting.myStuffStyleOldDescription') }}</div>
                  <v-icon color="primary" class="check-icon" v-if="myStuffStyleIndex === 0">check_circle</v-icon>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card
                :class="['style-option-card', { 'selected': myStuffStyleIndex === 1 }]"
                @click="myStuffStyleIndex = 1"
                outlined
                hover
                class="fill-height"
              >
                <v-card-text class="pa-4 d-flex flex-column align-center text-center fill-height">
                  <div class="style-preview-container mb-4 elevation-1">
                    <div class="style-preview-new">
                      <div class="preview-header"></div>
                      <div class="preview-grid">
                        <div class="preview-grid-item"></div>
                        <div class="preview-grid-item"></div>
                        <div class="preview-grid-item"></div>
                        <div class="preview-grid-item"></div>
                      </div>
                    </div>
                  </div>
                  <div class="text-h6 font-weight-bold mb-1">{{ t('setting.myStuffStyleNew') }}</div>
                  <div class="text-caption grey--text">{{ t('setting.myStuffStyleNewDescription') }}</div>
                  <v-icon color="primary" class="check-icon" v-if="myStuffStyleIndex === 1">check_circle</v-icon>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-tab-item>

        <!-- Sidebar Settings Tab -->
        <v-tab-item>
          <v-row class="mt-2">
            <v-col cols="12" md="5" class="d-flex justify-center align-center">
              <!-- Live Preview -->
              <div class="sidebar-preview-container elevation-1 rounded-lg">
                <div class="sidebar-preview-wrapper">
                  <div
                    :class="['sidebar-preview', `position-${sidebarPosition}`, `style-${sidebarStyle}`, `align-${sidebarAlign}`]"
                    :style="{ transform: `scale(${sidebarScale / 100})` }"
                  >
                    <div class="sidebar-preview-main">
                      <div v-if="sidebarStyle === 'classic'" class="sidebar-preview-classic">
                        <div class="preview-sidebar-item"></div>
                        <div class="preview-sidebar-item"></div>
                        <div class="preview-sidebar-item"></div>
                      </div>
                      <div v-else class="sidebar-preview-notch">
                        <div class="sidebar-preview-notch-item"></div>
                        <div class="sidebar-preview-notch-item"></div>
                        <div class="sidebar-preview-notch-item"></div>
                      </div>
                      <div class="sidebar-preview-content">
                        <div class="sidebar-preview-content-header"></div>
                        <div class="sidebar-preview-content-body"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="text-caption text-center mt-2 grey--text">Live Preview</div>
              </div>
            </v-col>
            
            <v-col cols="12" md="7">
              <v-list class="transparent-list">
                <!-- Style -->
                <v-list-item>
                  <v-list-item-content>
                    <v-list-item-title class="font-weight-medium">{{ t('setting.sidebarStyle') }}</v-list-item-title>
                    <v-list-item-subtitle>{{ t('setting.sidebarStyleHint') }}</v-list-item-subtitle>
                  </v-list-item-content>
                  <v-list-item-action>
                    <v-btn-toggle v-model="sidebarStyleIndex" mandatory dense color="primary" rounded>
                      <v-btn small>
                        <v-icon left small>view_sidebar</v-icon>
                        {{ t('setting.sidebarClassic') }}
                      </v-btn>
                      <v-btn small>
                        <v-icon left small>dashboard</v-icon>
                        {{ t('setting.sidebarNotch') }}
                      </v-btn>
                    </v-btn-toggle>
                  </v-list-item-action>
                </v-list-item>

                <v-divider class="my-2" />

                <!-- Position -->
                <v-list-item>
                  <v-list-item-content>
                    <v-list-item-title class="font-weight-medium">{{ t('setting.sidebarPosition') }}</v-list-item-title>
                  </v-list-item-content>
                  <v-list-item-action>
                    <v-btn-toggle v-model="sidebarPositionIndex" mandatory dense color="primary" rounded>
                      <v-btn small>
                        <v-icon small>arrow_back</v-icon>
                      </v-btn>
                      <v-btn small>
                        <v-icon small>arrow_forward</v-icon>
                      </v-btn>
                      <v-btn small v-if="sidebarStyle === 'notch'">
                        <v-icon small>arrow_upward</v-icon>
                      </v-btn>
                      <v-btn small v-if="sidebarStyle === 'notch'">
                        <v-icon small>arrow_downward</v-icon>
                      </v-btn>
                    </v-btn-toggle>
                  </v-list-item-action>
                </v-list-item>

                <!-- Notch Specific -->
                <template v-if="sidebarStyle === 'notch'">
                  <v-divider class="my-2" />
                  <v-list-item>
                    <v-list-item-content>
                      <v-list-item-title class="font-weight-medium">{{ t('setting.sidebarAlign') }}</v-list-item-title>
                    </v-list-item-content>
                    <v-list-item-action>
                      <v-btn-toggle v-model="sidebarAlignIndex" mandatory dense color="primary" rounded>
                        <v-btn small><v-icon small>format_align_left</v-icon></v-btn>
                        <v-btn small><v-icon small>format_align_center</v-icon></v-btn>
                        <v-btn small><v-icon small>format_align_right</v-icon></v-btn>
                      </v-btn-toggle>
                    </v-list-item-action>
                  </v-list-item>

                  <v-divider class="my-2" />
                  <v-list-item>
                    <v-list-item-content>
                      <v-list-item-title class="font-weight-medium">{{ t('setting.sidebarScale') }} ({{ sidebarScale }}%)</v-list-item-title>
                    </v-list-item-content>
                    <v-list-item-action class="w-32">
                      <v-slider v-model="sidebarScale" :min="50" :max="150" :step="5" hide-details thumb-label color="primary" dense></v-slider>
                    </v-list-item-action>
                  </v-list-item>
                </template>
              </v-list>
            </v-col>
          </v-row>
        </v-tab-item>
      </v-tabs-items>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, watch, Ref, ref } from 'vue'
import { useI18n } from 'vue-i18n-bridge'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'
import { useLocalStorageCacheStringValue } from '@/composables/cache'

const { t } = useI18n()
const activeTab = ref(0)

// --- UI Customization State ---
const sidebarSettings = useInjectSidebarSettings()
const sidebarPosition = sidebarSettings.position
const sidebarStyle = sidebarSettings.style
const sidebarAlign = sidebarSettings.align
const sidebarScale = sidebarSettings.scale
const myStuffStyle = useLocalStorageCacheStringValue('myStuffStyle', 'new') as Ref<'old' | 'new'>

// --- Computed Properties for UI Controls ---

// Sidebar Position Selector
const sidebarPositionIndex = computed({
  get: () => {
    const positions = ['left', 'right', 'top', 'bottom']
    return positions.indexOf(sidebarPosition.value)
  },
  set: (v: number) => {
    const positions: Array<'left' | 'right' | 'top' | 'bottom'> = ['left', 'right', 'top', 'bottom']
    sidebarPosition.value = positions[v] || 'left'
  }
})

// Sidebar Style Selector
const sidebarStyles = ['classic', 'notch'] as const
const sidebarStyleIndex = computed({
  get: () => sidebarStyles.indexOf(sidebarStyle.value),
  set: (v) => { sidebarStyle.value = sidebarStyles[v] }
})

// My Stuff Style Selector
const myStuffStyles = ['old', 'new'] as const
const myStuffStyleIndex = computed({
  get: () => myStuffStyles.indexOf(myStuffStyle.value as any),
  set: (v) => { myStuffStyle.value = myStuffStyles[v] as 'old' | 'new' }
})

// Sidebar Alignment Selector
const sidebarAlignments = ['start', 'center', 'end'] as const
const sidebarAlignIndex = computed({
  get: () => {
    const aligns = ['start', 'center', 'end']
    return aligns.indexOf(sidebarAlign.value)
  },
  set: (v: number) => {
    const aligns: Array<'start' | 'center' | 'end'> = ['start', 'center', 'end']
    sidebarAlign.value = aligns[v] || 'center'
  }
})

// --- Watchers ---
// Auto-reset position to Left when switching to Classic from Top/Bottom
watch(sidebarStyle, (newStyle) => {
  if (newStyle === 'classic' && (sidebarPosition.value === 'top' || sidebarPosition.value === 'bottom')) {
    sidebarPosition.value = 'left'
  }
})
</script>

<style scoped>
.v-card {
  border-radius: 12px;
}

.transparent-bg {
  background-color: transparent !important;
}

.style-option-card {
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  border-radius: 12px;
  border: 2px solid transparent;
  position: relative;
}

.style-option-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.style-option-card.selected {
  border-color: var(--v-primary-base);
  background-color: rgba(var(--v-primary-base), 0.04);
}

.check-icon {
  position: absolute;
  top: 12px;
  right: 12px;
}

.style-preview-container {
  width: 100%;
  height: 140px;
  border-radius: 8px;
  background-color: #f5f5f5;
  overflow: hidden;
  padding: 8px;
}

/* Preview Styles */
.style-preview-old, .style-preview-new {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-header {
  height: 16px;
  background-color: #e0e0e0;
  border-radius: 4px;
}

.preview-sidebar {
  width: 25%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 4px;
}

.preview-sidebar-item {
  height: 8px;
  background-color: #bdbdbd;
  border-radius: 2px;
}

.preview-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-content-row {
  height: 12px;
  background-color: #eeeeee;
  border-radius: 2px;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  flex-grow: 1;
}

.preview-grid-item {
  background-color: #bdbdbd;
  border-radius: 4px;
}

/* Sidebar Preview */
.sidebar-preview-container {
  width: 100%;
  height: 200px;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 16px;
}

.sidebar-preview-wrapper {
  width: 160px;
  height: 100px;
  position: relative;
}

.sidebar-preview {
  width: 100%;
  height: 100%;
  transform-origin: center;
}

.sidebar-preview-main {
  width: 100%;
  height: 100%;
  background-color: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  display: flex;
  overflow: hidden;
}

/* Position modifiers */
.sidebar-preview.position-left .sidebar-preview-main { flex-direction: row; }
.sidebar-preview.position-right .sidebar-preview-main { flex-direction: row-reverse; }
.sidebar-preview.position-top .sidebar-preview-main { flex-direction: column; }
.sidebar-preview.position-bottom .sidebar-preview-main { flex-direction: column-reverse; }

/* Classic Sidebar */
.sidebar-preview-classic {
  width: 24px;
  background-color: #eeeeee;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  gap: 4px;
}

/* Notch Sidebar */
.sidebar-preview-notch {
  display: flex;
  padding: 4px;
  gap: 4px;
}

.sidebar-preview-notch-item {
  width: 12px;
  height: 12px;
  background-color: #bdbdbd;
  border-radius: 3px;
}

/* Notch Alignment */
.sidebar-preview.align-start .sidebar-preview-notch { justify-content: flex-start; }
.sidebar-preview.align-center .sidebar-preview-notch { justify-content: center; }
.sidebar-preview.align-end .sidebar-preview-notch { justify-content: flex-end; }

.sidebar-preview-content {
  flex-grow: 1;
  background-color: #fafafa;
  padding: 8px;
}

.sidebar-preview-content-header {
  height: 8px;
  width: 50%;
  background-color: #e0e0e0;
  border-radius: 2px;
  margin-bottom: 4px;
}

.sidebar-preview-content-body {
  height: 60%;
  background-color: #f5f5f5;
  border-radius: 2px;
}
</style>
