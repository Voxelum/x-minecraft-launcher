<template>
  <div class="bp-library-root flex-1 flex flex-col justify-between overflow-hidden relative">
    <!-- Dynamic Ambient Backdrop (Instance Background, Screenshots, or Icon) -->
    <div v-if="backdropUrl" class="bp-backdrop">
      <transition name="fade-transition">
        <div :key="backdropUrl" class="bp-backdrop-inner">
          <img
            :src="backdropUrl"
            class="bp-backdrop-ambient"
            :class="{ 'bp-backdrop-ambient--icon': isIconBackdrop }"
            alt="Backdrop Ambient"
          >
        </div>
      </transition>
      <div class="bp-backdrop-overlay" />
    </div>

    <!-- Hero Showcase of Current Selected Instance -->
    <div class="bp-hero relative z-10">
      <div v-if="currentInstance && currentInstance.path" class="bp-hero-card">
        <div class="bp-hero-icon-wrap">
          <div class="bp-hero-icon-glow" />
          <img
            :src="heroFavicon"
            class="bp-hero-icon"
            alt="Instance Icon"
          >
        </div>

        <div class="bp-hero-info">
          <h1 class="bp-hero-title">
            {{ heroName }}
          </h1>

          <div class="bp-hero-chips">
            <!-- Bedrock Edition Chips -->
            <template v-if="isBedrockInstance">
              <span class="bp-chip bp-chip--primary">
                <v-icon size="16">view_in_ar</v-icon>
                Minecraft Bedrock Edition
              </span>
              <span v-if="!bedrockSupported" class="bp-chip text-warning">
                <v-icon size="16">warning</v-icon>
                {{ t('instances.editionBedrockWindowsOnly') }}
              </span>
              <span v-else-if="bedrockInstallation.installed" class="bp-chip text-success">
                <v-icon size="16">check_circle</v-icon>
                {{ t('bedrock.installed', { version: bedrockInstallation.version || '—' }) }}
              </span>
              <span v-else class="bp-chip text-warning">
                <v-icon size="16">download</v-icon>
                {{ t('bedrock.install') }}
              </span>
            </template>

            <!-- Java Edition Chips -->
            <template v-else>
              <span v-if="currentInstance.runtime.minecraft" class="bp-chip bp-chip--primary">
                <img :src="BuiltinImages.minecraft" class="w-4 h-4 object-contain inline-block mr-1" alt="MC" />
                Minecraft {{ currentInstance.runtime.minecraft }}
              </span>
              <span v-if="modLoaderBadge" class="bp-chip">
                <img v-if="modLoaderImage" :src="modLoaderImage" class="w-4 h-4 object-contain inline-block mr-1" alt="Loader" />
                <v-icon v-else size="16">extension</v-icon>
                {{ modLoaderBadge }}
              </span>
            </template>

            <span v-if="currentInstance.server" class="bp-chip">
              <v-icon size="16">dns</v-icon>
              {{ currentInstance.server.host }}:{{ currentInstance.server.port }}
            </span>
            <span v-if="currentInstance.playtime" class="bp-chip">
              <v-icon size="16">schedule</v-icon>
              {{ formatPlaytime(currentInstance.playtime) }}
            </span>
            <span
              v-if="currentInstanceFolder"
              class="bp-chip"
              :style="currentInstanceFolder.color ? { borderColor: currentInstanceFolder.color } : {}"
            >
              <v-icon size="16" :style="currentInstanceFolder.color ? { color: currentInstanceFolder.color } : {}">
                folder
              </v-icon>
              {{ currentInstanceFolder.name }}
            </span>
          </div>

          <div class="bp-hero-actions">
            <!-- Row 1: Primary Actions -->
            <div class="bp-hero-actions-main">
              <!-- Bedrock Install Button if Bedrock not installed -->
              <button
                v-if="isBedrockInstance && !bedrockInstallation.installed"
                type="button"
                class="bp-play-btn"
                :disabled="bedrockInstalling || !bedrockSupported"
                tabindex="0"
                data-gamepad-focusable
                @click="onInstallBedrock"
              >
                <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
                <v-progress-circular
                  v-if="bedrockInstalling"
                  indeterminate
                  size="20"
                  width="3"
                  color="white"
                />
                <v-icon v-else size="24">get_app</v-icon>
                <span>{{ t('bedrock.install') }}</span>
              </button>

              <!-- Game Running: Stop & Force Close Buttons -->
              <template v-else-if="isRunning(currentInstance.path)">
                <button
                  type="button"
                  class="bp-play-btn bp-play-btn--stop"
                  tabindex="0"
                  data-gamepad-focusable
                  @click="onStopGame(false)"
                >
                  <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
                  <v-icon size="24">stop</v-icon>
                  <span>{{ t('bigPicture.stopGame') }}</span>
                </button>

                <button
                  type="button"
                  class="bp-sec-btn bp-sec-btn--kill"
                  tabindex="0"
                  data-gamepad-focusable
                  :title="t('bigPicture.forceKillHint')"
                  @click="onStopGame(true)"
                >
                  <v-icon size="20" color="error">power_settings_new</v-icon>
                  <span>{{ t('bigPicture.forceKill') }}</span>
                </button>
              </template>

              <!-- Game Launching: Cancel Launch Button -->
              <button
                v-else-if="isLaunching(currentInstance.path)"
                type="button"
                class="bp-play-btn opacity-85 hover:opacity-100"
                tabindex="0"
                data-gamepad-focusable
                @click="onCancelLaunch"
              >
                <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
                <v-progress-circular
                  indeterminate
                  size="20"
                  width="3"
                  color="white"
                />
                <span>{{ t('launch.cancel') }}</span>
              </button>

              <!-- Large Play Button -->
              <button
                v-else
                ref="playButtonRef"
                type="button"
                class="bp-play-btn"
                tabindex="0"
                data-gamepad-focusable
                @click="onPlayClick"
              >
                <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
                <v-icon size="24">play_arrow</v-icon>
                <span>{{ playButtonText }}</span>
              </button>

              <!-- Instance Settings Button -->
              <button
                type="button"
                class="bp-sec-btn"
                tabindex="0"
                data-gamepad-focusable
                @click="onOpenSettings"
              >
                <span v-if="gamepadConnected" class="bp-glyph bp-glyph--x">{{ buttonXLabel }}</span>
                <v-icon size="20">settings</v-icon>
                <span>{{ t('bigPicture.instanceSettings') }}</span>
              </button>

              <!-- Open Folder Button -->
              <button
                type="button"
                class="bp-sec-btn"
                tabindex="0"
                data-gamepad-focusable
                @click="onOpenFolder"
              >
                <span v-if="gamepadConnected" class="bp-glyph bp-glyph--y">{{ buttonYLabel }}</span>
                <v-icon size="20">folder_open</v-icon>
                <span>{{ t('bigPicture.openFolder') }}</span>
              </button>

              <!-- Change Background Button -->
              <button
                type="button"
                class="bp-sec-btn"
                tabindex="0"
                data-gamepad-focusable
                @click="backgroundDialog = true"
              >
                <v-icon size="20">wallpaper</v-icon>
                <span>{{ t('bigPicture.changeBackground') }}</span>
              </button>

              <!-- Delete Instance Button -->
              <button
                type="button"
                class="bp-sec-btn hover:!border-red-500/50 hover:!text-red-400"
                tabindex="0"
                data-gamepad-focusable
                :title="t('instance.delete')"
                @click="deleteConfirmDialog = true"
              >
                <v-icon size="20" color="error">delete</v-icon>
                <span>{{ t('instance.delete') }}</span>
              </button>
            </div>

            <!-- Row 2: Console Game Content Strip (Mods, Shaders, Saves, Blueprints) -->
            <div v-if="!isBedrockInstance" class="bp-content-strip">
              <!-- Manage Mods Button -->
              <button
                type="button"
                class="bp-content-btn"
                tabindex="0"
                data-gamepad-focusable
                @click="modsDrawer = true"
              >
                <v-icon size="18">extension</v-icon>
                <span>{{ t('mod.name', 2) }}</span>
              </button>

              <!-- Manage Shaders Button -->
              <button
                type="button"
                class="bp-content-btn"
                tabindex="0"
                data-gamepad-focusable
                @click="shadersDrawer = true"
              >
                <v-icon size="18">wb_sunny</v-icon>
                <span>{{ t('shaderPack.name', 2) }}</span>
              </button>

              <!-- Manage Maps Button -->
              <button
                type="button"
                class="bp-content-btn"
                tabindex="0"
                data-gamepad-focusable
                @click="savesDrawer = true"
              >
                <v-icon size="18">map</v-icon>
                <span>{{ t('save.name', 2) }}</span>
              </button>

              <!-- Manage Blueprints Button -->
              <button
                type="button"
                class="bp-content-btn"
                tabindex="0"
                data-gamepad-focusable
                @click="blueprintsDrawer = true"
              >
                <v-icon size="18">view_in_ar</v-icon>
                <span>{{ t('blueprint.name', 2) }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- No instances empty state: High-end Console Welcome Hero -->
      <div v-else class="relative flex flex-col items-center justify-center w-full py-16 px-6 text-center select-none">
        <!-- Ambient radial glow behind the emblem -->
        <div class="absolute w-72 h-72 rounded-full bg-primary/15 blur-3xl pointer-events-none -z-10" />

        <!-- Console Controller Icon Emblem -->
        <div class="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/15 flex items-center justify-center shadow-[0_12px_40px_rgba(0,0,0,0.6)] mb-6">
          <div class="absolute inset-0 rounded-3xl bg-primary/10 blur-md pointer-events-none" />
          <v-icon size="56" color="primary">sports_esports</v-icon>
        </div>

        <!-- Typography -->
        <h2 class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
          {{ t('bigPicture.noInstances') }}
        </h2>
        <p class="text-sm sm:text-base text-white/60 max-w-lg mx-auto leading-relaxed mb-8">
          {{ t('bigPicture.createFirstInstance') }}
        </p>

        <!-- Action Buttons with ample spacing -->
        <div class="flex items-center justify-center gap-4 flex-wrap">
          <button
            type="button"
            class="bp-play-btn !px-8 !py-3.5 !h-14 font-extrabold text-lg flex items-center gap-3 rounded-2xl shadow-[0_8px_32px_rgba(var(--v-theme-primary),0.4)]"
            tabindex="0"
            data-gamepad-focusable
            @click="openAddInstance()"
          >
            <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a !text-xs">{{ buttonALabel }}</span>
            <v-icon size="24">add_circle</v-icon>
            <span>{{ t('bigPicture.addInstance') }}</span>
          </button>

          <button
            type="button"
            class="bp-sec-btn !px-6 !py-3.5 !h-14 font-bold text-base flex items-center gap-2.5 rounded-2xl"
            tabindex="0"
            data-gamepad-focusable
            @click="$emit('browse-market')"
          >
            <v-icon size="22" color="primary">storefront</v-icon>
            <span>{{ t('bigPicture.discover') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Horizontal Shelf / Carousel of Instances -->
    <div class="bp-shelf relative z-10">
      <div class="bp-shelf-header">
        <div class="flex items-center gap-3 flex-wrap">
          <span class="bp-shelf-title">
            {{ t('bigPicture.recentInstances') }} ({{ displayInstances.length }})
          </span>

          <!-- Folder filter tabs -->
          <div v-if="folderTabs.length > 0" class="bp-folder-tabs">
            <button
              v-for="folder in folderTabs"
              :key="folder.id"
              type="button"
              class="bp-folder-tab"
              :class="{ 'active': selectedFolderId === folder.id }"
              tabindex="0"
              data-gamepad-focusable
              @click="selectFolder(folder.id)"
              @keydown.enter.prevent="selectFolder(folder.id)"
            >
              <v-icon size="14" :style="folder.color ? { color: folder.color } : {}">
                {{ folder.icon }}
              </v-icon>
              <span>{{ folder.name }}</span>
              <span class="bp-folder-tab-count">({{ folder.count }})</span>
            </button>

            <!-- Create Folder Button -->
            <button
              type="button"
              class="bp-folder-tab bp-folder-tab--add"
              tabindex="0"
              data-gamepad-focusable
              :title="t('bigPicture.createFolder')"
              @click="openCreateFolderDialog"
              @keydown.enter.prevent="openCreateFolderDialog"
            >
              <v-icon size="14">add</v-icon>
              <span>{{ t('bigPicture.createFolder') }}</span>
            </button>
          </div>
        </div>
      </div>

      <div ref="carouselRef" class="bp-carousel" role="region" aria-label="Instances Shelf">
        <div
          v-for="(inst, idx) in displayInstances"
          :id="'bp-card-' + idx"
          :key="inst.path"
          class="bp-card"
          :class="{
            'selected': inst.path === selectedPath,
            'is-running': isRunning(inst.path),
            'is-launching': isLaunching(inst.path),
          }"
          role="button"
          tabindex="0"
          data-gamepad-focusable
          :aria-label="inst.name || 'Instance'"
          @click="selectInstance(inst.path)"
          @keydown.enter.prevent="onCardEnter(inst.path)"
          @keydown.space.prevent="selectInstance(inst.path)"
          @focus="selectInstance(inst.path)"
        >
          <div class="bp-card-image-wrap">
            <img
              :src="getCardIcon(inst)"
              class="bp-card-image"
              alt="Icon"
              loading="lazy"
            >
            <div v-if="isRunning(inst.path)" class="bp-card-status-badge bp-card-status-badge--running">
              <span class="bp-status-pulse-dot" />
              <span>{{ t('bigPicture.running') }}</span>
            </div>
            <div v-else-if="isLaunching(inst.path)" class="bp-card-status-badge bp-card-status-badge--launching">
              <v-icon size="11" class="animate-spin" color="white">sync</v-icon>
              <span>{{ t('bigPicture.launching') }}</span>
            </div>
          </div>
          <div class="bp-card-info">
            <div class="bp-card-name" :title="inst.name">
              {{ inst.name || 'Minecraft' }}
            </div>
            <div class="bp-card-meta flex items-center justify-between">
              <span v-if="inst.edition === 'bedrock'" class="text-primary font-bold">Bedrock</span>
              <span v-else>{{ inst.runtime.minecraft ? `MC ${inst.runtime.minecraft}` : 'Default' }}</span>
              <span
                v-if="getInstanceFolder(inst.path)"
                class="bp-card-folder-badge"
                :style="getInstanceFolder(inst.path)?.color ? { color: getInstanceFolder(inst.path)?.color } : {}"
                :title="getInstanceFolder(inst.path)?.name"
              >
                <v-icon size="11">folder</v-icon>
                <span>{{ getInstanceFolder(inst.path)?.name }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Add Instance Card -->
        <div
          class="bp-card bp-card--add"
          role="button"
          tabindex="0"
          data-gamepad-focusable
          :aria-label="t('bigPicture.addInstance')"
          @click="openAddInstance()"
          @keydown.enter.prevent="openAddInstance()"
          @keydown.space.prevent="openAddInstance()"
        >
          <div class="bp-card--add-icon">
            <v-icon size="28">add</v-icon>
          </div>
          <div class="bp-card--add-label">
            {{ t('bigPicture.addInstance') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Drawers & Dialogs -->
    <BigPictureModsDrawer
      v-model="modsDrawer"
      @browse-market="$emit('browse-market', 'mod')"
    />
    <BigPictureShadersDrawer
      v-model="shadersDrawer"
      @browse-market="$emit('browse-market', 'shader')"
    />
    <BigPictureSavesDrawer
      v-model="savesDrawer"
      @browse-market="$emit('browse-market', 'datapack')"
    />
    <BigPictureBlueprintsDrawer
      v-model="blueprintsDrawer"
      @browse-market="$emit('browse-market', 'blueprint')"
    />
    <BigPictureBackgroundDialog
      v-model="backgroundDialog"
      :instance-path="selectedPath"
      :instance-name="heroName"
      @change="onBgConfigChange"
    />
    <BigPictureInstanceSettingsDialog
      v-model="instanceSettingsDialog"
      :instance-name="heroName"
    />
    <BigPictureAddInstanceDialog
      v-model="addInstanceDialog"
    />

    <!-- Create Folder Dialog -->
    <v-dialog v-model="createFolderDialog" max-width="480">
      <div class="bp-subpage-card !m-0 !p-6 flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <v-icon color="primary" size="24">create_new_folder</v-icon>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white">{{ t('bigPicture.createFolder') }}</h3>
            <div class="text-xs text-white/50">{{ t('bigPicture.folderName') }}</div>
          </div>
        </div>

        <v-text-field
          v-model="newFolderName"
          :placeholder="t('bigPicture.folderName')"
          variant="outlined"
          density="comfortable"
          rounded="lg"
          autofocus
          hide-details
          class="bg-white/5"
          data-gamepad-focusable
          @keydown.enter="onConfirmCreateFolder"
        />

        <div class="flex flex-col gap-2">
          <span class="text-xs font-semibold text-white/70">{{ t('bigPicture.folderColor') }}</span>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              v-for="color in folderColorPresets"
              :key="color"
              type="button"
              class="w-8 h-8 rounded-full border-2 transition-transform cursor-pointer"
              :class="newFolderColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'"
              :style="{ backgroundColor: color }"
              data-gamepad-focusable
              @click="newFolderColor = color"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-white/10 mt-2">
          <button
            type="button"
            class="bp-sec-btn !px-5 !py-2.5 text-sm"
            data-gamepad-focusable
            @click="createFolderDialog = false"
          >
            <span v-if="gamepadConnected" class="bp-glyph bp-glyph--b">{{ buttonBLabel }}</span>
            <span>{{ t('shared.cancel') }}</span>
          </button>
          <button
            type="button"
            class="bp-play-btn !px-6 !py-2.5 text-sm font-bold"
            :disabled="!newFolderName.trim()"
            data-gamepad-focusable
            @click="onConfirmCreateFolder"
          >
            <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
            <span>{{ t('create') }}</span>
          </button>
        </div>
      </div>
    </v-dialog>

    <!-- Delete Instance Confirmation Dialog -->
    <v-dialog v-model="deleteConfirmDialog" max-width="480">
      <div class="bp-subpage-card !m-0 !p-6 flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <v-icon color="error" size="24">delete_forever</v-icon>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white">{{ t('instance.delete') }}</h3>
            <div class="text-xs text-white/50">{{ heroName }}</div>
          </div>
        </div>
        <p class="text-sm text-white/70">
          {{ isBedrockInstance ? t('instance.deleteHintBedrock') : t('instance.deleteHint') }}
        </p>
        <div class="bg-white/5 p-3 rounded-xl border border-white/10">
          <div class="font-bold text-white">{{ heroName }}</div>
          <div class="text-xs text-white/40 font-mono truncate">{{ selectedPath }}</div>
        </div>
        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            class="bp-sec-btn !px-5 !py-2.5"
            data-gamepad-focusable
            @click="deleteConfirmDialog = false"
          >
            <span v-if="gamepadConnected" class="bp-glyph bp-glyph--b">{{ buttonBLabel }}</span>
            <span>{{ t('shared.cancel') }}</span>
          </button>
          <button
            type="button"
            class="bp-play-btn !bg-red-600 hover:!bg-red-500 !px-6 !py-2.5 font-bold"
            data-gamepad-focusable
            @click="confirmDeleteInstance"
          >
            <span v-if="gamepadConnected" class="bp-glyph bp-glyph--a">{{ buttonALabel }}</span>
            <v-icon size="18">delete</v-icon>
            <span>{{ t('delete.yes') }}</span>
          </button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BigPictureModsDrawer from './BigPictureModsDrawer.vue'
import BigPictureShadersDrawer from './BigPictureShadersDrawer.vue'
import BigPictureSavesDrawer from './BigPictureSavesDrawer.vue'
import BigPictureBlueprintsDrawer from './BigPictureBlueprintsDrawer.vue'
import BigPictureBackgroundDialog, { type BigPictureBgConfig } from './BigPictureBackgroundDialog.vue'
import BigPictureInstanceSettingsDialog from './BigPictureInstanceSettingsDialog.vue'
import BigPictureAddInstanceDialog from './BigPictureAddInstanceDialog.vue'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { kInstanceTheme } from '@/composables/instanceTheme'
import { kInstanceLaunchCoordinator } from '@/composables/instanceLaunchCoordinator'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { useInstanceScreenshots } from '@/composables/screenshot'
import { useHasMinecraftLicense } from '@/composables/minecraftLicense'
import { useNotifier } from '@/composables/notifier'
import { kLaunchButton } from '@/composables/launchButton'
import { useDialog } from '@/composables/dialog'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { useGamepad } from '@/composables/gamepad'
import { useInstanceGroup, useInstanceGroupOps } from '@/composables/instanceGroup'
import { useService } from '@/composables/service'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { BuiltinImages } from '@/constant'
import { BaseServiceKey, LaunchServiceKey, BedrockServiceKey, InstanceServiceKey, type BedrockInstallation } from '@xmcl/runtime-api'
import type { Instance } from '@xmcl/instance'

const emit = defineEmits<{
  (e: 'browse-market', category?: string): void
}>()

const modsDrawer = ref(false)
const shadersDrawer = ref(false)
const savesDrawer = ref(false)
const blueprintsDrawer = ref(false)
const backgroundDialog = ref(false)
const instanceSettingsDialog = ref(false)

const { t } = useI18n()
const router = useRouter()
const { notify } = useNotifier()
const { hasMinecraftLicense } = useHasMinecraftLicense()
const {
  isSupported: isBedrockSupported,
  getInstallation: getBedrockInstallation,
  install: installBedrockService,
} = useService(BedrockServiceKey)

const bedrockSupported = ref(false)
const bedrockInstallation = ref<BedrockInstallation>({
  installed: false,
  version: '',
  packageFullName: '',
  aumid: '',
})
const bedrockInstalling = ref(false)

async function refreshBedrockStatus() {
  bedrockSupported.value = await isBedrockSupported().catch(() => false)
  if (bedrockSupported.value) {
    bedrockInstallation.value = await getBedrockInstallation().catch(() => ({
      installed: false,
      version: '',
      packageFullName: '',
      aumid: '',
    }))
  }
}

onMounted(() => {
  refreshBedrockStatus()
})

const { instances } = injection(kInstances)
const { path: selectedPath, select } = injection(kInstance)
const { isLaunching, isRunning } = injection(kInstanceLaunchCoordinator)
const { onClick: onLaunchClick } = injection(kLaunchButton)
const { kill: killJavaLaunch, abort: abortJavaLaunch } = injection(kInstanceLaunch)
const { getGameProcesses, kill: killProcess } = useService(LaunchServiceKey)
const { killGame: killBedrockGame } = useService(BedrockServiceKey)

const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonALabel = gamepad.buttonA
const buttonBLabel = gamepad.buttonB
const buttonXLabel = gamepad.buttonX
const buttonYLabel = gamepad.buttonY

const addInstanceDialog = ref(false)
const openAddInstance = () => { addInstanceDialog.value = true }
const { openDirectory } = useService(BaseServiceKey)

const currentInstance = computed(() => instances.value.find((i) => i.path === selectedPath.value))

const heroName = computed(() => {
  if (!currentInstance.value) return ''
  return currentInstance.value.name || `Minecraft ${currentInstance.value.runtime.minecraft || ''}`
})

const heroFavicon = computed(() => {
  if (!currentInstance.value) return ''
  return getInstanceIcon(currentInstance.value, undefined)
})

const { instanceTheme } = injection(kInstanceTheme)
const { urls: screenshotUrls } = useInstanceScreenshots(selectedPath)

function getBgConfig(path: string): BigPictureBgConfig {
  if (!path) return { mode: 'auto' }
  try {
    const raw = localStorage.getItem(`xmcl:bp:bg:${path}`)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { mode: 'auto' }
}

const bgConfig = ref<BigPictureBgConfig>(getBgConfig(selectedPath.value))

watch(selectedPath, (newPath) => {
  bgConfig.value = getBgConfig(newPath)
})

function onBgConfigChange(newConfig: BigPictureBgConfig) {
  bgConfig.value = newConfig
}

// Screenshot slideshow cycling
const currentScreenshotIndex = ref(0)
let slideshowTimer: ReturnType<typeof setInterval> | null = null

function startSlideshow() {
  stopSlideshow()
  if (screenshotUrls.value.length > 1) {
    slideshowTimer = setInterval(() => {
      currentScreenshotIndex.value = (currentScreenshotIndex.value + 1) % screenshotUrls.value.length
    }, 8000)
  }
}

function stopSlideshow() {
  if (slideshowTimer) {
    clearInterval(slideshowTimer)
    slideshowTimer = null
  }
}

watch(screenshotUrls, () => {
  currentScreenshotIndex.value = 0
  startSlideshow()
}, { immediate: true })

onUnmounted(() => {
  stopSlideshow()
})

const activeScreenshotUrl = computed(() => {
  if (bgConfig.value.selectedScreenshot) {
    return bgConfig.value.selectedScreenshot
  }
  if (screenshotUrls.value.length > 0) {
    return screenshotUrls.value[currentScreenshotIndex.value % screenshotUrls.value.length]
  }
  return ''
})

const backdropUrl = computed(() => {
  const mode = bgConfig.value.mode || 'auto'
  const customBg = instanceTheme.value?.backgroundImage?.url || instanceTheme.value?.backgroundImageDark?.url

  if (mode === 'custom' && bgConfig.value.customUrl) {
    return bgConfig.value.customUrl
  }
  if (mode === 'screenshots') {
    return activeScreenshotUrl.value || heroFavicon.value || ''
  }
  if (mode === 'icon') {
    return heroFavicon.value || ''
  }
  if (mode === 'theme') {
    return customBg || heroFavicon.value || ''
  }

  // mode === 'auto'
  if (customBg) return customBg
  if (activeScreenshotUrl.value) return activeScreenshotUrl.value
  return heroFavicon.value || ''
})

const isIconBackdrop = computed(() => {
  const mode = bgConfig.value.mode || 'auto'
  if (mode === 'icon') return true
  if (mode === 'custom' && bgConfig.value.customUrl) return false
  if (mode === 'screenshots' && activeScreenshotUrl.value) return false
  if (mode === 'theme') {
    const customBg = instanceTheme.value?.backgroundImage?.url || instanceTheme.value?.backgroundImageDark?.url
    return !customBg && !!heroFavicon.value
  }
  // mode === 'auto'
  const customBg = instanceTheme.value?.backgroundImage?.url || instanceTheme.value?.backgroundImageDark?.url
  return !customBg && !activeScreenshotUrl.value && !!heroFavicon.value
})

function getCardIcon(inst: Instance) {
  return getInstanceIcon(inst, undefined)
}

const modLoaderBadge = computed(() => {
  const rt = currentInstance.value?.runtime
  if (!rt) return ''
  if (rt.fabricLoader) return `Fabric ${rt.fabricLoader}`
  if (rt.neoForged) return `NeoForge ${rt.neoForged}`
  if (rt.forge) return `Forge ${rt.forge}`
  if (rt.quiltLoader) return `Quilt ${rt.quiltLoader}`
  if (rt.optifine) return `OptiFine ${rt.optifine}`
  if (rt.labyMod) return `LabyMod ${rt.labyMod}`
  return ''
})

const modLoaderImage = computed(() => {
  const rt = currentInstance.value?.runtime
  if (!rt) return undefined
  if (rt.fabricLoader) return BuiltinImages.fabric
  if (rt.neoForged) return BuiltinImages.neoForged
  if (rt.forge) return BuiltinImages.forge
  if (rt.quiltLoader) return BuiltinImages.quilt
  if (rt.optifine) return BuiltinImages.optifine
  if (rt.labyMod) return BuiltinImages.labyMod
  return undefined
})

const deleteConfirmDialog = ref(false)
const { deleteInstance } = useService(InstanceServiceKey)

async function confirmDeleteInstance() {
  if (!selectedPath.value) return
  const pathToDelete = selectedPath.value
  deleteConfirmDialog.value = false
  try {
    await deleteInstance(pathToDelete)
    notify({ level: 'success', title: t('instance.delete') + ' successful' })
    const remaining = instances.value.filter((i) => i.path !== pathToDelete)
    if (remaining.length > 0) {
      select(remaining[0].path)
    }
  } catch (e: any) {
    notify({ level: 'error', title: 'Failed to delete instance', body: e.message })
  }
}

const playButtonText = computed(() => {
  if (!currentInstance.value) return t('bigPicture.play')
  if (isLaunching(currentInstance.value.path)) return t('bigPicture.launching')
  if (isRunning(currentInstance.value.path)) return t('bigPicture.running')
  return t('bigPicture.play')
})

function formatPlaytime(ms: number) {
  if (!ms || ms <= 0) return ''
  const totalMinutes = Math.floor(ms / (60 * 1000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function selectInstance(path: string) {
  if (selectedPath.value !== path) {
    select(path)
  }
}

function onPlayClick() {
  onLaunchClick()
}

async function onStopGame(force = false) {
  if (!currentInstance.value) return
  const targetPath = currentInstance.value.path
  try {
    if (currentInstance.value.edition === 'bedrock') {
      await killBedrockGame()
    } else {
      const processes = await getGameProcesses().catch(() => [])
      const matched = processes.filter((p) => p.options.gameDirectory === targetPath)
      if (matched.length > 0) {
        for (const p of matched) {
          await killProcess(p.pid, force).catch(() => {})
        }
      } else {
        await killJavaLaunch('client', force).catch(() => {})
      }
      if (force) {
        abortJavaLaunch()
      }
    }
    notify({
      level: force ? 'warning' : 'info',
      title: force ? t('bigPicture.gameKilled') : t('bigPicture.gameStopped'),
      body: force ? t('bigPicture.gameKilledBody') : undefined,
    })
  } catch (err: any) {
    notify({ level: 'error', title: 'Error stopping game', body: err?.message })
  }
}

function onCancelLaunch() {
  abortJavaLaunch()
  notify({
    level: 'info',
    title: t('launch.cancel'),
  })
}

function onCardEnter(path: string) {
  if (selectedPath.value === path) {
    onPlayClick()
  } else {
    select(path)
  }
}

const isBedrockInstance = computed(() => currentInstance.value?.edition === 'bedrock')

async function onInstallBedrock() {
  bedrockInstalling.value = true
  try {
    await installBedrockService()
    await refreshBedrockStatus()
  } catch (e: any) {
    notify({ level: 'error', title: t('bedrock.installFailed'), body: e?.message })
  } finally {
    bedrockInstalling.value = false
  }
}

const { groups } = useInstanceGroup()
const { createGroup } = useInstanceGroupOps()

const createFolderDialog = ref(false)
const newFolderName = ref('')
const newFolderColor = ref('#2196F3')
const folderColorPresets = ['#2196F3', '#4CAF50', '#9C27B0', '#FF9800', '#E91E63', '#00BCD4', '#FF5722', '#607D8B']

function openCreateFolderDialog() {
  newFolderName.value = ''
  newFolderColor.value = '#2196F3'
  createFolderDialog.value = true
}

function onConfirmCreateFolder() {
  const name = newFolderName.value.trim()
  if (!name) return
  if (currentInstance.value) {
    createGroup(currentInstance.value.path, name, newFolderColor.value)
    notify({
      level: 'success',
      title: `${t('bigPicture.createFolder')}: ${name}`,
    })
  }
  createFolderDialog.value = false
  newFolderName.value = ''
}

interface FolderTab {
  id: string
  name: string
  icon: string
  color?: string
  count: number
  instancePaths?: string[]
}

const folderTabs = computed<FolderTab[]>(() => {
  const allList = instances.value.filter((i) => (i.edition === 'bedrock' ? hasMinecraftLicense.value : true))
  const groupsList = groups.value || []

  const namedFolders: FolderTab[] = []
  const groupedPaths = new Set<string>()

  let folderIdx = 1
  for (const g of groupsList) {
    if (typeof g !== 'string') {
      const paths = g.instances.filter((p) => allList.some((inst) => inst.path === p))
      for (const p of paths) groupedPaths.add(p)
      const folderName = g.name?.trim() ? g.name : `${t('bigPicture.folder')} ${folderIdx++}`
      namedFolders.push({
        id: g.id,
        name: folderName,
        icon: 'folder',
        color: g.color || undefined,
        count: paths.length,
        instancePaths: paths,
      })
    }
  }

  if (namedFolders.length === 0) {
    return []
  }

  const tabs: FolderTab[] = [
    {
      id: 'all',
      name: t('bigPicture.allInstances'),
      icon: 'apps',
      count: allList.length,
    },
    ...namedFolders,
  ]

  const ungrouped = allList.filter((i) => !groupedPaths.has(i.path))
  if (ungrouped.length > 0) {
    tabs.push({
      id: 'ungrouped',
      name: t('bigPicture.ungrouped'),
      icon: 'folder_open',
      count: ungrouped.length,
      instancePaths: ungrouped.map((i) => i.path),
    })
  }

  return tabs
})

const selectedFolderId = ref('all')

function selectFolder(id: string) {
  selectedFolderId.value = id
  nextTick(() => {
    const filtered = displayInstances.value
    if (filtered.length > 0 && !filtered.some((i) => i.path === selectedPath.value)) {
      select(filtered[0].path)
    }
  })
}

const displayInstances = computed(() => {
  const base = instances.value.filter((i) => {
    if (i.edition === 'bedrock') {
      return hasMinecraftLicense.value
    }
    return true
  })

  if (selectedFolderId.value === 'all') {
    return base
  }

  const activeTab = folderTabs.value.find((f) => f.id === selectedFolderId.value)
  if (!activeTab || !activeTab.instancePaths) {
    return base
  }

  const allowed = new Set(activeTab.instancePaths)
  return base.filter((i) => allowed.has(i.path))
})

function getInstanceFolder(path: string) {
  const groupsList = groups.value || []
  let folderIdx = 1
  for (const g of groupsList) {
    if (typeof g !== 'string') {
      const folderName = g.name?.trim() ? g.name : `${t('bigPicture.folder')} ${folderIdx++}`
      if (g.instances.includes(path)) {
        return {
          name: folderName,
          color: g.color || undefined,
        }
      }
    }
  }
  return null
}

const currentInstanceFolder = computed(() => {
  if (!selectedPath.value) return null
  return getInstanceFolder(selectedPath.value)
})

function onOpenSettings() {
  instanceSettingsDialog.value = true
}

function onOpenFolder() {
  if (currentInstance.value?.path) {
    openDirectory(currentInstance.value.path)
  }
}

const carouselRef = ref<HTMLElement | null>(null)

// Auto-scroll selected card into view
watch(selectedPath, (newPath) => {
  if (currentInstance.value?.edition === 'bedrock') {
    refreshBedrockStatus()
  }
  if (!newPath || !carouselRef.value) return
  const idx = displayInstances.value.findIndex((i) => i.path === newPath)
  if (idx >= 0) {
    nextTick(() => {
      const card = document.getElementById('bp-card-' + idx)
      card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    })
  }
})
</script>
