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
const showCustomGradient = ref(false)
const colorMode = ref<'solid' | 'gradient'>('solid')
const gradientStart = ref('#06B6D4')
const gradientEnd = ref('#10B981')
const gradientAngle = ref(135)
const iconTab = ref<'presets' | 'custom' | 'image'>('presets')
const customIconInput = ref('')
const isDragOver = ref(false)

export interface FolderSettingDialogData {
  color: string
  name: string
  noColor?: boolean
  icon?: string
  hasIcon?: boolean
  pinned?: boolean
  hasPinned?: boolean
  onSave?: (saved: { name: string; color: string; icon: string; pinned?: boolean }) => void
}

let data: FolderSettingDialogData | undefined

const hasColor = ref(true)
const hasIcon = ref(false)
const hasPinned = ref(false)

function isImageUrl(val?: string): boolean {
  if (!val) return false
  return val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/') || val.startsWith('image://')
}

function isGradient(val?: string): boolean {
  if (!val) return false
  return val.includes('gradient')
}

function getBaseColor(val?: string, fallback = '#10B981'): string {
  if (!val) return fallback
  if (!isGradient(val)) return val
  const match = val.match(/#(?:[0-9a-fA-F]{3,8})|rgba?\([^)]+\)/)
  return match ? match[0] : fallback
}

const iconCategories = [
  {
    name: 'Modloaders & Platforms',
    icons: [
      { icon: 'xmcl:forge', label: 'Forge Anvil' },
      { icon: 'xmcl:fabric', label: 'Fabric' },
      { icon: 'xmcl:quilt', label: 'Quilt' },
      { icon: 'xmcl:neoForged', label: 'NeoForge' },
      { icon: 'xmcl:optifine', label: 'OptiFine' },
      { icon: 'xmcl:iris', label: 'Iris' },
      { icon: 'xmcl:modrinth', label: 'Modrinth' },
      { icon: 'xmcl:curseforge', label: 'CurseForge' },
      { icon: 'xmcl:bedrock', label: 'Bedrock' },
    ],
  },
  {
    name: 'Gaming & Atmosphere',
    icons: [
      { icon: 'sports_esports', label: 'Controller' },
      { icon: 'videogame_asset', label: 'Console' },
      { icon: 'terrain', label: 'Terrain' },
      { icon: 'castle', label: 'Castle' },
      { icon: 'local_fire_department', label: 'Fire' },
      { icon: 'shield', label: 'Shield' },
      { icon: 'auto_awesome', label: 'Magic' },
      { icon: 'diamond', label: 'Gem' },
      { icon: 'park', label: 'Forest' },
      { icon: 'nightlight', label: 'Night' },
      { icon: 'explore', label: 'Compass' },
      { icon: 'military_tech', label: 'Medal' },
    ],
  },
  {
    name: 'Mods & Tech',
    icons: [
      { icon: 'build', label: 'Tools' },
      { icon: 'extension', label: 'Plugin' },
      { icon: 'bolt', label: 'Energy' },
      { icon: 'science', label: 'Chemistry' },
      { icon: 'rocket_launch', label: 'Space' },
      { icon: 'memory', label: 'Hardware' },
      { icon: 'terminal', label: 'Terminal' },
      { icon: 'dns', label: 'Server' },
      { icon: 'hub', label: 'Network' },
      { icon: 'code', label: 'Code' },
    ],
  },
  {
    name: 'Creative & Media',
    icons: [
      { icon: 'palette', label: 'Palette' },
      { icon: 'brush', label: 'Brush' },
      { icon: 'audiotrack', label: 'Music' },
      { icon: 'photo_camera', label: 'Camera' },
      { icon: 'star', label: 'Star' },
      { icon: 'favorite', label: 'Heart' },
      { icon: 'pets', label: 'Creatures' },
      { icon: 'bug_report', label: 'Debug' },
    ],
  },
  {
    name: 'Organization',
    icons: [
      { icon: '', label: 'Default' },
      { icon: 'folder', label: 'Folder' },
      { icon: 'folder_special', label: 'Special' },
      { icon: 'inventory_2', label: 'Storage' },
      { icon: 'archive', label: 'Archive' },
      { icon: 'bookmark', label: 'Bookmark' },
      { icon: 'category', label: 'Category' },
      { icon: 'tag', label: 'Tag' },
    ],
  },
]

const presetColors = [
  { value: '', label: 'Default' },
  { value: '#06B6D4', label: 'Diamond Cyan' },
  { value: '#10B981', label: 'Emerald Green' },
  { value: '#22C55E', label: 'Grass Green' },
  { value: '#3B82F6', label: 'Lapis Blue' },
  { value: '#8B5CF6', label: 'Amethyst Purple' },
  { value: '#A855F7', label: 'Nether Portal' },
  { value: '#EC4899', label: 'Cherry Blossom' },
  { value: '#F43F5E', label: 'Crimson Rose' },
  { value: '#EF4444', label: 'Redstone Red' },
  { value: '#F97316', label: 'Copper Orange' },
  { value: '#F59E0B', label: 'Gold Amber' },
  { value: '#0D9488', label: 'Sculk Teal' },
  { value: '#475569', label: 'Netherite Slate' },
]

const presetGradients = [
  { value: 'linear-gradient(135deg, #06B6D4 0%, #10B981 100%)', label: 'Diamond & Emerald' },
  { value: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)', label: 'Ender & Lapis' },
  { value: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)', label: 'Nether Fire' },
  { value: 'linear-gradient(135deg, #F59E0B 0%, #EAB308 100%)', label: 'Golden Sun' },
  { value: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)', label: 'Amethyst Blossom' },
  { value: 'linear-gradient(135deg, #0F766E 0%, #0284C7 100%)', label: 'Sculk Deep' },
  { value: 'linear-gradient(135deg, #F43F5E 0%, #991B1B 100%)', label: 'Redstone & Crimson' },
  { value: 'linear-gradient(135deg, #22C55E 0%, #06B6D4 100%)', label: 'Cyber Lime' },
  { value: 'linear-gradient(135deg, #6366F1 0%, #EC4899 100%)', label: 'Twilight' },
  { value: 'linear-gradient(135deg, #334155 0%, #64748B 100%)', label: 'Netherite Slate' },
]

const { isShown } = useDialog<FolderSettingDialogData>('folder-setting', (folderData) => {
  data = folderData
  name.value = folderData.name
  color.value = folderData.color || props.defaultColor
  icon.value = folderData.icon || ''
  pinned.value = !!folderData.pinned
  hasColor.value = !folderData.noColor
  hasIcon.value = !!folderData.hasIcon
  hasPinned.value = !!folderData.hasPinned
  showCustomColor.value = false
  showCustomGradient.value = false

  if (isGradient(color.value)) {
    colorMode.value = 'gradient'
  } else {
    colorMode.value = 'solid'
  }

  if (isImageUrl(icon.value)) {
    iconTab.value = 'image'
  } else if (icon.value && !iconCategories.some(cat => cat.icons.some(i => i.icon === icon.value))) {
    iconTab.value = 'custom'
    customIconInput.value = icon.value
  } else {
    iconTab.value = 'presets'
  }
})

const onSave = () => {
  if (data) {
    const finalColor = hasColor.value ? (color.value === props.defaultColor ? '' : color.value) : data.color
    const finalIcon = hasIcon.value ? icon.value : data.icon
    const finalPinned = hasPinned.value ? pinned.value : data.pinned
    data.name = name.value
    if (hasColor.value) {
      data.color = finalColor
    }
    if (hasIcon.value) {
      data.icon = finalIcon || ''
    }
    if (hasPinned.value) {
      data.pinned = finalPinned
    }
    data.onSave?.({
      name: name.value,
      color: finalColor,
      icon: finalIcon || '',
      pinned: finalPinned,
    })
  }
  isShown.value = false
}

async function pickImageFile() {
  const result = await windowController.showOpenDialog({
    title: t('instanceSetting.icon'),
    filters: [
      {
        name: 'Image',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'ico', 'bmp'],
      },
    ],
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths[0]) return
  icon.value = `http://launcher/media?path=${result.filePaths[0]}`
}

function onDropImage(event: DragEvent) {
  isDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  const path = (file as any).path as string | undefined
  if (path) {
    icon.value = `http://launcher/media?path=${path}`
    iconTab.value = 'image'
  }
}

function applyCustomIcon() {
  const trimmed = customIconInput.value.trim().toLowerCase()
  if (trimmed) {
    icon.value = trimmed
  }
}

function applyCustomGradient() {
  color.value = `linear-gradient(${gradientAngle.value}deg, ${gradientStart.value} 0%, ${gradientEnd.value} 100%)`
}

const { show: showAutoGroup } = useDialog('auto-group-instances')
const { t } = useI18n()
</script>

<template>
  <v-dialog
    v-model="isShown"
    :width="hasIcon ? 920 : 480"
  >
    <v-card
      theme="dark"
      class="flex flex-col rounded-3xl border border-white/10 bg-[#141416]/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
      elevation="0"
    >
      <!-- Dialog Header -->
      <div class="flex items-center justify-between px-6 pt-4 pb-3 border-b border-white/5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <v-icon size="18" color="primary">folder_open</v-icon>
          </div>
          <span class="text-base font-bold text-white tracking-wide">
            {{ t('mod.folderSetting') || t('instances.folderSetting') }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <v-btn
            size="small"
            variant="text"
            color="primary"
            prepend-icon="sort"
            class="text-xs font-medium"
            @click="isShown = false; showAutoGroup()"
          >
            {{ t('instanceAutoGroup.title') }}
          </v-btn>
          <v-btn
            icon
            size="small"
            variant="text"
            :aria-label="t('shared.close')"
            :title="t('shared.close')"
            class="text-white/50 hover:text-white"
            @click="isShown = false"
          >
            <v-icon size="18">close</v-icon>
          </v-btn>
        </div>
      </div>

      <v-card-text class="p-6 overflow-y-auto max-h-[78vh] visible-scroll">
        <div :class="hasIcon ? 'grid grid-cols-1 md:grid-cols-12 gap-6' : 'max-w-md mx-auto space-y-4'">
          <!-- Left Column: col-span-5 (Preview, Name, Pin, Color) -->
          <div :class="hasIcon ? 'md:col-span-5 flex flex-col gap-4' : 'flex flex-col gap-4'">
            <!-- Live Preview Card -->
            <div class="p-3.5 rounded-2xl border border-white/10 bg-white/[0.03]">
              <div class="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>{{ t('mod.preview') }}</span>
              </div>
              <div
                class="flex items-center gap-3 p-3 rounded-xl border transition-all"
                :style="{
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderColor: isGradient(color) ? 'rgba(255, 255, 255, 0.2)' : (color ? `${color}40` : 'rgba(255, 255, 255, 0.08)'),
                }"
              >
                <div
                  v-if="color"
                  class="w-1.5 h-8 rounded-full shrink-0"
                  :style="{
                    background: color,
                    boxShadow: `0 0 10px ${getBaseColor(color)}88`,
                  }"
                />
                <div
                  class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden shadow-lg"
                  :style="{
                    background: isGradient(color) ? color : (color || 'rgba(255, 255, 255, 0.08)'),
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: isGradient(color) || color ? `0 4px 16px ${getBaseColor(color)}50` : 'none',
                  }"
                >
                  <img
                    v-if="isImageUrl(icon)"
                    :src="icon"
                    class="w-full h-full object-cover"
                  >
                  <v-icon
                    v-else
                    :size="24"
                    :color="color ? 'white' : 'primary'"
                    class="preview-folder-icon"
                  >
                    {{ icon || 'folder' }}
                  </v-icon>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold truncate text-white">
                    {{ name || t('shared.name') }}
                  </div>
                  <div class="text-xs text-white/50">
                    {{ t('instances.folder') }}
                  </div>
                </div>
                <div v-if="pinned" class="flex items-center gap-1 shrink-0">
                  <v-icon
                    size="16"
                    color="primary"
                    class="rotate-45"
                  >
                    push_pin
                  </v-icon>
                </div>
              </div>
            </div>

            <!-- Name Input -->
            <div>
              <v-text-field
                v-model="name"
                :label="t('shared.name')"
                variant="outlined"
                density="compact"
                rounded="xl"
                hide-details
                autofocus
              />
            </div>

            <!-- Pin to Top Toggle (if supported) -->
            <template v-if="hasPinned">
              <div
                class="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] transition-colors select-none"
                @click="pinned = !pinned"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <v-icon size="18" color="primary" class="rotate-45">push_pin</v-icon>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-white">{{ t('mod.pinToTop') }}</div>
                    <div class="text-xs text-white/50">{{ t('mod.pinToTopHint') }}</div>
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

            <!-- Color Picker & Gradient (if supported) -->
            <template v-if="hasColor">
              <div class="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-xs font-semibold uppercase tracking-wider text-white/50">
                    {{ t('mod.folderColor') }}
                  </div>

                  <div class="flex items-center gap-2">
                    <v-btn-toggle
                      v-model="colorMode"
                      density="compact"
                      variant="outlined"
                      color="primary"
                      mandatory
                      divided
                      size="x-small"
                    >
                      <v-btn value="solid" size="x-small" class="px-2 font-medium">
                        Solid
                      </v-btn>
                      <v-btn value="gradient" size="x-small" class="px-2 font-medium">
                        Gradient
                      </v-btn>
                    </v-btn-toggle>

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

                <!-- Mode A: Solid Colors -->
                <div v-if="colorMode === 'solid'">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-[11px] text-white/50">Presets</span>
                    <v-btn
                      size="x-small"
                      variant="text"
                      color="primary"
                      @click="showCustomColor = !showCustomColor"
                    >
                      {{ t('mod.customColor') }}
                    </v-btn>
                  </div>

                  <div class="flex flex-wrap gap-2 items-center" role="group" :aria-label="t('mod.folderColor')">
                    <v-btn
                      v-for="swatch in presetColors"
                      :key="swatch.value"
                      v-shared-tooltip="swatch.label"
                      :aria-label="swatch.label"
                      icon
                      size="x-small"
                      variant="flat"
                      class="transition-transform hover:scale-110"
                      :style="{
                        background: swatch.value || 'rgba(255,255,255,0.08)',
                        border: color === swatch.value ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.15)',
                        boxShadow: color === swatch.value ? `0 0 10px ${swatch.value || '#fff'}` : undefined,
                        transform: color === swatch.value ? 'scale(1.15)' : undefined,
                      }"
                      @click="color = swatch.value"
                    >
                      <v-icon
                        v-if="color === swatch.value || (!color && !swatch.value)"
                        size="14"
                        color="white"
                      >
                        check
                      </v-icon>
                    </v-btn>
                  </div>

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

                <!-- Mode B: Gradient Colors -->
                <div v-else class="space-y-2.5">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] text-white/50">Minecraft Gradients</span>
                    <v-btn
                      size="x-small"
                      variant="text"
                      color="primary"
                      @click="showCustomGradient = !showCustomGradient"
                    >
                      Custom Gradient
                    </v-btn>
                  </div>

                  <div class="grid grid-cols-2 gap-1.5" role="group" aria-label="Gradient Presets">
                    <v-btn
                      v-for="grad in presetGradients"
                      :key="grad.value"
                      variant="flat"
                      rounded="lg"
                      height="32"
                      class="justify-start text-xs font-semibold text-white px-2.5 relative overflow-hidden transition-all hover:scale-[1.02] border"
                      :class="color === grad.value ? 'border-white ring-2 ring-white/60 shadow-lg' : 'border-white/10 opacity-90 hover:opacity-100'"
                      :style="{ background: grad.value }"
                      @click="color = grad.value"
                    >
                      <div class="flex items-center justify-between w-full drop-shadow-md">
                        <span class="truncate text-[11px]">{{ grad.label }}</span>
                        <v-icon v-if="color === grad.value" size="14">check</v-icon>
                      </div>
                    </v-btn>
                  </div>

                  <v-expand-transition>
                    <div v-if="showCustomGradient" class="p-3 rounded-xl border border-white/10 bg-white/[0.02] space-y-3 mt-2">
                      <div class="text-xs font-medium text-white/80">Customize Gradient Colors:</div>
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <div class="text-[11px] text-white/50 mb-1">Start Color</div>
                          <div class="flex items-center gap-2">
                            <input
                              v-model="gradientStart"
                              type="color"
                              class="w-7 h-7 rounded border border-white/20 cursor-pointer bg-transparent"
                              @change="applyCustomGradient"
                            >
                            <span class="text-xs font-mono">{{ gradientStart }}</span>
                          </div>
                        </div>
                        <div>
                          <div class="text-[11px] text-white/50 mb-1">End Color</div>
                          <div class="flex items-center gap-2">
                            <input
                              v-model="gradientEnd"
                              type="color"
                              class="w-7 h-7 rounded border border-white/20 cursor-pointer bg-transparent"
                              @change="applyCustomGradient"
                            >
                            <span class="text-xs font-mono">{{ gradientEnd }}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div class="text-[11px] text-white/50 mb-1">Direction Angle</div>
                        <div class="flex items-center gap-1.5">
                          <v-btn
                            v-for="angle in [45, 90, 135, 180]"
                            :key="angle"
                            size="x-small"
                            :variant="gradientAngle === angle ? 'flat' : 'outlined'"
                            :color="gradientAngle === angle ? 'primary' : undefined"
                            @click="gradientAngle = angle; applyCustomGradient()"
                          >
                            {{ angle }}°
                          </v-btn>
                        </div>
                      </div>
                    </div>
                  </v-expand-transition>
                </div>
              </div>
            </template>
          </div>

          <!-- Right Column: col-span-7 (Folder Icon Picker) -->
          <div v-if="hasIcon" class="md:col-span-7 flex flex-col justify-start items-stretch md:border-l md:border-white/5 md:pl-6">
            <div class="flex items-center justify-between mb-2">
              <div class="text-xs font-semibold uppercase tracking-wider text-white/50">
                {{ t('mod.folderIcon') }}
              </div>
              <v-btn
                v-if="icon"
                size="x-small"
                variant="text"
                color="warning"
                @click="icon = ''"
              >
                {{ t('shared.reset') }}
              </v-btn>
            </div>

            <!-- Icon Mode Tabs -->
            <v-tabs
              v-model="iconTab"
              density="compact"
              color="primary"
              class="border-b border-white/10 mb-3 flex-none shrink-0"
            >
              <v-tab value="presets" class="text-xs font-semibold capitalize px-3">
                <v-icon size="18" start>grid_view</v-icon>
                Presets
              </v-tab>
              <v-tab value="custom" class="text-xs font-semibold capitalize px-3">
                <v-icon size="18" start>text_fields</v-icon>
                Icon Name
              </v-tab>
              <v-tab value="image" class="text-xs font-semibold capitalize px-3">
                <v-icon size="18" start>add_photo_alternate</v-icon>
                {{ t('instanceSetting.icon') }}
              </v-tab>
            </v-tabs>

            <!-- Tab 1: Presets -->
            <div
              v-if="iconTab === 'presets'"
              class="space-y-3.5 overflow-y-auto max-h-[460px] visible-scroll pr-1"
            >
              <div
                v-for="cat in iconCategories"
                :key="cat.name"
                class="space-y-1.5"
              >
                <div class="text-[11px] font-semibold text-white/50 px-1 flex items-center gap-1.5">
                  <v-icon size="14" color="primary">videogame_asset</v-icon>
                  <span>{{ cat.name }}</span>
                </div>
                <div class="grid grid-cols-9 gap-1.5" role="group" :aria-label="cat.name">
                  <v-btn
                    v-for="item in cat.icons"
                    :key="item.icon"
                    v-shared-tooltip="item.label"
                    :aria-label="item.label"
                    :color="icon === item.icon ? 'primary' : undefined"
                    :variant="icon === item.icon ? 'tonal' : 'text'"
                    rounded="lg"
                    height="38"
                    min-width="0"
                    class="p-0 border border-white/5"
                    @click="icon = item.icon"
                  >
                    <v-icon size="22" :color="icon === item.icon ? 'primary' : 'medium-emphasis'">
                      {{ item.icon || 'folder' }}
                    </v-icon>
                  </v-btn>
                </div>
              </div>
            </div>

            <!-- Tab 2: Custom Material Icon Name -->
            <div v-else-if="iconTab === 'custom'" class="p-4 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
              <div class="text-xs text-white/60">
                Enter any Google Material icon name (e.g. <code>smart_toy</code>, <code>anchor</code>, <code>casino</code>, <code>flight</code>, <code>eco</code>).
              </div>
              <div class="flex items-center gap-2">
                <v-text-field
                  v-model="customIconInput"
                  placeholder="e.g. smart_toy"
                  variant="outlined"
                  density="compact"
                  rounded="lg"
                  hide-details
                  class="flex-1"
                  @keydown.enter.prevent="applyCustomIcon"
                />
                <v-btn
                  color="primary"
                  variant="tonal"
                  rounded="lg"
                  size="small"
                  class="h-10 px-4 font-semibold"
                  @click="applyCustomIcon"
                >
                  Apply
                </v-btn>
              </div>

              <div v-if="customIconInput" class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/70">
                <span>Preview:</span>
                <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <v-icon size="22" color="primary">{{ customIconInput.trim().toLowerCase() }}</v-icon>
                </div>
                <span class="font-mono text-white/90">{{ customIconInput.trim().toLowerCase() }}</span>
              </div>

              <div class="pt-1">
                <div class="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Quick Suggestions
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <v-btn
                    v-for="sug in ['smart_toy', 'anchor', 'casino', 'flight', 'eco', 'public', 'shield', 'sports_esports', 'tune', 'auto_fix_high', 'gamepad', 'gps_fixed']"
                    :key="sug"
                    size="x-small"
                    variant="tonal"
                    rounded="lg"
                    class="text-[11px]"
                    @click="customIconInput = sug; applyCustomIcon()"
                  >
                    <v-icon size="14" start>{{ sug }}</v-icon>
                    {{ sug }}
                  </v-btn>
                </div>
              </div>
            </div>

            <!-- Tab 3: Custom Image File -->
            <div
              v-else-if="iconTab === 'image'"
              class="p-8 rounded-2xl border border-dashed transition-all text-center flex flex-col items-center justify-center gap-3 cursor-pointer"
              :class="isDragOver
                ? 'border-primary bg-primary/10'
                : 'border-white/15 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/30'"
              @dragover.prevent="isDragOver = true"
              @dragleave="isDragOver = false"
              @drop.prevent="onDropImage"
              @click="pickImageFile"
            >
              <div
                v-if="isImageUrl(icon)"
                class="relative w-20 h-20 rounded-2xl overflow-hidden border border-white/20 shadow-lg group"
              >
                <img :src="icon" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <v-icon size="24" color="white">edit</v-icon>
                </div>
              </div>
              <div v-else class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <v-icon size="28" color="primary">add_photo_alternate</v-icon>
              </div>

              <div class="text-sm text-white font-medium">
                {{ isImageUrl(icon) ? t('instanceSetting.icon') : (t('shared.browse') || 'Select image or drop file here') }}
              </div>
              <div class="text-xs text-white/50">
                PNG, JPG, WEBP, SVG, GIF, ICO
              </div>

              <div v-if="isImageUrl(icon)" class="flex items-center gap-2 mt-2" @click.stop>
                <v-btn
                  size="small"
                  variant="outlined"
                  rounded="lg"
                  color="error"
                  prepend-icon="delete"
                  @click="icon = ''"
                >
                  {{ t('shared.remove') || 'Remove' }}
                </v-btn>
              </div>
            </div>
          </div>
        </div>
      </v-card-text>

      <v-divider class="border-white/5" />
      <div class="flex items-center justify-between px-6 py-3.5 bg-white/[0.01]">
        <v-btn
          variant="text"
          rounded="xl"
          class="text-white/70 hover:text-white"
          @click="isShown = false"
        >
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          rounded="xl"
          prepend-icon="check"
          class="font-bold px-6 shadow-md"
          @click="onSave"
        >
          {{ t('modified.save') }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.preview-folder-icon {
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
}
.preview-folder-icon :deep(img) {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6)) brightness(1.2) contrast(1.1);
}
</style>
