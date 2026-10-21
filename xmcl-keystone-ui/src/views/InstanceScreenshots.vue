<template>
  <div
    class="instance-screenshots flex flex-col flex-1 relative overflow-y-auto visible-scroll px-6 py-4 select-none"
  >
    <!-- Drag & Drop overlay -->
    <transition name="fade-transition">
      <div
        v-if="dragover"
        class="absolute inset-0 z-50 bg-primary/20 backdrop-blur-sm border-2 border-dashed border-primary rounded-2xl flex flex-col items-center justify-center m-4 pointer-events-none"
      >
        <v-icon size="64" color="primary" class="animate-bounce mb-3">add_photo_alternate</v-icon>
        <span class="text-lg font-bold text-white">{{ t('screenshots.dropHint') }}</span>
      </div>
    </transition>

    <!-- Selection Action Bar (appears when items are selected) -->
    <transition name="slide-y-transition">
      <div
        v-if="selectedUrls.size > 0"
        class="sticky top-0 z-30 mb-4 px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 bg-surface-variant/90 backdrop-blur-md border border-white/10 shadow-lg"
      >
        <div class="flex items-center gap-3">
          <v-chip size="small" color="primary" variant="flat" class="font-bold">
            {{ t('screenshots.selectedCount', { count: selectedUrls.size }) }}
          </v-chip>
          <v-btn
            size="small"
            variant="text"
            @click="selectAll"
          >
            {{ t('screenshots.selectAll') }}
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            @click="clearSelection"
          >
            {{ t('screenshots.clearSelection') }}
          </v-btn>
        </div>

        <div class="flex items-center gap-2">
          <v-btn
            v-if="selectedUrls.size === 1"
            size="small"
            variant="tonal"
            prepend-icon="content_copy"
            @click="onCopySelectedSingle"
          >
            {{ t('screenshots.copy') }}
          </v-btn>
          <v-btn
            v-if="selectedUrls.size === 1"
            size="small"
            variant="tonal"
            prepend-icon="wallpaper"
            @click="onSetWallpaperSelectedSingle"
          >
            {{ t('screenshots.setWallpaper') }}
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="save_alt"
            @click="onExportSelected"
          >
            {{ t('screenshots.exportSelected') }}
          </v-btn>
          <v-btn
            size="small"
            variant="tonal"
            color="red"
            prepend-icon="delete"
            @click="showDeleteConfirm = true"
          >
            {{ t('shared.delete') }}
          </v-btn>
        </div>
      </div>
    </transition>

    <!-- Empty State -->
    <div
      v-if="!refreshing && items.length === 0"
      class="flex flex-col items-center justify-center flex-1 py-16 gap-4 text-center"
    >
      <div class="w-20 h-20 rounded-full flex items-center justify-center bg-surface-variant/40 border border-white/5">
        <v-icon size="40" color="primary">photo_camera</v-icon>
      </div>
      <div>
        <div class="text-xl font-bold text-white/90 mb-1">
          {{ t('screenshots.emptyTitle') }}
        </div>
        <div class="text-sm text-white/50 max-w-md">
          {{ t('screenshots.emptyDescription') }}
        </div>
      </div>
      <div class="flex items-center gap-3 mt-2">
        <v-btn
          color="primary"
          variant="elevated"
          prepend-icon="add_photo_alternate"
          @click="onPickImport"
        >
          {{ t('screenshots.import') }}
        </v-btn>
        <v-btn
          variant="tonal"
          prepend-icon="folder_open"
          @click="onOpenFolder"
        >
          {{ t('screenshots.openFolder') }}
        </v-btn>
      </div>
    </div>

    <!-- No results after filtering -->
    <div
      v-else-if="filteredItems.length === 0"
      class="flex flex-col items-center justify-center flex-1 py-16 text-center text-white/50"
    >
      <v-icon size="48" class="mb-2 opacity-50">search_off</v-icon>
      <div class="text-base font-semibold">{{ t('screenshots.noSearchResults') }}</div>
      <div class="text-xs opacity-60">{{ t('screenshots.noSearchResultsHint') }}</div>
    </div>

    <!-- Gallery Grid View -->
    <div
      v-else-if="viewMode === 'grid' || viewMode === 'gridCompact'"
      class="grid gap-4"
      :class="{
        'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5': viewMode === 'grid',
        'grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6': viewMode === 'gridCompact',
      }"
    >
      <v-card
        v-for="(item, index) in filteredItems"
        :key="item.path"
        class="screenshot-card group relative flex flex-col rounded-xl overflow-hidden border border-white/5 transition-all duration-200 hover:border-primary/50 hover:shadow-xl"
        :class="{ 'ring-2 ring-primary': selectedUrls.has(item.url) }"
        @click="openPreview(index)"
      >
        <!-- Thumbnail image -->
        <div class="relative w-full aspect-video bg-black/40 overflow-hidden">
          <v-img
            :src="item.url"
            aspect-ratio="1.777"
            cover
            class="w-full h-full transition-transform duration-300 group-hover:scale-105"
          >
            <template #placeholder>
              <div class="w-full h-full flex items-center justify-center bg-surface-variant/20">
                <v-progress-circular indeterminate size="24" color="primary" />
              </div>
            </template>
          </v-img>

          <!-- Checkbox overlay (top-left) -->
          <div
            class="absolute top-2 left-2 z-10"
            @click.stop="toggleSelect(item.url)"
          >
            <div
              class="w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer"
              :class="selectedUrls.has(item.url) ? 'bg-primary text-black' : 'bg-black/50 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/70'"
            >
              <v-icon size="16">{{ selectedUrls.has(item.url) ? 'check' : 'check_box_outline_blank' }}</v-icon>
            </div>
          </div>

          <!-- Hover Action Overlay (top-right quick buttons) -->
          <div
            class="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm rounded-lg p-0.5"
            @click.stop
          >
            <v-btn
              v-if="!isGif(item)"
              icon="brush"
              variant="text"
              size="x-small"
              color="white"
              v-shared-tooltip="() => t('screenshots.edit')"
              @click.stop="onEditItem(item)"
            />
            <v-btn
              icon="content_copy"
              variant="text"
              size="x-small"
              color="white"
              v-shared-tooltip="() => t('screenshots.copy')"
              @click.stop="onCopyItem(item)"
            />
            <v-menu location="bottom end">
              <template #activator="{ props: menuProps }">
                <v-btn
                  v-bind="menuProps"
                  icon="more_vert"
                  variant="text"
                  size="x-small"
                  color="white"
                />
              </template>
              <v-list density="compact" class="rounded-xl">
                <v-list-item
                  v-if="!isGif(item)"
                  prepend-icon="brush"
                  :title="t('screenshots.edit')"
                  @click="onEditItem(item)"
                />
                <v-list-item
                  prepend-icon="wallpaper"
                  :title="t('screenshots.setWallpaper')"
                  @click="onSetWallpaperItem(item)"
                />
                <v-list-item
                  prepend-icon="folder_open"
                  :title="t('screenshots.openFolder')"
                  @click="show(item.url)"
                />
                <v-list-item
                  prepend-icon="save_alt"
                  :title="t('screenshots.export')"
                  @click="onExportSingle(item)"
                />
                <v-divider class="my-1" />
                <v-list-item
                  prepend-icon="delete"
                  color="red"
                  :title="t('shared.delete')"
                  @click="onDeleteItem(item)"
                />
              </v-list>
            </v-menu>
          </div>
        </div>

        <!-- Card bottom info -->
        <div class="p-2.5 flex flex-col gap-1 bg-surface-variant/20">
          <div class="text-xs font-semibold text-white/90 truncate" :title="item.name">
            {{ item.name }}
          </div>
          <div class="flex items-center justify-between text-[11px] text-white/50">
            <span>{{ getDateString(item.createdAt) }}</span>
            <span>{{ getExpectedSize(item.size) }}</span>
          </div>
        </div>
      </v-card>
    </div>

    <!-- Detail List View -->
    <div
      v-else-if="viewMode === 'list'"
      class="flex flex-col gap-2"
    >
      <div
        v-for="(item, index) in filteredItems"
        :key="item.path"
        class="flex items-center justify-between gap-4 p-2.5 rounded-xl border border-white/5 bg-surface-variant/20 hover:border-primary/40 hover:bg-surface-variant/30 transition-all cursor-pointer"
        :class="{ 'ring-1 ring-primary bg-primary/5': selectedUrls.has(item.url) }"
        @click="openPreview(index)"
      >
        <div class="flex items-center gap-3 min-w-0 flex-grow">
          <div
            class="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 cursor-pointer"
            :class="selectedUrls.has(item.url) ? 'bg-primary text-black' : 'bg-surface-variant text-white/60 hover:text-white'"
            @click.stop="toggleSelect(item.url)"
          >
            <v-icon size="16">{{ selectedUrls.has(item.url) ? 'check' : 'check_box_outline_blank' }}</v-icon>
          </div>

          <div class="w-16 h-10 rounded overflow-hidden flex-shrink-0 bg-black/40">
            <v-img :src="item.url" aspect-ratio="1.6" cover class="w-full h-full" />
          </div>

          <div class="flex flex-col min-w-0">
            <span class="text-sm font-semibold text-white/90 truncate">{{ item.name }}</span>
            <span class="text-xs text-white/50">{{ getDateString(item.createdAt) }}</span>
          </div>
        </div>

        <div class="flex items-center gap-4 flex-shrink-0" @click.stop>
          <span class="text-xs font-mono text-white/60">{{ getExpectedSize(item.size) }}</span>

          <v-btn
            v-if="!isGif(item)"
            icon="brush"
            variant="text"
            size="small"
            v-shared-tooltip="() => t('screenshots.edit')"
            @click.stop="onEditItem(item)"
          />
          <v-btn
            icon="content_copy"
            variant="text"
            size="small"
            v-shared-tooltip="() => t('screenshots.copy')"
            @click.stop="onCopyItem(item)"
          />
          <v-btn
            icon="wallpaper"
            variant="text"
            size="small"
            v-shared-tooltip="() => t('screenshots.setWallpaper')"
            @click.stop="onSetWallpaperItem(item)"
          />
          <v-btn
            icon="folder_open"
            variant="text"
            size="small"
            v-shared-tooltip="() => t('screenshots.openFolder')"
            @click.stop="show(item.url)"
          />
          <v-btn
            icon="delete"
            variant="text"
            size="small"
            color="red"
            v-shared-tooltip="() => t('shared.delete')"
            @click.stop="onDeleteItem(item)"
          />
        </div>
      </div>
    </div>

    <!-- Lightbox Modal -->
    <ScreenshotLightbox
      v-model="isPreviewOpen"
      :items="filteredItems"
      :initial-index="activePreviewIndex"
      @edit="onEditItem"
      @copy="onCopyItem"
      @set-wallpaper="onSetWallpaperItem"
      @show-in-folder="(i) => show(i.url)"
      @export="onExportSingle"
      @delete="onDeleteItem"
    />

    <!-- Screenshot Editor Modal -->
    <ScreenshotEditorModal
      v-model="editorShown"
      :screenshot="editingItem"
      @save="onSaveEdited"
    />

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteConfirm" max-width="440">
      <v-card class="rounded-xl">
        <v-card-title class="flex items-center gap-2">
          <v-icon color="red">delete</v-icon>
          {{ t('screenshots.deleteConfirmTitle') }}
        </v-card-title>
        <v-card-text>
          {{ t('screenshots.deleteConfirmMessage', { count: itemToDelete ? 1 : selectedUrls.size }) }}
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="showDeleteConfirm = false">
            {{ t('shared.cancel') }}
          </v-btn>
          <v-btn color="red" variant="elevated" @click="confirmDelete">
            {{ t('shared.delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ScreenshotItem, BaseServiceKey, ThemeServiceKey, InstanceThemeServiceKey } from '@xmcl/runtime-api'
import { kInstance } from '@/composables/instance'
import { kTheme, BackgroundType } from '@/composables/theme'
import { kInstanceTheme } from '@/composables/instanceTheme'
import { useNotifier } from '@/composables/notifier'
import { useScreenshotManagerContext } from '@/composables/screenshotManager'
import { getExpectedSize } from '@/util/size'
import { useDateString } from '@/composables/date'
import { useService } from '@/composables/service'
import { injection } from '@/util/inject'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getDropFilePaths, useGlobalDrop } from '@/composables/dropHandler'
import ScreenshotLightbox from '@/components/ScreenshotLightbox.vue'
import ScreenshotEditorModal from '@/components/ScreenshotEditorModal.vue'
import { inject, ref } from 'vue'

const { path: instancePath } = injection(kInstance)
const { t } = useI18n()
const { getDateString } = useDateString()
const { openDirectory } = useService(BaseServiceKey)
const themeCtx = inject(kTheme, undefined)
const instanceThemeCtx = inject(kInstanceTheme, undefined)
const themeService = useService(ThemeServiceKey)
const instanceThemeService = useService(InstanceThemeServiceKey)
const { notify } = useNotifier()

const {
  items,
  filteredItems,
  search,
  sort,
  viewMode,
  selectedUrls,
  activePreviewIndex,
  isPreviewOpen,
  totalSize,
  refreshing,
  refresh,
  toggleSelect,
  selectAll,
  clearSelection,
  remove,
  removeMany,
  show,
  copyImage,
  importFiles,
  saveAsFile,
  saveEdited,
  openPreview,
  closePreview,
} = useScreenshotManagerContext()

// Drop handler
const { dragover } = useGlobalDrop({
  onDrop: async (dataTransfer) => {
    const paths = getDropFilePaths(dataTransfer.files)
    if (paths.length > 0) {
      await importFiles(paths)
    }
  },
})

// Picking files to import
async function onPickImport() {
  const result = await windowController.showOpenDialog({
    title: t('screenshots.import'),
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: t('screenshots.images'),
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'],
      },
    ],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    await importFiles(result.filePaths)
  }
}

function onOpenFolder() {
  const screenshotsPath = `${instancePath.value}/screenshots`
  openDirectory(screenshotsPath)
}

// Editor state
const editorShown = ref(false)
const editingItem = ref<ScreenshotItem | null>(null)

function isGif(item?: ScreenshotItem | null): boolean {
  if (!item) return false
  const target = item.name || item.path || item.url || ''
  return /\.gif(\?.*)?$/i.test(target)
}

function onEditItem(item: ScreenshotItem) {
  if (isGif(item)) return
  editingItem.value = item
  editorShown.value = true
}

async function onSaveEdited({
  dataUrl,
  originalUrl,
  saveAsCopy,
}: {
  dataUrl: string
  originalUrl?: string
  saveAsCopy: boolean
}) {
  try {
    await saveEdited(dataUrl, originalUrl, saveAsCopy)
    editorShown.value = false
  } catch (e) {
    // Silent on error or log
    console.error(e)
  }
}

// Single actions
function onCopyItem(item: ScreenshotItem) {
  copyImage(item.url)
}

async function applyScreenshotAsBackground(itemOrUrl: ScreenshotItem | string) {
  let filePath = typeof itemOrUrl === 'string' ? itemOrUrl : itemOrUrl.path
  if (!filePath || filePath.startsWith('http')) {
    const urlStr = typeof itemOrUrl === 'string' ? itemOrUrl : itemOrUrl.url
    try {
      const parsed = new URL(urlStr)
      filePath = parsed.searchParams.get('path') || filePath
    } catch {
      // ignore
    }
  }

  if (!filePath) {
    notify({ level: 'error', title: t('setting.setAsBackground.failed') })
    return
  }

  try {
    const isDark = themeCtx?.isDark.value ?? true
    const imageKey: 'backgroundImageDark' | 'backgroundImage' = isDark
      ? 'backgroundImageDark'
      : 'backgroundImage'

    let applied = false

    // 1. Apply to global theme so the entire launcher reflects the new background
    if (themeCtx && themeService) {
      const targetTheme = themeCtx.currentTheme.value
      if (targetTheme) {
        const media = await themeService.addMedia(filePath)
        if (media && media.type === 'image') {
          const old = targetTheme[imageKey]
          if (old && old.url.startsWith('http://launcher/') && old.url !== media.url) {
            themeService.removeMedia(old.url).catch(() => {})
          }
          targetTheme[imageKey] = media
          if (!targetTheme.backgroundImage) {
            targetTheme.backgroundImage = media
          }
          targetTheme.backgroundType = BackgroundType.IMAGE
          await themeCtx.saveCurrentTheme()
          applied = true
        }
      }
    }

    // 2. If instance theme is active, also apply directly to instance theme
    if (instancePath.value && instanceThemeCtx?.instanceTheme.value && instanceThemeService) {
      const targetTheme = instanceThemeCtx.instanceTheme.value
      const media = await instanceThemeService.addMedia(instancePath.value, filePath)
      if (media && media.type === 'image') {
        const old = targetTheme[imageKey]
        if (old && old.url.startsWith('http://launcher/') && old.url !== media.url) {
          instanceThemeService.removeMedia(instancePath.value, old.url).catch(() => {})
        }
        targetTheme[imageKey] = media
        if (!targetTheme.backgroundImage) {
          targetTheme.backgroundImage = media
        }
        targetTheme.backgroundType = BackgroundType.IMAGE
        await instanceThemeCtx.saveTheme()
        applied = true
      }
    }

    if (applied) {
      notify({
        level: 'success',
        title: t('screenshots.setWallpaperSuccess') || t('setting.setAsBackground.successGlobal'),
      })
    } else {
      notify({
        level: 'error',
        title: t('setting.setAsBackground.failed'),
      })
    }
  } catch (err) {
    console.error('Failed to set screenshot as wallpaper:', err)
    notify({
      level: 'error',
      title: t('setting.setAsBackground.failed'),
    })
  }
}

async function onSetWallpaperItem(item: ScreenshotItem) {
  await applyScreenshotAsBackground(item)
}

async function onExportSingle(item: ScreenshotItem) {
  const saveResult = await windowController.showSaveDialog({
    title: t('screenshots.export'),
    defaultPath: item.name,
    filters: [
      {
        name: t('screenshots.images'),
        extensions: ['png', 'jpg', 'jpeg'],
      },
    ],
  })
  if (!saveResult.canceled && saveResult.filePath) {
    await saveAsFile(item.url, saveResult.filePath)
  }
}

// Batch actions
function onCopySelectedSingle() {
  const firstUrl = Array.from(selectedUrls.value)[0]
  if (firstUrl) {
    copyImage(firstUrl)
  }
}

async function onSetWallpaperSelectedSingle() {
  const firstUrl = Array.from(selectedUrls.value)[0]
  if (firstUrl) {
    const item = items.value.find((i) => i.url === firstUrl)
    await applyScreenshotAsBackground(item || firstUrl)
  }
}

async function onExportSelected() {
  const dialogResult = await windowController.showOpenDialog({
    title: t('screenshots.exportSelectedTitle'),
    properties: ['openDirectory', 'createDirectory'],
  })
  if (!dialogResult.canceled && dialogResult.filePaths[0]) {
    const destDir = dialogResult.filePaths[0]
    const urls = Array.from(selectedUrls.value)
    for (const url of urls) {
      const item = items.value.find((i) => i.url === url)
      if (item) {
        const dest = `${destDir}/${item.name}`
        await saveAsFile(url, dest)
      }
    }
    clearSelection()
  }
}

// Delete handling
const showDeleteConfirm = ref(false)
const itemToDelete = ref<ScreenshotItem | null>(null)

function onDeleteItem(item: ScreenshotItem) {
  itemToDelete.value = item
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (itemToDelete.value) {
    await remove(itemToDelete.value.url)
    if (selectedUrls.value.has(itemToDelete.value.url)) {
      toggleSelect(itemToDelete.value.url)
    }
    itemToDelete.value = null
  } else if (selectedUrls.value.size > 0) {
    await removeMany(Array.from(selectedUrls.value))
    clearSelection()
  }
  showDeleteConfirm.value = false
  if (isPreviewOpen.value) {
    isPreviewOpen.value = false
  }
}
</script>

<style scoped>
.instance-screenshots {
  contain: content;
}
.screenshot-card {
  background: rgba(var(--v-theme-surface), 0.7);
  backdrop-filter: blur(12px);
  content-visibility: auto;
  contain-intrinsic-size: 240px 180px;
}
</style>
