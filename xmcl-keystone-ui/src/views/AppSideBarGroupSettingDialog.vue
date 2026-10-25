<script setup lang="ts">
import { useDialog } from '@/composables/dialog'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const props = defineProps<{
  defaultColor: string
}>()

const name = ref('')
const color = ref(props.defaultColor)
const icon = ref('')
const pinned = ref(false)
const showCustomColor = ref(false)

let data: {
  color: string
  name: string
  icon?: string
  pinned?: boolean
} | undefined

const hasColor = ref(true)
const hasIcon = ref(false)
const hasPinned = ref(false)

const presetIcons = [
  { icon: '', label: 'Default' },
  { icon: 'bolt', label: 'Performance' },
  { icon: 'extension', label: 'Libraries' },
  { icon: 'build', label: 'Tools' },
  { icon: 'palette', label: 'Cosmetics' },
  { icon: 'sports_esports', label: 'Gameplay' },
  { icon: 'public', label: 'World' },
  { icon: 'star', label: 'Favorites' },
  { icon: 'shield', label: 'Defense' },
  { icon: 'auto_awesome', label: 'Magic' },
  { icon: 'science', label: 'Science' },
  { icon: 'inventory_2', label: 'Items' },
  { icon: 'pets', label: 'Mobs' },
  { icon: 'audiotrack', label: 'Audio' },
]

const presetColors = [
  { value: '', label: 'Default' },
  { value: '#10B981', label: 'Emerald' },
  { value: '#22C55E', label: 'Green' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#F43F5E', label: 'Rose' },
  { value: '#EF4444', label: 'Red' },
  { value: '#F97316', label: 'Orange' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#64748B', label: 'Slate' },
]

const { isShown } = useDialog<{
  color: string
  name: string
  noColor?: boolean
  icon?: string
  hasIcon?: boolean
  pinned?: boolean
  hasPinned?: boolean
}>('folder-setting', (folderData) => {
  data = folderData
  name.value = folderData.name
  color.value = folderData.color || props.defaultColor
  icon.value = folderData.icon || ''
  pinned.value = !!folderData.pinned
  hasColor.value = !folderData.noColor
  hasIcon.value = !!folderData.hasIcon
  hasPinned.value = !!folderData.hasPinned
  showCustomColor.value = false
})

const onSave = () => {
  if (data) {
    data.name = name.value
    if (hasColor.value) {
      data.color = color.value === props.defaultColor ? '' : color.value
    }
    if (hasIcon.value) {
      data.icon = icon.value
    }
    if (hasPinned.value) {
      data.pinned = pinned.value
    }
  }
  isShown.value = false
}

const { t } = useI18n()
</script>

<template>
  <v-dialog
    v-model="isShown"
    width="480"
  >
    <v-card
      theme="dark"
      class="flex flex-col rounded-2xl border border-white/10 bg-[#141416]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      elevation="0"
    >
      <!-- Dialog Header -->
      <div class="flex items-center justify-between px-5 pt-4 pb-2 border-b border-white/5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <v-icon size="20" color="primary">folder_open</v-icon>
          </div>
          <span class="text-base font-semibold text-white">
            {{ t('mod.folderSetting') || t('instances.folderSetting') }}
          </span>
        </div>
        <v-btn
          icon
          size="small"
          variant="text"
          :aria-label="t('shared.close')"
          :title="t('shared.close')"
          class="text-medium-emphasis hover:text-white"
          @click="isShown = false"
        >
          <v-icon size="18">close</v-icon>
        </v-btn>
      </div>

      <v-card-text class="overflow-y-auto max-h-[75vh] px-5 py-4 visible-scroll">
        <!-- Live Preview Card -->
        <div class="mb-4 p-3 rounded-xl border border-white/10 bg-white/[0.03]">
          <div class="text-[11px] font-semibold text-medium-emphasis uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>{{ t('mod.preview') }}</span>
          </div>
          <div
            class="flex items-center gap-3 p-2.5 rounded-xl border transition-all"
            :style="{
              background: color ? `linear-gradient(90deg, ${color}20 0%, ${color}08 50%, rgba(255, 255, 255, 0.02) 100%)` : 'rgba(255, 255, 255, 0.03)',
              borderColor: color ? `${color}40` : 'rgba(255, 255, 255, 0.08)',
            }"
          >
            <div
              v-if="color"
              class="w-1 h-5 rounded-full shrink-0"
              :style="{ background: color, boxShadow: `0 0 8px ${color}88` }"
            />
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              :style="{
                background: color ? `${color}25` : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${color ? `${color}44` : 'rgba(255, 255, 255, 0.1)'}`,
              }"
            >
              <v-icon :size="20" :color="color || 'primary'">
                {{ icon || 'folder' }}
              </v-icon>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold truncate text-white">
                {{ name || t('shared.name') }}
              </div>
              <div class="text-xs text-medium-emphasis">
                {{ t('mod.mods', { count: 5 }) }}
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <v-icon
                v-if="pinned"
                size="16"
                color="primary"
                class="rotate-45"
              >
                push_pin
              </v-icon>
              <div
                class="w-7 h-7 rounded-lg flex items-center justify-center"
                :style="{ background: color ? `${color}25` : 'rgba(255, 255, 255, 0.06)' }"
              >
                <v-icon :size="16" :color="color || undefined">folder</v-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- Name Input -->
        <div class="mb-4">
          <v-text-field
            v-model="name"
            :label="t('shared.name')"
            variant="outlined"
            density="comfortable"
            rounded="xl"
            hide-details
            autofocus
          />
        </div>

        <!-- Pin to Top Toggle (if supported) -->
        <template v-if="hasPinned">
          <div
            class="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.02] mb-4 cursor-pointer hover:bg-white/[0.04] transition-colors select-none"
            @click="pinned = !pinned"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <v-icon size="18" color="primary" class="rotate-45">push_pin</v-icon>
              </div>
              <div>
                <div class="text-sm font-medium text-white">{{ t('mod.pinToTop') }}</div>
                <div class="text-xs text-medium-emphasis">{{ t('mod.pinToTopHint') }}</div>
              </div>
            </div>
            <v-switch
              v-model="pinned"
              color="primary"
              density="compact"
              hide-details
              @click.stop
            />
          </div>
        </template>

        <!-- Icon Picker (if supported) -->
        <template v-if="hasIcon">
          <div class="mb-4">
            <div class="text-xs font-semibold uppercase tracking-wider text-medium-emphasis mb-2">
              {{ t('mod.folderIcon') }}
            </div>
            <div class="grid grid-cols-7 gap-2" role="radiogroup" :aria-label="t('mod.folderIcon')">
              <button
                v-for="item in presetIcons"
                :key="item.icon"
                type="button"
                v-shared-tooltip="item.label"
                role="radio"
                :aria-checked="icon === item.icon"
                :aria-label="item.label"
                class="h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                :class="icon === item.icon
                  ? 'bg-primary/20 border-primary shadow-sm shadow-primary/20 scale-105'
                  : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/20'"
                @click="icon = item.icon"
                @keydown.space.prevent="icon = item.icon"
                @keydown.enter.prevent="icon = item.icon"
              >
                <v-icon size="20" :color="icon === item.icon ? 'primary' : 'medium-emphasis'">
                  {{ item.icon || 'folder' }}
                </v-icon>
              </button>
            </div>
          </div>
        </template>

        <!-- Color Picker (if supported) -->
        <template v-if="hasColor">
          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="text-xs font-semibold uppercase tracking-wider text-medium-emphasis">
                {{ t('mod.folderColor') }}
              </div>
              <div class="flex items-center gap-2">
                <v-btn
                  size="x-small"
                  variant="text"
                  color="primary"
                  @click="showCustomColor = !showCustomColor"
                >
                  {{ t('mod.customColor') }}
                </v-btn>
                <v-btn
                  v-if="color && color !== props.defaultColor"
                  size="x-small"
                  variant="text"
                  color="warning"
                  @click="color = ''"
                >
                  {{ t('shared.reset') }}
                </v-btn>
              </div>
            </div>
            <!-- Preset Color Circles -->
            <div class="flex flex-wrap gap-2.5 items-center" role="radiogroup" :aria-label="t('mod.folderColor')">
              <button
                v-for="swatch in presetColors"
                :key="swatch.value"
                type="button"
                v-shared-tooltip="swatch.label"
                role="radio"
                :aria-checked="color === swatch.value || (!color && !swatch.value)"
                :aria-label="swatch.label"
                class="w-7 h-7 rounded-full cursor-pointer flex items-center justify-center transition-all hover:scale-110 border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                :style="{
                  background: swatch.value || 'rgba(255,255,255,0.08)',
                  borderColor: color === swatch.value ? '#ffffff' : 'rgba(255,255,255,0.15)',
                  boxShadow: color === swatch.value ? `0 0 10px ${swatch.value || '#fff'}` : undefined,
                  transform: color === swatch.value ? 'scale(1.15)' : undefined,
                }"
                @click="color = swatch.value"
                @keydown.space.prevent="color = swatch.value"
                @keydown.enter.prevent="color = swatch.value"
              >
                <v-icon
                  v-if="color === swatch.value || (!color && !swatch.value)"
                  size="14"
                  color="white"
                >
                  check
                </v-icon>
              </button>
            </div>
            <!-- Expandable custom color picker -->
            <v-expand-transition>
              <div v-if="showCustomColor" class="mt-3 pt-3 border-t border-white/5 flex justify-center">
                <v-color-picker
                  v-model="color"
                  dot-size="20"
                  mode="rgba"
                  elevation="0"
                  class="bg-transparent"
                />
              </div>
            </v-expand-transition>
          </div>
        </template>
      </v-card-text>

      <v-divider class="border-white/5" />
      <div class="flex items-center justify-between px-5 py-3 bg-white/[0.01]">
        <v-btn
          variant="text"
          rounded="lg"
          @click="isShown = false"
        >
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          rounded="lg"
          prepend-icon="check"
          class="font-semibold"
          @click="onSave"
        >
          {{ t('modified.save') }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>
