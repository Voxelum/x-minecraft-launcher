<template>
  <div class="blueprint-preview">
    <div ref="container" class="blueprint-preview__canvas" />
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
  </div>
</template>

<script lang="ts" setup>
import { useService } from '@/composables/service'
import { InstanceBlueprintsServiceKey } from '@xmcl/runtime-api'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = defineProps<{
  instancePath: string
  size: { x: number; y: number; z: number }
  palette: { name: string; properties?: Record<string, string> }[]
  voxels: number[]
}>()

const { t } = useI18n()
const { getBlockTextures } = useService(InstanceBlueprintsServiceKey)

const container = ref<HTMLDivElement>()
const loading = ref(true)
const errorText = ref('')
const blockCount = ref(0)
const size = reactive({ x: 0, y: 0, z: 0 })

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let frame = 0
let resizeObserver: ResizeObserver | undefined
let disposed = false

const sharedGeometry = new THREE.BoxGeometry(1, 1, 1)
const ownedMaterials: THREE.Material[] = []
const ownedTextures: THREE.Texture[] = []

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

function makeTexture(base64: string): THREE.Texture {
  const image = new Image()
  const texture = new THREE.Texture(image)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  ;(texture as any).colorSpace = (THREE as any).SRGBColorSpace
  image.onload = () => { texture.needsUpdate = true }
  image.src = `data:image/png;base64,${base64}`
  ownedTextures.push(texture)
  return texture
}

async function build() {
  loading.value = true
  errorText.value = ''
  try {
    const preview = { size: props.size, palette: props.palette, voxels: props.voxels }
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

    const usedNames = [...new Set(preview.palette.map((p) => p.name))]
      .filter((n) => n && n !== 'minecraft:air')
    const textures = await getBlockTextures(props.instancePath, usedNames).catch(() => ({} as Record<string, string>))

    // Build one material per palette index, using the real jar texture when
    // available and falling back to a solid color otherwise.
    const paletteMaterials = preview.palette.map((state) => {
      const name = state.name
      const base64 = textures[name]
      const material = new THREE.MeshLambertMaterial(
        base64
          ? { map: makeTexture(base64) }
          : { color: fallbackColor(name) },
      )
      if (isTranslucent(name)) {
        material.transparent = true
        material.opacity = 0.7
        material.depthWrite = false
      } else if (base64 && isCutout(name)) {
        material.alphaTest = 0.5
        material.transparent = false
      } else if (base64) {
        // Drop fully transparent texels (e.g. pane atlases) without sorting.
        material.alphaTest = 0.1
      }
      ownedMaterials.push(material)
      return material
    })

    if (disposed) return
    setupScene(preview, paletteMaterials)
  } catch (e) {
    errorText.value = (e as Error).message || String(e)
  } finally {
    loading.value = false
  }
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

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)

  resizeObserver = new ResizeObserver(() => onResize())
  resizeObserver.observe(el)

  const animate = () => {
    if (disposed) return
    frame = requestAnimationFrame(animate)
    controls?.update()
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
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  controls?.dispose()
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
  for (const m of ownedMaterials) m.dispose()
  for (const tx of ownedTextures) tx.dispose()
  ownedMaterials.length = 0
  ownedTextures.length = 0
  renderer = undefined
  scene = undefined
  camera = undefined
  controls = undefined
}

onMounted(build)
onBeforeUnmount(() => {
  dispose()
  sharedGeometry.dispose()
})

watch(() => [props.instancePath, props.voxels], () => {
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
</style>
