<template>
  <div class="blueprint-preview">
    <div
      ref="container"
      class="blueprint-preview__canvas"
      tabindex="0"
      @keydown="onKeyDown"
      @keyup="onKeyUp"
      @blur="pressedKeys.clear()"
    />
    <div v-if="loading" class="blueprint-preview__overlay">
      <v-progress-circular indeterminate color="primary" />
      <span class="ml-3">{{ t('blueprint.preview.loading') }}</span>
    </div>
    <div v-else-if="errorText" class="blueprint-preview__overlay flex-column">
      <v-icon size="48" color="warning">
        warning
      </v-icon>
      <span class="mt-2">{{ errorText }}</span>
    </div>
    <div v-if="!loading && !errorText" class="blueprint-preview__hint">
      {{ t('blueprint.preview.hint', { count: blockCount, x: size.x, y: size.y, z: size.z }) }}
    </div>
    <div v-if="!loading && !errorText" class="blueprint-preview__controls">
      {{ t('blueprint.preview.controls') }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useService } from '@/composables/service'
import { InstanceBlueprintsServiceKey } from '@xmcl/runtime-api'
import * as THREE from 'three'
import { loadBlockTexture } from '@/util/blockTexture'

const props = defineProps<{
  instancePath: string
  fileName: string
  size?: { x: number; y: number; z: number }
  palette?: { name: string; properties?: Record<string, string> }[]
  voxels?: number[]
}>()

const { t } = useI18n()
const { getBlueprintInfo } = useService(InstanceBlueprintsServiceKey)

const container = ref<HTMLDivElement>()
const loading = ref(true)
const errorText = ref('')
const blockCount = ref(0)
const size = reactive({ x: 0, y: 0, z: 0 })

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let frame = 0
let resizeObserver: ResizeObserver | undefined
let disposed = false

// Minecraft-like first-person fly camera. WASD moves on the horizontal plane
// relative to where you look, Space/Shift go up/down, and dragging the mouse
// rotates the view (yaw/pitch) without locking the pointer.
const pressedKeys = new Set<string>()
const MOVE_KEYS = new Set(['w', 'a', 's', 'd', ' ', 'shift'])
let moveSpeed = 0.5
let yaw = 0
let pitch = 0
let dragging = false
let lastPointerX = 0
let lastPointerY = 0
const LOOK_SENSITIVITY = 0.005
const PITCH_LIMIT = Math.PI / 2 - 0.01
const tmpMove = new THREE.Vector3()

function applyRotation() {
  if (camera) camera.rotation.set(pitch, yaw, 0, 'YXZ')
}

function onKeyDown(e: KeyboardEvent) {
  const k = e.key.toLowerCase()
  if (!MOVE_KEYS.has(k)) return
  pressedKeys.add(k)
  e.preventDefault()
}
function onKeyUp(e: KeyboardEvent) {
  pressedKeys.delete(e.key.toLowerCase())
}
function onPointerDown(e: PointerEvent) {
  dragging = true
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  container.value?.focus()
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  el.style.cursor = 'grabbing'
}
function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  yaw -= (e.clientX - lastPointerX) * LOOK_SENSITIVITY
  pitch -= (e.clientY - lastPointerY) * LOOK_SENSITIVITY
  pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch))
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  applyRotation()
}
function onPointerUp(e: PointerEvent) {
  dragging = false
  const el = e.currentTarget as HTMLElement
  el.releasePointerCapture?.(e.pointerId)
  el.style.cursor = 'grab'
}
function onWheel(e: WheelEvent) {
  if (!camera) return
  e.preventDefault()
  // Dolly along the look direction, like creeping forward/back.
  const step = moveSpeed * 4 * (e.deltaY > 0 ? -1 : 1)
  camera.position.add(camera.getWorldDirection(tmpMove).multiplyScalar(step))
}
function updateMovement() {
  if (!camera || pressedKeys.size === 0) return
  // Horizontal forward/right derived from yaw only (Minecraft-style fly).
  const sinY = Math.sin(yaw)
  const cosY = Math.cos(yaw)
  tmpMove.set(0, 0, 0)
  if (pressedKeys.has('w')) { tmpMove.x -= sinY; tmpMove.z -= cosY }
  if (pressedKeys.has('s')) { tmpMove.x += sinY; tmpMove.z += cosY }
  if (pressedKeys.has('d')) { tmpMove.x += cosY; tmpMove.z -= sinY }
  if (pressedKeys.has('a')) { tmpMove.x -= cosY; tmpMove.z += sinY }
  if (pressedKeys.has(' ')) tmpMove.y += 1
  if (pressedKeys.has('shift')) tmpMove.y -= 1
  if (tmpMove.lengthSq() === 0) return
  tmpMove.normalize().multiplyScalar(moveSpeed)
  camera.position.add(tmpMove)
}

const sharedGeometry = new THREE.BoxGeometry(1, 1, 1)
const ownedMaterials: THREE.Material[] = []

const fallbackColor = (name: string) => {
  // Deterministic pleasant color from the block id.
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const color = new THREE.Color()
  color.setHSL((hash % 360) / 360, 0.5, 0.55)
  return color
}

const isTranslucent = (name: string) => /glass|water|ice|bubble|slime|honey|portal|barrier/.test(name)
const isCutout = (name: string) => /leaves|sapling|rail|_wire|torch|grass|fern|flower|door|pane|fence|sign|ladder|vine|lever|button|_bars/.test(name)

async function build() {
  loading.value = true
  errorText.value = ''
  try {
    // Prefer the palette/voxels cached on the resource metadata; fall back to a
    // live parse when they're missing (e.g. files scanned before voxels were
    // cached, or an older metadata row).
    let preview: { size: { x: number; y: number; z: number }; palette: { name: string; properties?: Record<string, string> }[]; voxels: number[] }
    if (props.voxels && props.voxels.length > 0 && props.palette && props.size) {
      preview = { size: props.size, palette: props.palette, voxels: props.voxels }
    } else {
      const info = await getBlueprintInfo(props.instancePath, props.fileName)
      preview = {
        size: info.size ?? { x: 0, y: 0, z: 0 },
        palette: info.palette ?? [],
        voxels: info.voxels ?? [],
      }
    }
    size.x = preview.size.x
    size.y = preview.size.y
    size.z = preview.size.z
    const voxelCount = preview.voxels.length / 4
    blockCount.value = voxelCount

    if (voxelCount === 0) {
      errorText.value = t('blueprint.preview.empty')
      loading.value = false
      return
    }

    // Build one material per palette index with a fallback color first, so the
    // structure renders immediately. Real jar textures are fetched afterwards
    // and swapped in — opening the version jar + mod jars can be slow and must
    // not block the initial render.
    const paletteMaterials = preview.palette.map((state) => {
      const material = new THREE.MeshLambertMaterial({ color: fallbackColor(state.name) })
      if (isTranslucent(state.name)) {
        material.transparent = true
        material.opacity = 0.7
        material.depthWrite = false
      }
      ownedMaterials.push(material)
      return material
    })

    if (disposed) return
    setupScene(preview, paletteMaterials)
    loading.value = false

    applyTextures(preview.palette, paletteMaterials).catch(() => {})
  } catch (e) {
    errorText.value = (e as Error).message || String(e)
  } finally {
    loading.value = false
  }
}

/**
 * Apply textures from the shared block-texture cache onto the already-rendered
 * fallback-colored materials. Each block id is loaded at most once for the
 * whole app, so switching back to a blueprint reuses cached textures without a
 * new request, and 404s keep the fallback color.
 */
async function applyTextures(
  palette: { name: string; properties?: Record<string, string> }[],
  materials: THREE.MeshLambertMaterial[],
) {
  await Promise.all(palette.map(async (state, idx) => {
    const material = materials[idx]
    if (!material || !state.name || state.name === 'minecraft:air') return
    const texture = await loadBlockTexture(state.name)
    if (disposed || !texture) return
    material.map = texture
    // White base color so the texture shows its true colors.
    material.color = new THREE.Color(0xffffff)
    if (!isTranslucent(state.name)) {
      material.alphaTest = isCutout(state.name) ? 0.5 : 0.1
    }
    material.needsUpdate = true
  }))
}

function setupScene(preview: { size: { x: number; y: number; z: number }; voxels: number[] }, materials: THREE.Material[]) {
  const el = container.value
  if (!el) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x222226)

  const width = el.clientWidth || 600
  const height = el.clientHeight || 400
  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 4000)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(width, height)
  ;(renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace
  el.appendChild(renderer.domElement)

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.1))
  const dir = new THREE.DirectionalLight(0xffffff, 0.7)
  dir.position.set(0.8, 1.4, 0.6)
  scene.add(dir)
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.35)
  dir2.position.set(-0.7, 0.4, -0.8)
  scene.add(dir2)

  const { x: sx, y: sy, z: sz } = preview.size
  const voxels = preview.voxels
  const count = voxels.length / 4

  // Group voxel positions by palette index so each block type becomes a single
  // textured InstancedMesh.
  const byIndex = new Map<number, number[]>()
  for (let i = 0; i < count; i++) {
    const idx = voxels[i * 4 + 3]
    let list = byIndex.get(idx)
    if (!list) { list = []; byIndex.set(idx, list) }
    list.push(i)
  }

  const dummy = new THREE.Object3D()
  const cx = sx / 2
  const cy = sy / 2
  const cz = sz / 2
  for (const [idx, instances] of byIndex) {
    const material = materials[idx]
    if (!material) continue
    const mesh = new THREE.InstancedMesh(sharedGeometry, material, instances.length)
    instances.forEach((i, n) => {
      dummy.position.set(
        voxels[i * 4] - cx + 0.5,
        voxels[i * 4 + 1] - cy + 0.5,
        voxels[i * 4 + 2] - cz + 0.5,
      )
      dummy.updateMatrix()
      mesh.setMatrixAt(n, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    scene.add(mesh)
  }

  const diagonal = Math.sqrt(sx * sx + sy * sy + sz * sz)
  camera.position.set(diagonal, diagonal * 0.8, diagonal)
  camera.lookAt(0, 0, 0)
  moveSpeed = Math.max(0.05, diagonal / 120)

  // Seed yaw/pitch from the initial look-at so dragging continues smoothly.
  const initial = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
  yaw = initial.y
  pitch = initial.x
  applyRotation()

  const canvas = renderer.domElement
  canvas.style.cursor = 'grab'
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  resizeObserver = new ResizeObserver(() => onResize())
  resizeObserver.observe(el)

  const animate = () => {
    if (disposed) return
    frame = requestAnimationFrame(animate)
    updateMovement()
    if (renderer && scene && camera) renderer.render(scene, camera)
  }
  animate()
}

function onResize() {
  const el = container.value
  if (!el || !renderer || !camera) return
  const width = el.clientWidth
  const height = el.clientHeight
  if (width === 0 || height === 0) return
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

function dispose() {
  disposed = true
  pressedKeys.clear()
  dragging = false
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  if (renderer) {
    const canvas = renderer.domElement
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
    renderer.dispose()
    canvas.remove()
  }
  for (const m of ownedMaterials) m.dispose()
  ownedMaterials.length = 0
  renderer = undefined
  scene = undefined
  camera = undefined
}

onMounted(build)
onBeforeUnmount(() => {
  dispose()
  sharedGeometry.dispose()
})

watch(() => [props.instancePath, props.fileName], () => {
  dispose()
  disposed = false
  build()
})

</script>

<style scoped>
.blueprint-preview {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
}

.blueprint-preview__canvas {
  width: 100%;
  height: 100%;
  outline: none;
}

.blueprint-preview__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.blueprint-preview__hint {
  position: absolute;
  left: 8px;
  bottom: 8px;
  font-size: 12px;
  opacity: 0.7;
}

.blueprint-preview__controls {
  position: absolute;
  right: 8px;
  bottom: 8px;
  font-size: 12px;
  opacity: 0.5;
  pointer-events: none;
}
</style>
