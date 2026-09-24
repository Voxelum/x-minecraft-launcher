<template>
  <div class="blueprint-preview">
    <div
      ref="container"
      class="blueprint-preview__canvas"
      tabindex="0"
      @keydown="onKeyDown"
      @keyup="onKeyUp"
      @blur="activeActions.clear()"
      @pointerenter="onPointerEnter"
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
    <div v-if="!loading && !errorText" class="blueprint-preview__hint flex items-center gap-2">
      <span class="blueprint-preview__chip">
        {{ t('blueprint.preview.hint', { count: blockCount, x: size.x, y: size.y, z: size.z }) }}
      </span>
      <span v-if="texturesLoading && totalTextures > 0" class="blueprint-preview__chip blueprint-preview__chip--loading">
        <v-progress-circular indeterminate size="10" width="1.5" class="mr-1" />
        {{ loadedCount }} / {{ totalTextures }}
      </span>
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

const texturesLoading = ref(false)
const loadedCount = ref(0)
const totalTextures = ref(0)

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let frame = 0
let resizeObserver: ResizeObserver | undefined
let disposed = false

// Minecraft-like first-person fly camera
type MoveAction = 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down'
const activeActions = new Set<MoveAction>()

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

function getMoveAction(e: KeyboardEvent): MoveAction | undefined {
  switch (e.code) {
    case 'KeyW': return 'forward'
    case 'KeyS': return 'backward'
    case 'KeyA': return 'left'
    case 'KeyD': return 'right'
    case 'Space': return 'up'
    case 'ShiftLeft':
    case 'ShiftRight': return 'down'
  }
  const k = e.key.toLowerCase()
  if (k === 'w' || k === 'ц') return 'forward'
  if (k === 's' || k === 'і' || k === 'ы') return 'backward'
  if (k === 'a' || k === 'ф') return 'left'
  if (k === 'd' || k === 'в') return 'right'
  if (k === ' ') return 'up'
  if (k === 'shift') return 'down'
  return undefined
}

function onKeyDown(e: KeyboardEvent) {
  const action = getMoveAction(e)
  if (!action) return
  activeActions.add(action)
  e.preventDefault()
}

function onKeyUp(e: KeyboardEvent) {
  const action = getMoveAction(e)
  if (!action) return
  activeActions.delete(action)
}

function onPointerEnter() {
  const active = document.activeElement
  if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
    container.value?.focus()
  }
}

function onWindowBlur() {
  activeActions.clear()
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
  const step = moveSpeed * 4 * (e.deltaY > 0 ? -1 : 1)
  camera.position.add(camera.getWorldDirection(tmpMove).multiplyScalar(step))
}
function updateMovement() {
  if (!camera || activeActions.size === 0) return
  const sinY = Math.sin(yaw)
  const cosY = Math.cos(yaw)
  tmpMove.set(0, 0, 0)
  if (activeActions.has('forward')) { tmpMove.x -= sinY; tmpMove.z -= cosY }
  if (activeActions.has('backward')) { tmpMove.x += sinY; tmpMove.z += cosY }
  if (activeActions.has('right')) { tmpMove.x += cosY; tmpMove.z -= sinY }
  if (activeActions.has('left')) { tmpMove.x -= cosY; tmpMove.z += sinY }
  if (activeActions.has('up')) tmpMove.y += 1
  if (activeActions.has('down')) tmpMove.y -= 1
  if (tmpMove.lengthSq() === 0) return
  tmpMove.normalize().multiplyScalar(moveSpeed)
  camera.position.add(tmpMove)
}

const sharedGeometry = new THREE.BoxGeometry(1, 1, 1)
const ownedMaterials: THREE.Material[] = []

const fallbackColor = (name: string) => {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const color = new THREE.Color()
  color.setHSL((hash % 360) / 360, 0.5, 0.55)
  return color
}

const isTranslucent = (name: string) => /glass|water|ice|bubble|slime|honey|portal|barrier/.test(name)
const isCutout = (name: string) =>
  /leaves|sapling|rail|_wire|torch|grass|fern|flower|door|pane|fence|sign|ladder|vine|lever|button|_bars|trapdoor|lantern|chain/.test(name)

const hasMultiFace = (name: string) =>
  /grass_block|podzol|mycelium|dirt_path|barrel|_log|_wood|smooth_stone|sandstone|quartz_pillar|froglight|crafting_table|furnace|bookshelf|tnt|pumpkin|hay_block|cactus|target|beehive|bee_nest|respawn_anchor|lodestone/.test(name)

const getFoliageTint = (name: string): THREE.Color | undefined => {
  if (/birch_leaves/.test(name)) return new THREE.Color(0x80a755)
  if (/spruce_leaves/.test(name)) return new THREE.Color(0x619961)
  if (/leaves/.test(name)) return new THREE.Color(0x59ae30)
  if (/grass|fern|vine|lily_pad/.test(name)) return new THREE.Color(0x79c05a)
  if (/water/.test(name)) return new THREE.Color(0x3f76e4)
  return undefined
}

async function build() {
  loading.value = true
  errorText.value = ''
  try {
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

    const paletteMaterials: (THREE.Material | THREE.Material[])[] = preview.palette.map((state) => {
      const isTrans = isTranslucent(state.name)
      const isWater = /water/.test(state.name)

      if (hasMultiFace(state.name)) {
        const sideMat = new THREE.MeshLambertMaterial({ color: fallbackColor(state.name) })
        const topMat = new THREE.MeshLambertMaterial({
          color: state.name === 'minecraft:grass_block' ? new THREE.Color(0x79c05a) : fallbackColor(state.name),
        })
        const bottomMat = new THREE.MeshLambertMaterial({ color: fallbackColor(state.name) })

        ownedMaterials.push(sideMat, topMat, bottomMat)
        // Three.js BoxGeometry face order: [+X, -X, +Y, -Y, +Z, -Z]
        return [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat]
      }

      const tint = getFoliageTint(state.name)
      const material = new THREE.MeshLambertMaterial({
        color: tint || fallbackColor(state.name),
        transparent: isTrans || isCutout(state.name),
        opacity: isWater ? 0.65 : (isTrans ? 0.75 : 1.0),
        depthWrite: !isTrans,
        alphaTest: isCutout(state.name) ? 0.5 : 0.05,
        side: isCutout(state.name) || isTrans ? THREE.DoubleSide : THREE.FrontSide,
      })
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
 * Apply textures from the instance / latest Minecraft jar cache onto the
 * already-rendered materials with concurrent batching and multi-face resolution.
 */
async function applyTextures(
  palette: { name: string; properties?: Record<string, string> }[],
  materials: (THREE.Material | THREE.Material[])[],
) {
  const validEntries = palette
    .map((state, idx) => ({ state, idx }))
    .filter(({ state }) => state.name && state.name !== 'minecraft:air')

  totalTextures.value = validEntries.length
  loadedCount.value = 0
  texturesLoading.value = true

  const concurrency = 8
  let index = 0
  const worker = async () => {
    while (index < validEntries.length && !disposed) {
      const current = validEntries[index++]
      const matOrArray = materials[current.idx]
      const name = current.state.name
      if (!matOrArray) {
        loadedCount.value++
        continue
      }

      if (Array.isArray(matOrArray)) {
        const sideMat = matOrArray[0] as THREE.MeshLambertMaterial
        const topMat = matOrArray[2] as THREE.MeshLambertMaterial
        const bottomMat = matOrArray[3] as THREE.MeshLambertMaterial

        const [sideTex, topTex, bottomTex] = await Promise.all([
          loadBlockTexture(name, props.instancePath, 'side').catch(() => null),
          loadBlockTexture(name, props.instancePath, 'top').catch(() => null),
          loadBlockTexture(name, props.instancePath, 'bottom').catch(() => null),
        ])

        if (!disposed) {
          if (sideTex) {
            sideMat.map = sideTex
            sideMat.color = new THREE.Color(0xffffff)
            sideMat.needsUpdate = true
          }
          if (topTex) {
            topMat.map = topTex
            topMat.color = name === 'minecraft:grass_block' ? new THREE.Color(0x79c05a) : new THREE.Color(0xffffff)
            topMat.needsUpdate = true
          }
          if (bottomTex) {
            bottomMat.map = bottomTex
            bottomMat.color = new THREE.Color(0xffffff)
            bottomMat.needsUpdate = true
          }
        }
      } else {
        const material = matOrArray as THREE.MeshLambertMaterial
        const texture = await loadBlockTexture(name, props.instancePath).catch(() => null)
        if (texture && !disposed) {
          material.map = texture
          const tint = getFoliageTint(name)
          material.color = tint || new THREE.Color(0xffffff)
          if (isCutout(name)) {
            material.alphaTest = 0.5
            material.transparent = true
            material.depthWrite = true
            material.side = THREE.DoubleSide
          }
          material.needsUpdate = true
        }
      }
      loadedCount.value++
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  texturesLoading.value = false
}

function setupScene(
  preview: { size: { x: number; y: number; z: number }; palette: { name: string; properties?: Record<string, string> }[]; voxels: number[] },
  materials: (THREE.Material | THREE.Material[])[],
) {
  const el = container.value
  if (!el) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x18181b)

  const width = el.clientWidth || 600
  const height = el.clientHeight || 400
  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 4000)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(width, height)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  ;(renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace
  el.appendChild(renderer.domElement)

  // Lighting: balanced ambient + directional sun + fill light
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x38383f, 0.95)
  scene.add(hemiLight)

  const sunLight = new THREE.DirectionalLight(0xffffff, 0.85)
  sunLight.position.set(1.2, 2.0, 1.0)
  scene.add(sunLight)

  const fillLight = new THREE.DirectionalLight(0x88b0d8, 0.45)
  fillLight.position.set(-1.0, 0.8, -1.2)
  scene.add(fillLight)

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.25)
  scene.add(ambientLight)

  const { x: sx, y: sy, z: sz } = preview.size
  const voxels = preview.voxels
  const count = voxels.length / 4

  // Group voxel positions by palette index so each block type becomes a single textured InstancedMesh
  const byIndex = new Map<number, number[]>()
  for (let i = 0; i < count; i++) {
    const idx = voxels[i * 4 + 3]
    let list = byIndex.get(idx)
    if (!list) { list = []; byIndex.set(idx, list) }
    list.push(i)
  }

  // Spatial lookup set of non-air voxels for neighbor connectivity
  const voxelSet = new Set<string>()
  for (let i = 0; i < count; i++) {
    voxelSet.add(`${voxels[i * 4]},${voxels[i * 4 + 1]},${voxels[i * 4 + 2]}`)
  }
  const hasVoxel = (x: number, y: number, z: number) => voxelSet.has(`${x},${y},${z}`)

  const dummy = new THREE.Object3D()
  const cx = sx / 2
  const cy = sy / 2
  const cz = sz / 2
  for (const [idx, instances] of byIndex) {
    const material = materials[idx]
    if (!material) continue
    const blockState = preview.palette[idx]
    const bName = blockState?.name || ''
    const bProps = blockState?.properties || {}

    const mesh = new THREE.InstancedMesh(sharedGeometry, material, instances.length)
    instances.forEach((i, n) => {
      const vx = voxels[i * 4]
      const vy = voxels[i * 4 + 1]
      const vz = voxels[i * 4 + 2]

      let scaleX = 1
      let scaleY = 1
      let scaleZ = 1
      let offX = 0
      let offY = 0
      let offZ = 0

      if (/rail|carpet|pressure_plate/.test(bName)) {
        scaleY = 0.0625
        offY = -0.46875
      } else if (/_slab/.test(bName)) {
        const type = bProps.type
        if (type === 'top') {
          scaleY = 0.5
          offY = 0.25
        } else if (type === 'double') {
          scaleY = 1
          offY = 0
        } else {
          scaleY = 0.5
          offY = -0.25
        }
      } else if (/trapdoor/.test(bName)) {
        const isOpen = bProps.open === 'true'
        const half = bProps.half || 'bottom'
        const facing = bProps.facing || 'north'
        if (isOpen) {
          if (facing === 'north') {
            scaleX = 1; scaleY = 1; scaleZ = 0.1875
            offZ = -0.40625
          } else if (facing === 'south') {
            scaleX = 1; scaleY = 1; scaleZ = 0.1875
            offZ = 0.40625
          } else if (facing === 'west') {
            scaleX = 0.1875; scaleY = 1; scaleZ = 1
            offX = -0.40625
          } else {
            scaleX = 0.1875; scaleY = 1; scaleZ = 1
            offX = 0.40625
          }
        } else {
          scaleX = 1; scaleY = 0.1875; scaleZ = 1
          offY = half === 'top' ? 0.40625 : -0.40625
        }
      } else if (/lantern/.test(bName)) {
        scaleX = 0.45; scaleY = 0.5625; scaleZ = 0.45
        const isHanging = bProps.hanging !== undefined
          ? bProps.hanging === 'true'
          : hasVoxel(vx, vy + 1, vz)
        offY = isHanging ? 0.21875 : -0.21875
      } else if (/chain/.test(bName)) {
        const axis = bProps.axis || (hasVoxel(vx + 1, vy, vz) || hasVoxel(vx - 1, vy, vz) ? 'x' : hasVoxel(vx, vy, vz + 1) || hasVoxel(vx, vy, vz - 1) ? 'z' : 'y')
        if (axis === 'x') {
          scaleX = 1; scaleY = 0.1875; scaleZ = 0.1875
        } else if (axis === 'z') {
          scaleX = 0.1875; scaleY = 0.1875; scaleZ = 1
        } else {
          scaleX = 0.1875; scaleY = 1; scaleZ = 0.1875
        }
      } else if (/_bars|_pane/.test(bName)) {
        const hasN = bProps.north !== undefined ? bProps.north === 'true' : hasVoxel(vx, vy, vz - 1)
        const hasS = bProps.south !== undefined ? bProps.south === 'true' : hasVoxel(vx, vy, vz + 1)
        const hasE = bProps.east !== undefined ? bProps.east === 'true' : hasVoxel(vx + 1, vy, vz)
        const hasW = bProps.west !== undefined ? bProps.west === 'true' : hasVoxel(vx - 1, vy, vz)
        const hasNS = hasN || hasS
        const hasEW = hasE || hasW
        if (hasEW && !hasNS) {
          scaleX = 1; scaleY = 1; scaleZ = 0.125
        } else if (hasNS && !hasEW) {
          scaleX = 0.125; scaleY = 1; scaleZ = 1
        } else if (hasNS && hasEW) {
          scaleX = 0.35; scaleY = 1; scaleZ = 0.35
        } else {
          scaleX = 0.1875; scaleY = 1; scaleZ = 0.1875
        }
      } else if (/_fence/.test(bName)) {
        const hasN = bProps.north !== undefined ? bProps.north === 'true' : hasVoxel(vx, vy, vz - 1)
        const hasS = bProps.south !== undefined ? bProps.south === 'true' : hasVoxel(vx, vy, vz + 1)
        const hasE = bProps.east !== undefined ? bProps.east === 'true' : hasVoxel(vx + 1, vy, vz)
        const hasW = bProps.west !== undefined ? bProps.west === 'true' : hasVoxel(vx - 1, vy, vz)
        const hasNS = hasN || hasS
        const hasEW = hasE || hasW
        if (hasEW && !hasNS) {
          scaleX = 1; scaleY = 1; scaleZ = 0.25
        } else if (hasNS && !hasEW) {
          scaleX = 0.25; scaleY = 1; scaleZ = 1
        } else if (hasNS && hasEW) {
          scaleX = 0.375; scaleY = 1; scaleZ = 0.375
        } else {
          scaleX = 0.25; scaleY = 1; scaleZ = 0.25
        }
      } else if (/_wall/.test(bName)) {
        const hasN = bProps.north !== undefined && bProps.north !== 'none' ? true : hasVoxel(vx, vy, vz - 1)
        const hasS = bProps.south !== undefined && bProps.south !== 'none' ? true : hasVoxel(vx, vy, vz + 1)
        const hasE = bProps.east !== undefined && bProps.east !== 'none' ? true : hasVoxel(vx + 1, vy, vz)
        const hasW = bProps.west !== undefined && bProps.west !== 'none' ? true : hasVoxel(vx - 1, vy, vz)
        const hasNS = hasN || hasS
        const hasEW = hasE || hasW
        if (hasEW && !hasNS) {
          scaleX = 1; scaleY = 1; scaleZ = 0.375
        } else if (hasNS && !hasEW) {
          scaleX = 0.375; scaleY = 1; scaleZ = 1
        } else if (hasNS && hasEW) {
          scaleX = 0.5; scaleY = 1; scaleZ = 0.5
        } else {
          scaleX = 0.375; scaleY = 1; scaleZ = 0.375
        }
      }

      dummy.scale.set(scaleX, scaleY, scaleZ)
      dummy.position.set(
        vx - cx + 0.5 + offX,
        vy - cy + 0.5 + offY,
        vz - cz + 0.5 + offZ,
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

  // Seed yaw/pitch from initial look-at so dragging continues smoothly
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
  window.addEventListener('blur', onWindowBlur)

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
  activeActions.clear()
  dragging = false
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  window.removeEventListener('blur', onWindowBlur)
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
  for (const m of ownedMaterials) {
    if (Array.isArray(m)) {
      for (const item of m) (item as THREE.Material).dispose()
    } else {
      (m as THREE.Material).dispose()
    }
  }
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
  z-index: 2;
}

.blueprint-preview__chip {
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(24, 24, 27, 0.75);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
}

.blueprint-preview__chip--loading {
  display: inline-flex;
  align-items: center;
  color: var(--v-theme-primary);
}

.blueprint-preview__controls {
  position: absolute;
  right: 8px;
  bottom: 8px;
  font-size: 12px;
  opacity: 0.6;
  pointer-events: none;
  background: rgba(24, 24, 27, 0.6);
  backdrop-filter: blur(6px);
  padding: 2px 6px;
  border-radius: 4px;
  z-index: 2;
}
</style>
