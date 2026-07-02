<template>
  <div
    ref="root"
    class="save-world-map relative h-full w-full select-none overflow-hidden"
    @dblclick.prevent="zoomIn"
  >
    <canvas
      ref="canvas"
      class="block h-full w-full"
      data-testid="save-world-map-canvas"
      :style="{ cursor: cursorStyle }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @wheel.prevent="onWheel"
    />

    <!-- Top toolbar -->
    <div
      class="map-toolbar absolute left-3 top-3 flex items-center gap-2 rounded bg-[rgba(0,0,0,0.55)] px-2 py-1 backdrop-blur"
    >
      <v-select
        v-model="dimension"
        :items="dimensionItems"
        density="compact"
        hide-details
        variant="solo"
        class="dim-select"
        style="min-width: 160px"
      />
      <v-chip v-if="selectedCount > 0" size="small" color="primary">
        {{ t('save.chunkSelected', { count: selectedCount }) }}
      </v-chip>
      <v-btn
        :color="showGrid ? 'primary' : undefined"
        size="small"
        variant="flat"
        icon
        data-testid="save-world-map-grid-toggle"
        @click="toggleGrid"
      >
        <v-icon>grid_on</v-icon>
        <v-tooltip activator="parent" location="bottom">{{ t('save.toggleGrid') }}</v-tooltip>
      </v-btn>
    </div>

    <!-- Height (Y level) slider -->
    <div
      class="map-height absolute right-3 bottom-3 flex flex-col items-center gap-1 rounded bg-[rgba(0,0,0,0.55)] px-1 py-2 text-xs text-gray-200 backdrop-blur"
      data-testid="save-world-map-height"
    >
      <span class="px-1 font-medium">{{ atTop ? t('save.heightTop') : renderHeight }}</span>
      <v-slider
        v-model="renderHeight"
        direction="vertical"
        :min="heightBounds.min"
        :max="heightBounds.max"
        :step="1"
        hide-details
        density="compact"
        color="primary"
        track-color="grey"
      />
      <v-icon size="14">height</v-icon>
    </div>

    <!-- Hotkey legend -->
    <div
      class="map-legend absolute top-3 right-3 flex items-center gap-3 rounded bg-[rgba(0,0,0,0.55)] px-3 py-1.5 text-xs text-gray-200 backdrop-blur"
      data-testid="save-world-map-legend"
    >
      <span
        class="flex items-center gap-1"
        :class="{ 'text-white font-medium': !ctrlHeld && !shiftHeld }"
      >
        <v-icon size="14">pan_tool</v-icon>
        {{ t('save.mapHintPan') }}
      </span>
      <span class="flex items-center gap-1" :class="{ 'text-primary font-medium': ctrlHeld }">
        <kbd class="map-kbd">{{ ctrlKeyLabel }}</kbd>
        {{ t('save.mapHintSelect') }}
      </span>
      <span class="flex items-center gap-1" :class="{ 'text-amber-400 font-medium': shiftHeld }">
        <kbd class="map-kbd">{{ shiftKeyLabel }}</kbd>
        {{ t('save.mapHintDeselect') }}
      </span>
    </div>

    <!-- Bottom action bar -->
    <div class="map-actions absolute bottom-3 left-3 flex items-center gap-2">
      <v-btn size="small" variant="flat" @click="resetView">
        <v-icon start> center_focus_strong </v-icon>
        {{ t('save.resetView') }}
      </v-btn>
      <v-btn v-if="selectedCount > 0" size="small" variant="flat" @click="clearSelection">
        <v-icon start> deselect </v-icon>
        {{ t('save.clearSelection') }}
      </v-btn>
      <v-btn
        v-if="selectedCount > 0"
        size="small"
        variant="flat"
        data-testid="save-world-map-copy"
        @click="copySelection"
      >
        <v-icon start> content_copy </v-icon>
        {{ t('save.copyChunks') }}
      </v-btn>
      <v-btn
        v-if="clipboardCount > 0"
        :loading="pasting"
        :disabled="pasting || placing"
        :color="placing ? 'success' : 'primary'"
        size="small"
        variant="flat"
        data-testid="save-world-map-paste"
        @click="startPlacement"
      >
        <v-icon start> content_paste </v-icon>
        {{ t('save.pasteChunks', { count: clipboardCount }) }}
      </v-btn>
      <v-btn
        :disabled="selectedCount === 0 || deleting"
        :loading="deleting"
        color="error"
        size="small"
        variant="flat"
        data-testid="save-world-map-delete"
        @click="confirmDeleteShown = true"
      >
        <v-icon start> delete </v-icon>
        {{ t('save.deleteChunks') }}
      </v-btn>
    </div>

    <div
      v-if="loading"
      class="absolute right-3 top-3 flex items-center gap-2 rounded bg-[rgba(0,0,0,0.55)] px-2 py-1 text-white"
    >
      <v-progress-circular indeterminate size="16" width="2" />
      {{ t('save.mapLoading') }}
    </div>

    <div
      v-if="!loading && regions.length === 0"
      class="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-400"
    >
      {{ t('save.noRegions') }}
    </div>

    <!-- Paste placement bar -->
    <div
      v-if="placing"
      class="map-place-bar absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-3 rounded bg-[rgba(0,0,0,0.7)] px-3 py-1.5 text-sm text-gray-100 backdrop-blur"
      data-testid="save-world-map-place-bar"
    >
      <v-icon size="18" color="success">content_paste</v-icon>
      <span>{{ t('save.pasteChunksPlaceHint', { count: clipboardCount }) }}</span>
      <v-btn size="x-small" variant="text" @click="cancelPlacement">
        {{ t('save.pasteChunksCancel') }}
      </v-btn>
    </div>

    <SimpleDialog
      v-model="confirmDeleteShown"
      :title="t('save.deleteChunksTitle')"
      :confirm="t('save.deleteChunks')"
      :width="460"
      persistent
      @confirm="doDelete"
    >
      {{ t('save.deleteChunksHint', { count: selectedCount }) }}
    </SimpleDialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { InstanceSavesServiceKey, SaveRegionInfo } from '@xmcl/runtime-api'
import { useService } from '@/composables'
import { useSavesChunkClipboard } from '@/composables/savesChunkClipboard'
import { useLocalStorage } from '@vueuse/core'
import SimpleDialog from './SimpleDialog.vue'

const props = defineProps<{
  savePath: string
}>()

const { t } = useI18n()
const { listSaveDimensions, getSaveRegions, renderSaveRegion, deleteSaveChunks, copySaveChunks, pasteSaveChunks } =
  useService(InstanceSavesServiceKey)
// Shared across saves, so chunks copied in one world can be pasted into another.
const chunkClipboard = useSavesChunkClipboard()
const root = ref<HTMLDivElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

const dimensions = ref<string[]>([])
const dimension = ref('minecraft:overworld')
const regions = shallowRef<SaveRegionInfo[]>([])
const loading = ref(false)
const deleting = ref(false)
const pasting = ref(false)
const confirmDeleteShown = ref(false)
// Interactive paste placement. While `placing`, a ghost footprint of the
// clipboard chunks follows the cursor and clicking commits the paste at the
// chosen offset. `ghostOrigin` is the destination chunk coord of the
// footprint's top-left corner.
const placing = ref(false)
let ghostOriginX = 0
let ghostOriginZ = 0

const dragging = ref(false)
const selectedCount = ref(0)
const clipboardCount = computed(() => chunkClipboard.value.length)

// Region (.mca) grid overlay. Persisted so it survives navigation.
const showGrid = useLocalStorage('saveWorldMapGrid', true, { writeDefaults: false })
function toggleGrid() {
  showGrid.value = !showGrid.value
  requestRender()
}

// Vertical render height. The world is rendered as if everything above this Y
// were peeled away, so users can inspect underground/structure layers. `top`
// means the full visible surface (no cap).
const heightBounds = computed(() => {
  if (dimension.value === 'minecraft:overworld') return { min: -64, max: 320 }
  return { min: 0, max: 256 }
})
const renderHeight = ref(320)
const atTop = computed(() => renderHeight.value >= heightBounds.value.max)

// Modifier keys currently held, tracked globally so the cursor and legend can
// reflect the active interaction even before the pointer goes down.
const ctrlHeld = ref(false)
const shiftHeld = ref(false)

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
const ctrlKeyLabel = isMac ? '⌘' : 'Ctrl'
const shiftKeyLabel = isMac ? '⇧' : 'Shift'

const cursorStyle = computed(() => {
  if (placing.value) return dragging.value ? 'grabbing' : 'copy'
  if (dragging.value) {
    return gestureMode === 'pan' ? 'grabbing' : 'crosshair'
  }
  if (ctrlHeld.value || shiftHeld.value) return 'crosshair'
  return 'grab'
})

const dimensionItems = computed(() =>
  dimensions.value.map((d) => ({
    title: dimensionLabel(d),
    value: d,
  })),
)

function dimensionLabel(d: string) {
  if (d === 'minecraft:overworld') return t('save.dimOverworld')
  if (d === 'minecraft:the_nether') return t('save.dimNether')
  if (d === 'minecraft:the_end') return t('save.dimEnd')
  return d
}

// Camera state in world-block coordinates.
let centerX = 0
let centerZ = 0
let scale = 0.5 // pixels per block

// Region image cache. Value: ImageBitmap | 'loading' | 'empty'
const tileCache = new Map<string, ImageBitmap | 'loading' | 'empty'>()
// Chunk existence per region, keyed by region. Used to limit selection to real chunks.
const chunkCache = new Map<string, boolean[]>()
// Selected chunks, keyed by `${chunkX},${chunkZ}`.
const selected = new Set<string>()

let ctx: CanvasRenderingContext2D | null = null
let rafHandle = 0
let resizeObserver: ResizeObserver | null = null

function regionKey(rx: number, rz: number) {
  return `${rx},${rz}`
}

function requestRender() {
  if (rafHandle) return
  rafHandle = requestAnimationFrame(() => {
    rafHandle = 0
    draw()
  })
}

function resizeCanvas() {
  const el = canvas.value
  const container = root.value
  if (!el || !container) return
  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = container.clientHeight
  el.width = Math.max(1, Math.floor(w * dpr))
  el.height = Math.max(1, Math.floor(h * dpr))
  ctx = el.getContext('2d')
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
  }
  requestRender()
}

function cssSize() {
  const container = root.value
  return {
    w: container?.clientWidth ?? 0,
    h: container?.clientHeight ?? 0,
  }
}

function worldToScreen(bx: number, bz: number) {
  const { w, h } = cssSize()
  return {
    x: w / 2 + (bx - centerX) * scale,
    y: h / 2 + (bz - centerZ) * scale,
  }
}

function screenToWorld(sx: number, sy: number) {
  const { w, h } = cssSize()
  return {
    x: centerX + (sx - w / 2) / scale,
    z: centerZ + (sy - h / 2) / scale,
  }
}

async function ensureRegionLoaded(rx: number, rz: number) {
  const key = regionKey(rx, rz)
  if (tileCache.has(key)) return
  tileCache.set(key, 'loading')
  try {
    const { data, chunks } = await renderSaveRegion(
      props.savePath,
      dimension.value,
      rx,
      rz,
      atTop.value ? undefined : renderHeight.value,
    )
    chunkCache.set(key, chunks)
    const buffer = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBufferLike)
    const imageData = new ImageData(
      new Uint8ClampedArray(buffer.buffer, buffer.byteOffset, buffer.byteLength) as any,
      512,
      512,
    )
    const bitmap = await createImageBitmap(imageData)
    tileCache.set(key, bitmap)
  } catch (e) {
    tileCache.set(key, 'empty')
  }
  requestRender()
}

function visibleRegions() {
  const { w, h } = cssSize()
  const topLeft = screenToWorld(0, 0)
  const bottomRight = screenToWorld(w, h)
  const minRx = Math.floor(topLeft.x / 512)
  const maxRx = Math.floor(bottomRight.x / 512)
  const minRz = Math.floor(topLeft.z / 512)
  const maxRz = Math.floor(bottomRight.z / 512)
  const available = new Set(regions.value.map((r) => regionKey(r.regionX, r.regionZ)))
  const result: SaveRegionInfo[] = []
  for (let rz = minRz; rz <= maxRz; rz++) {
    for (let rx = minRx; rx <= maxRx; rx++) {
      if (available.has(regionKey(rx, rz))) {
        result.push({ regionX: rx, regionZ: rz })
      }
    }
  }
  return result
}

function draw() {
  if (!ctx) return
  const { w, h } = cssSize()
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#1b1b1f'
  ctx.fillRect(0, 0, w, h)

  const visible = visibleRegions()
  for (const { regionX, regionZ } of visible) {
    const key = regionKey(regionX, regionZ)
    const tile = tileCache.get(key)
    if (!tile) {
      ensureRegionLoaded(regionX, regionZ)
      continue
    }
    if (tile === 'loading' || tile === 'empty') continue
    const origin = worldToScreen(regionX * 512, regionZ * 512)
    const size = 512 * scale
    ctx.drawImage(tile, origin.x, origin.y, size, size)
  }

  if (showGrid.value) {
    drawGrid(w, h)
  }

  // Selected chunk overlay.
  if (selected.size > 0) {
    ctx.fillStyle = 'rgba(33, 150, 243, 0.35)'
    ctx.strokeStyle = 'rgba(33, 150, 243, 0.9)'
    ctx.lineWidth = 1
    const chunkSize = 16 * scale
    for (const key of selected) {
      const [cx, cz] = key.split(',').map(Number)
      const p = worldToScreen(cx * 16, cz * 16)
      if (p.x + chunkSize < 0 || p.y + chunkSize < 0 || p.x > w || p.y > h) continue
      ctx.fillRect(p.x, p.y, chunkSize, chunkSize)
      if (chunkSize > 4) ctx.strokeRect(p.x, p.y, chunkSize, chunkSize)
    }
  }

  // Rubber-band rectangle while selecting / deselecting.
  if (dragging.value && band && gestureMode !== 'pan') {
    const deselecting = gestureMode === 'deselect'
    ctx.fillStyle = deselecting ? 'rgba(255, 193, 7, 0.18)' : 'rgba(33, 150, 243, 0.18)'
    ctx.strokeStyle = deselecting ? 'rgba(255, 193, 7, 0.9)' : 'rgba(33, 150, 243, 0.9)'
    ctx.lineWidth = 1
    const x = Math.min(band.x0, band.x1)
    const y = Math.min(band.y0, band.y1)
    ctx.fillRect(x, y, Math.abs(band.x1 - band.x0), Math.abs(band.y1 - band.y0))
    ctx.strokeRect(x, y, Math.abs(band.x1 - band.x0), Math.abs(band.y1 - band.y0))
  }

  // Paste-placement ghost footprint.
  if (placing.value) {
    const chunks = chunkClipboard.value
    const bounds = footprintBounds()
    if (bounds) {
      ctx.fillStyle = 'rgba(76, 175, 80, 0.35)'
      ctx.strokeStyle = 'rgba(76, 175, 80, 0.95)'
      ctx.lineWidth = 1
      const chunkSize = 16 * scale
      for (const c of chunks) {
        const dx = c.chunkX - bounds.minX
        const dz = c.chunkZ - bounds.minZ
        const p = worldToScreen((ghostOriginX + dx) * 16, (ghostOriginZ + dz) * 16)
        if (p.x + chunkSize < 0 || p.y + chunkSize < 0 || p.x > w || p.y > h) continue
        ctx.fillRect(p.x, p.y, chunkSize, chunkSize)
        if (chunkSize > 4) ctx.strokeRect(p.x, p.y, chunkSize, chunkSize)
      }
    }
  }
}

/**
 * Draw the .mca region grid (every 512 blocks). A finer chunk grid (every 16
 * blocks) fades in once chunks are large enough to be legible, and region
 * coordinates are labelled when there is room.
 */
function drawGrid(w: number, h: number) {
  if (!ctx) return
  const topLeft = screenToWorld(0, 0)
  const bottomRight = screenToWorld(w, h)

  // Finer chunk grid, only when zoomed in enough to be useful.
  const chunkPx = 16 * scale
  if (chunkPx >= 6) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.beginPath()
    const minCx = Math.floor(topLeft.x / 16)
    const maxCx = Math.ceil(bottomRight.x / 16)
    const minCz = Math.floor(topLeft.z / 16)
    const maxCz = Math.ceil(bottomRight.z / 16)
    for (let cx = minCx; cx <= maxCx; cx++) {
      const x = worldToScreen(cx * 16, 0).x
      ctx.moveTo(x, 0); ctx.lineTo(x, h)
    }
    for (let cz = minCz; cz <= maxCz; cz++) {
      const y = worldToScreen(0, cz * 16).y
      ctx.moveTo(0, y); ctx.lineTo(w, y)
    }
    ctx.stroke()
  }

  // Region grid.
  const minRx = Math.floor(topLeft.x / 512)
  const maxRx = Math.ceil(bottomRight.x / 512)
  const minRz = Math.floor(topLeft.z / 512)
  const maxRz = Math.ceil(bottomRight.z / 512)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
  ctx.beginPath()
  for (let rx = minRx; rx <= maxRx; rx++) {
    const x = worldToScreen(rx * 512, 0).x
    ctx.moveTo(x, 0); ctx.lineTo(x, h)
  }
  for (let rz = minRz; rz <= maxRz; rz++) {
    const y = worldToScreen(0, rz * 512).y
    ctx.moveTo(0, y); ctx.lineTo(w, y)
  }
  ctx.stroke()

  // Region coordinate labels, when a region is large enough on screen.
  const regionPx = 512 * scale
  if (regionPx >= 64) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.font = '11px sans-serif'
    ctx.textBaseline = 'top'
    for (let rz = minRz; rz < maxRz; rz++) {
      for (let rx = minRx; rx < maxRx; rx++) {
        const p = worldToScreen(rx * 512, rz * 512)
        ctx.fillText(`r.${rx}.${rz}`, p.x + 4, p.y + 3)
      }
    }
  }
}

// Pointer interaction
type GestureMode = 'pan' | 'select' | 'deselect'
let gestureMode: GestureMode = 'pan'
let pointerStart: { x: number; y: number } | null = null
let lastPointer: { x: number; y: number } | null = null
let band: { x0: number; y0: number; x1: number; y1: number } | null = null
let moved = false

function localPoint(e: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function modeFromEvent(e: PointerEvent | KeyboardEvent): GestureMode {
  if (e.ctrlKey || e.metaKey) return 'select'
  if (e.shiftKey) return 'deselect'
  return 'pan'
}

function onPointerDown(e: PointerEvent) {
  canvas.value?.setPointerCapture(e.pointerId)
  const p = localPoint(e)
  pointerStart = p
  lastPointer = p
  dragging.value = true
  moved = false
  // The gesture mode is locked in for the whole drag based on the modifier
  // held when the pointer goes down: default pan, Ctrl select, Alt deselect.
  // While placing a paste, dragging only ever pans (a click commits instead).
  gestureMode = placing.value ? 'pan' : modeFromEvent(e)
  if (gestureMode !== 'pan') {
    band = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
  }
}

function onPointerMove(e: PointerEvent) {
  const p = localPoint(e)
  // The paste footprint tracks the cursor even before the pointer goes down.
  if (placing.value) {
    updateGhostFromScreen(p.x, p.y)
  }
  if (!dragging.value) return
  if (
    Math.abs(p.x - (pointerStart?.x ?? p.x)) > 2 ||
    Math.abs(p.y - (pointerStart?.y ?? p.y)) > 2
  ) {
    moved = true
  }
  if (gestureMode !== 'pan' && band) {
    band.x1 = p.x
    band.y1 = p.y
    requestRender()
  } else if (lastPointer) {
    centerX -= (p.x - lastPointer.x) / scale
    centerZ -= (p.y - lastPointer.y) / scale
    lastPointer = p
    requestRender()
  }
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  const p = lastPointer
  if (placing.value) {
    // A click (no meaningful drag) commits the paste at the ghost location.
    if (gestureMode === 'pan' && !moved) {
      confirmPlacement()
    }
    band = null
    pointerStart = null
    lastPointer = p
    return
  }
  if (gestureMode !== 'pan' && band) {
    const add = gestureMode === 'select'
    if (!moved && pointerStart) {
      setChunkAt(pointerStart.x, pointerStart.y, add)
    } else {
      applyBand(band, add)
    }
    band = null
    requestRender()
  }
  pointerStart = null
  lastPointer = p
}

function chunkExists(cx: number, cz: number) {
  const rx = cx >> 5
  const rz = cz >> 5
  const chunks = chunkCache.get(regionKey(rx, rz))
  if (!chunks) return false
  const index = (cx & 31) + (cz & 31) * 32
  return chunks[index]
}

function setChunkAt(sx: number, sy: number, add: boolean) {
  const world = screenToWorld(sx, sy)
  const cx = Math.floor(world.x / 16)
  const cz = Math.floor(world.z / 16)
  if (!chunkExists(cx, cz)) return
  const key = `${cx},${cz}`
  if (add) selected.add(key)
  else selected.delete(key)
  selectedCount.value = selected.size
}

function applyBand(b: { x0: number; y0: number; x1: number; y1: number }, add: boolean) {
  const a = screenToWorld(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1))
  const c = screenToWorld(Math.max(b.x0, b.x1), Math.max(b.y0, b.y1))
  const minCx = Math.floor(a.x / 16)
  const maxCx = Math.floor(c.x / 16)
  const minCz = Math.floor(a.z / 16)
  const maxCz = Math.floor(c.z / 16)
  for (let cz = minCz; cz <= maxCz; cz++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      if (!chunkExists(cx, cz)) continue
      const key = `${cx},${cz}`
      if (add) selected.add(key)
      else selected.delete(key)
    }
  }
  selectedCount.value = selected.size
}

function onWheel(e: WheelEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  const sx = e.clientX - rect.left
  const sy = e.clientY - rect.top
  const before = screenToWorld(sx, sy)
  const factor = e.deltaY > 0 ? 0.9 : 1.1
  scale = Math.max(0.05, Math.min(16, scale * factor))
  const after = screenToWorld(sx, sy)
  // Keep the point under the cursor fixed.
  centerX += before.x - after.x
  centerZ += before.z - after.z
  requestRender()
}

function clearSelection() {
  selected.clear()
  selectedCount.value = 0
  requestRender()
}

function zoomIn() {
  // zoom in when dbclick
  const { w, h } = cssSize()
  const before = screenToWorld(w / 2, h / 2)
  scale = Math.min(16, scale * 1.5)
  const after = screenToWorld(w / 2, h / 2)
  centerX += before.x - after.x
  centerZ += before.z - after.z
  requestRender()
}

function resetView() {
  if (regions.value.length === 0) {
    centerX = 0
    centerZ = 0
    scale = 0.5
    requestRender()
    return
  }
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const r of regions.value) {
    minX = Math.min(minX, r.regionX * 512)
    maxX = Math.max(maxX, r.regionX * 512 + 512)
    minZ = Math.min(minZ, r.regionZ * 512)
    maxZ = Math.max(maxZ, r.regionZ * 512 + 512)
  }
  centerX = (minX + maxX) / 2
  centerZ = (minZ + maxZ) / 2
  const { w, h } = cssSize()
  const spanX = Math.max(512, maxX - minX)
  const spanZ = Math.max(512, maxZ - minZ)
  scale = Math.max(0.05, Math.min(2, Math.min(w / spanX, h / spanZ) * 0.9))
  requestRender()
}

async function doDelete() {
  confirmDeleteShown.value = false
  if (selected.size === 0) return
  deleting.value = true
  try {
    const chunks = Array.from(selected).map((k) => {
      const [chunkX, chunkZ] = k.split(',').map(Number)
      return { chunkX, chunkZ }
    })
    await deleteSaveChunks({ savePath: props.savePath, dimension: dimension.value, chunks })
    // Invalidate affected region tiles so they re-render.
    invalidateChunkTiles(chunks)
    clearSelection()
    // Region list may have shrunk if files were removed.
    await loadRegions()
  } finally {
    deleting.value = false
  }
}

// Drop the cached tiles/chunk maps for every region touched by `chunks` so the
// affected area is rendered fresh on the next draw.
function invalidateChunkTiles(chunks: Array<{ chunkX: number; chunkZ: number }>) {
  const affected = new Set<string>()
  for (const { chunkX, chunkZ } of chunks) {
    affected.add(regionKey(chunkX >> 5, chunkZ >> 5))
  }
  for (const key of affected) {
    const tile = tileCache.get(key)
    if (tile && tile !== 'loading' && tile !== 'empty') tile.close()
    tileCache.delete(key)
    chunkCache.delete(key)
  }
}

async function copySelection() {
  if (selected.size === 0) return
  const chunks = Array.from(selected).map((k) => {
    const [chunkX, chunkZ] = k.split(',').map(Number)
    return { chunkX, chunkZ }
  })
  const copied = await copySaveChunks({ savePath: props.savePath, dimension: dimension.value, chunks })
  chunkClipboard.value = copied ?? []
}

/** Bounding box of the clipboard footprint, in absolute chunk coordinates. */
function footprintBounds() {
  const chunks = chunkClipboard.value
  if (chunks.length === 0) return undefined
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const c of chunks) {
    if (c.chunkX < minX) minX = c.chunkX
    if (c.chunkX > maxX) maxX = c.chunkX
    if (c.chunkZ < minZ) minZ = c.chunkZ
    if (c.chunkZ > maxZ) maxZ = c.chunkZ
  }
  return { minX, minZ, maxX, maxZ, width: maxX - minX + 1, height: maxZ - minZ + 1 }
}

/** Center the paste footprint on the chunk under the given screen point. */
function updateGhostFromScreen(sx: number, sy: number) {
  const bounds = footprintBounds()
  if (!bounds) return
  const world = screenToWorld(sx, sy)
  const cx = Math.floor(world.x / 16)
  const cz = Math.floor(world.z / 16)
  ghostOriginX = cx - Math.floor(bounds.width / 2)
  ghostOriginZ = cz - Math.floor(bounds.height / 2)
  requestRender()
}

function startPlacement() {
  const bounds = footprintBounds()
  if (!bounds) return
  // Default the footprint to its original coordinates.
  ghostOriginX = bounds.minX
  ghostOriginZ = bounds.minZ
  placing.value = true
  requestRender()
}

function cancelPlacement() {
  placing.value = false
  requestRender()
}

function confirmPlacement() {
  const bounds = footprintBounds()
  if (!bounds) {
    placing.value = false
    return
  }
  const offsetX = ghostOriginX - bounds.minX
  const offsetZ = ghostOriginZ - bounds.minZ
  placing.value = false
  doPaste(offsetX, offsetZ)
}

async function doPaste(offsetX = 0, offsetZ = 0) {
  const chunks = chunkClipboard.value
  if (chunks.length === 0) return
  pasting.value = true
  try {
    await pasteSaveChunks({ savePath: props.savePath, dimension: dimension.value, chunks, offsetX, offsetZ })
    // Destination coordinates are the clipboard chunks shifted by the offset.
    invalidateChunkTiles(chunks.map((c) => ({ chunkX: c.chunkX + offsetX, chunkZ: c.chunkZ + offsetZ })))
    // Pasting may introduce regions that did not exist before.
    await loadRegions()
    requestRender()
  } finally {
    pasting.value = false
  }
}

async function loadRegions() {
  regions.value = await getSaveRegions(props.savePath, dimension.value).catch(() => [])
}

async function loadDimension() {
  loading.value = true
  // Drop cached tiles from the previous dimension.
  for (const tile of tileCache.values()) {
    if (tile && tile !== 'loading' && tile !== 'empty') tile.close()
  }
  tileCache.clear()
  chunkCache.clear()
  clearSelection()
  placing.value = false
  // Reset the render height to the top of the new dimension's range.
  renderHeight.value = heightBounds.value.max
  try {
    await loadRegions()
    resetView()
  } finally {
    loading.value = false
  }
}

// Re-render all tiles when the height cap changes (debounced for slider drags).
let heightTimer: ReturnType<typeof setTimeout> | undefined
function invalidateTiles() {
  for (const tile of tileCache.values()) {
    if (tile && tile !== 'loading' && tile !== 'empty') tile.close()
  }
  tileCache.clear()
  chunkCache.clear()
  requestRender()
}
watch(renderHeight, () => {
  if (heightTimer) clearTimeout(heightTimer)
  heightTimer = setTimeout(invalidateTiles, 150)
})

async function init() {
  loading.value = true
  // Drop cached tiles/chunks from the previously shown save so its rendered
  // regions are not drawn over the new one.
  invalidateTiles()
  clearSelection()
  placing.value = false
  try {
    const dims = await listSaveDimensions(props.savePath).catch(() => [] as string[])
    dimensions.value = dims
    if (dims.length > 0 && !dims.includes(dimension.value)) {
      dimension.value = dims[0]
    }
    await loadRegions()
    resetView()
  } finally {
    loading.value = false
  }
}

watch(dimension, () => {
  loadDimension()
})

watch(
  () => props.savePath,
  () => {
    dimensions.value = []
    init()
  },
)

function syncModifiers(e: KeyboardEvent) {
  ctrlHeld.value = e.ctrlKey || e.metaKey
  shiftHeld.value = e.shiftKey
  if (e.type === 'keydown' && e.key === 'Escape' && placing.value) {
    cancelPlacement()
  }
}

function resetModifiers() {
  ctrlHeld.value = false
  shiftHeld.value = false
}

onMounted(() => {
  resizeCanvas()
  resizeObserver = new ResizeObserver(() => resizeCanvas())
  if (root.value) resizeObserver.observe(root.value)
  window.addEventListener('keydown', syncModifiers)
  window.addEventListener('keyup', syncModifiers)
  window.addEventListener('blur', resetModifiers)
  init()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', syncModifiers)
  window.removeEventListener('keyup', syncModifiers)
  window.removeEventListener('blur', resetModifiers)
  if (rafHandle) cancelAnimationFrame(rafHandle)
  for (const tile of tileCache.values()) {
    if (tile && tile !== 'loading' && tile !== 'empty') tile.close()
  }
  tileCache.clear()
})
</script>

<style scoped>
.map-kbd {
  display: inline-flex;
  align-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-bottom-width: 2px;
  font-size: 11px;
  line-height: 1;
  font-family: inherit;
  color: inherit;
}
</style>
