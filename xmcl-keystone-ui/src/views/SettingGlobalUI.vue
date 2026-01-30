<template>
  <div >
    <SettingCard class="mb-4" :title="t('setting.sidebarStyle')" icon="dashboard">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div class="md:col-span-5 flex justify-center items-center">
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
            <div class="text-caption text-center mt-2 grey--text">{{ t('setting.livePreview') }}</div>
          </div>
        </div>
        <div class="md:col-span-7">
          <v-list class="transparent-list">
            <!-- Style -->
            <SettingItem :title="t('setting.sidebarStyle')" :description="t('setting.sidebarStyleHint')">
              <template #action>
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
              </template>
            </SettingItem>
            <v-divider class="my-2" />

            <!-- Position -->
            <SettingItem :title="t('setting.sidebarPosition')">
              <template #action>
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
              </template>
            </SettingItem>

            <!-- Notch Specific -->
            <template v-if="sidebarStyle === 'notch'">
              <v-divider class="my-2" />
              <SettingItem :title="t('setting.sidebarAlign')">
                <template #action>
                  <v-btn-toggle v-model="sidebarAlignIndex" mandatory dense color="primary" rounded>
                    <v-btn small><v-icon small>format_align_left</v-icon></v-btn>
                    <v-btn small><v-icon small>format_align_center</v-icon></v-btn>
                    <v-btn small><v-icon small>format_align_right</v-icon></v-btn>
                  </v-btn-toggle>
                </template>
              </SettingItem>

              <v-divider class="my-2" />
              <SettingItem :title="t('setting.sidebarAutoHide')" :description="t('setting.sidebarAutoHideHint')">
                <template #action>
                  <v-switch v-model="sidebarAutoHide" color="primary" hide-details dense />
                </template>
              </SettingItem>

              <v-divider class="my-2" />
              <SettingItem :title="`${t('setting.sidebarScale')} (${sidebarScale}%)`">
                <template #action>
                  <div class="w-32">
                    <v-slider v-model="sidebarScale" :min="50" :max="150" :step="5" hide-details thumb-label color="primary" dense></v-slider>
                  </div>
                </template>
              </SettingItem>
            </template>

            <v-divider class="my-2" />
            <!-- Show Only Pinned Instances -->
            <SettingItem :title="t('setting.sidebarShowOnlyPinned')" :description="t('setting.sidebarShowOnlyPinnedHint')">
              <template #action>
                <v-switch v-model="sidebarShowOnlyPinned" color="primary" hide-details dense />
              </template>
            </SettingItem>
          </v-list>
        </div>
      </div>
    </SettingCard>
    <SettingCard class="mb-4" :title="t('setting.themeSettings')" icon="style">
      <AppearanceItems :theme="currentTheme" @save="onSave" />

      <!-- Theme Store Management -->
      <v-divider class="my-4" />
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ t('setting.themeStore.name') }}</v-list-item-title>
          <v-list-item-subtitle>{{ t('setting.themeStore.description') }}</v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>

      <!-- Stored Themes List -->
      <div v-if="storedThemes.length > 0" class="px-4 pb-2">
        <div class="text-caption grey--text mb-2">{{ t('setting.themeStore.savedThemes') }}</div>
        <div class="flex flex-wrap gap-2">
          <v-chip
            v-for="theme in storedThemes"
            :key="theme.name"
            close
            outlined
            @click="onLoadTheme(theme.name)"
            @click:close="onDeleteTheme(theme.name)"
          >
            <v-icon left small>palette</v-icon>
            {{ theme.name }}
          </v-chip>
        </div>
      </div>
      <div v-else class="px-4 pb-2 text-caption grey--text">
        {{ t('setting.themeStore.noSavedThemes') }}
      </div>

      <!-- Save/Load Actions -->
      <v-list-item>
        <v-list-item-content />
        <v-list-item-action class="flex-row gap-2">
          <v-btn outlined text @click="showSaveDialog = true">
            <v-icon left small>save</v-icon>
            {{ t('setting.themeStore.saveToStore') }}
          </v-btn>
        </v-list-item-action>
      </v-list-item>

      <!-- Save Theme Dialog -->
      <v-dialog v-model="showSaveDialog" max-width="400">
        <v-card>
          <v-card-title>{{ t('setting.themeStore.saveDialogTitle') }}</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="newThemeName"
              :label="t('setting.themeStore.themeName')"
              :hint="t('setting.themeStore.themeNameHint')"
              persistent-hint
              autofocus
              @keydown.enter="onSaveToStore"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn text @click="showSaveDialog = false">{{ t('cancel') }}</v-btn>
            <v-btn color="primary" text :disabled="!newThemeName.trim()" @click="onSaveToStore">
              {{ t('save') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Load Theme Confirmation Dialog -->
      <v-dialog v-model="showLoadConfirmDialog" max-width="400">
        <v-card>
          <v-card-title>{{ t('setting.themeStore.loadConfirmTitle') }}</v-card-title>
          <v-card-text>
            {{ t('setting.themeStore.loadConfirmMessage') }}
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn text @click="showLoadConfirmDialog = false">{{ t('cancel') }}</v-btn>
            <v-btn color="warning" text @click="confirmLoadTheme">
              {{ t('setting.themeStore.loadTheme') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-divider class="my-4" />
      <SettingItemCheckbox
        :value="linuxTitlebar"
        :title="t('setting.linuxTitlebar')"
        :description="t('setting.linuxTitlebarDescription')"
        @input="v => linuxTitlebar = v"
      />
    </SettingCard>
  </div>
</template>

<script setup lang="ts">
import AppearanceItems from '@/components/AppearanceItems.vue'
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemCheckbox from '@/components/SettingItemCheckbox.vue'
import { useLocalStorageCacheStringValue } from '@/composables/cache'
import { kEnvironment } from '@/composables/environment'
import { kSettingsState } from '@/composables/setting'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'
import { kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'
import { Ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n-bridge'

const { t } = useI18n()
const env = injection(kEnvironment)
const { currentTheme, saveCurrentTheme, storedThemes, saveToStore, loadFromStore, deleteFromStore, refreshStoredThemes } = injection(kTheme)
const { state } = injection(kSettingsState)

const linuxTitlebar = computed({
  get: () => state.value?.linuxTitlebar ?? false,
  set: (v) => state.value?.linuxTitlebarSet(v),
})

function onSave() {
  saveCurrentTheme()
}

// --- Theme Store Management ---
const showSaveDialog = ref(false)
const showLoadConfirmDialog = ref(false)
const newThemeName = ref('')
const pendingLoadThemeName = ref('')

async function onSaveToStore() {
  if (!newThemeName.value.trim()) return
  await saveToStore(newThemeName.value.trim())
  newThemeName.value = ''
  showSaveDialog.value = false
}

function onLoadTheme(name: string) {
  pendingLoadThemeName.value = name
  showLoadConfirmDialog.value = true
}

async function confirmLoadTheme() {
  await loadFromStore(pendingLoadThemeName.value)
  showLoadConfirmDialog.value = false
  pendingLoadThemeName.value = ''
}

async function onDeleteTheme(name: string) {
  await deleteFromStore(name)
}

// --- UI Customization State ---
const sidebarSettings = useInjectSidebarSettings()
const sidebarPosition = sidebarSettings.position
const sidebarStyle = sidebarSettings.style
const sidebarAlign = sidebarSettings.align
const sidebarScale = sidebarSettings.scale
const sidebarAutoHide = sidebarSettings.autoHide
const sidebarShowOnlyPinned = sidebarSettings.showOnlyPinned
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
  background-color: transparent; /* Ensure visibility against main bg */
}

/* Horizontal alignment for Top/Bottom */
.sidebar-preview.position-top .sidebar-preview-notch,
.sidebar-preview.position-bottom .sidebar-preview-notch {
  width: 100%;
  flex-direction: row;
  height: 24px;
  align-items: center;
}

/* Vertical alignment for Left/Right */
.sidebar-preview.position-left .sidebar-preview-notch,
.sidebar-preview.position-right .sidebar-preview-notch {
  height: 100%;
  flex-direction: column;
  width: 24px;
  justify-content: center; /* Default vertical align */
}

.sidebar-preview-notch-item {
  width: 12px;
  height: 12px;
  background-color: #bdbdbd;
  border-radius: 3px;
  flex-shrink: 0;
}

/* Notch Alignment - Horizontal (Top/Bottom) */
.sidebar-preview.position-top.align-start .sidebar-preview-notch,
.sidebar-preview.position-bottom.align-start .sidebar-preview-notch { justify-content: flex-start; }
.sidebar-preview.position-top.align-center .sidebar-preview-notch,
.sidebar-preview.position-bottom.align-center .sidebar-preview-notch { justify-content: center; }
.sidebar-preview.position-top.align-end .sidebar-preview-notch,
.sidebar-preview.position-bottom.align-end .sidebar-preview-notch { justify-content: flex-end; }

/* Notch Alignment - Vertical (Left/Right) */
.sidebar-preview.position-left.align-start .sidebar-preview-notch,
.sidebar-preview.position-right.align-start .sidebar-preview-notch { justify-content: flex-start; }
.sidebar-preview.position-left.align-center .sidebar-preview-notch,
.sidebar-preview.position-right.align-center .sidebar-preview-notch { justify-content: center; }
.sidebar-preview.position-left.align-end .sidebar-preview-notch,
.sidebar-preview.position-right.align-end .sidebar-preview-notch { justify-content: flex-end; }

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
