<template>
  <v-card class="map-renderer">
    <v-card-title>
      {{ t('save.mapPreview') }}
    </v-card-title>
    
    <v-card-text>
      <div class="map-container">
        <canvas 
          ref="canvasRef" 
          width="800" 
          height="600"
          style="width: 100%; max-width: 800px; height: auto; border: 1px solid #ccc;"
        />
      </div>
      
      <div class="controls mt-4 flex items-center gap-2">
        <v-btn 
          small 
          @click="loadMap"
          :loading="loading"
          :disabled="loading || rendering"
        >
          {{ t('save.loadMap') }}
        </v-btn>
        
        <v-chip small v-if="loaded && !error">
          {{ t('save.mapLoaded') }}
        </v-chip>
        
        <v-chip small color="error" v-if="error">
          {{ t('save.mapError') }}: {{ errorMessage }}
        </v-chip>
        
        <v-chip small color="info" v-if="rendering">
          {{ t('save.rendering') }}
        </v-chip>
      </div>
      
      <div class="info mt-2 text-sm text-gray-600" v-if="loaded && !error">
        <p>{{ t('save.mapInfo') }}</p>
        <ul class="ml-4 mt-1">
          <li>{{ t('save.useMouseRotate') }}</li>
          <li>{{ t('save.useScrollZoom') }}</li>
        </ul>
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { Structure, StructureRenderer } from 'deepslate'
import { mat4 } from 'gl-matrix'

const props = defineProps<{
  savePath: string
}>()

const { t } = useI18n()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
const loaded = ref(false)
const rendering = ref(false)
const error = ref(false)
const errorMessage = ref('')

let renderer: StructureRenderer | null = null
let gl: WebGLRenderingContext | null = null
let animationFrameId: number | null = null

// Camera state
const camera = ref({
  rotation: { x: -30, y: 45 },
  distance: 50,
  isDragging: false,
  lastX: 0,
  lastY: 0,
})

// Create a simple resources provider for deepslate
const createBasicResources = () => {
  return {
    getBlockDefinition: () => null,
    getBlockModel: () => null,
    getTextureAtlas: () => null,
    getBlockFlags: () => ({ opaque: true }),
    getBlockProperties: () => null,
    getDefaultBlockProperties: () => null,
  }
}

// Create a sample structure to demonstrate rendering
const createSampleStructure = () => {
  // Create a 16x16x16 structure as a sample
  const structure = new Structure([16, 16, 16])
  
  // Add some blocks to create a simple pattern
  // This is a demonstration - in a full implementation, 
  // we would read actual chunk data from the save
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      // Create a simple terrain pattern
      const height = Math.floor(Math.sin(x * 0.3) * Math.cos(z * 0.3) * 3 + 8)
      
      // Bedrock layer
      structure.addBlock([x, 0, z], 'minecraft:bedrock')
      
      // Stone layers
      for (let y = 1; y < height - 3; y++) {
        structure.addBlock([x, y, z], 'minecraft:stone')
      }
      
      // Dirt layers
      for (let y = Math.max(1, height - 3); y < height - 1; y++) {
        structure.addBlock([x, y, z], 'minecraft:dirt')
      }
      
      // Grass top
      if (height > 1) {
        structure.addBlock([x, height - 1, z], 'minecraft:grass_block')
      }
    }
  }
  
  // Add some trees
  for (let i = 0; i < 3; i++) {
    const x = 3 + i * 5
    const z = 3 + i * 5
    const groundHeight = Math.floor(Math.sin(x * 0.3) * Math.cos(z * 0.3) * 3 + 8)
    
    // Tree trunk
    for (let y = 0; y < 4; y++) {
      structure.addBlock([x, groundHeight + y, z], 'minecraft:oak_log')
    }
    
    // Simple leaves
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = 0; dy < 3; dy++) {
          if (x + dx >= 0 && x + dx < 16 && z + dz >= 0 && z + dz < 16) {
            if (Math.abs(dx) + Math.abs(dz) < 4) {
              structure.addBlock([x + dx, groundHeight + 3 + dy, z + dz], 'minecraft:oak_leaves')
            }
          }
        }
      }
    }
  }
  
  return structure
}

const loadMap = async () => {
  if (!canvasRef.value) return
  
  loading.value = true
  error.value = false
  errorMessage.value = ''
  
  try {
    // Get WebGL context
    gl = canvasRef.value.getContext('webgl')
    if (!gl) {
      throw new Error('WebGL not supported')
    }
    
    rendering.value = true
    
    // In a full implementation, we would:
    // 1. Read the world data from props.savePath
    // 2. Parse region files and chunk data
    // 3. Create structures from actual world chunks
    //
    // For now, we'll create a sample structure to demonstrate
    // the rendering capabilities
    
    const structure = createSampleStructure()
    const resources = createBasicResources()
    
    // Create renderer
    renderer = new StructureRenderer(gl, structure, resources as any)
    
    loaded.value = true
    rendering.value = false
    
    // Start render loop
    startRenderLoop()
  } catch (err) {
    console.error('Failed to load map:', err)
    error.value = true
    errorMessage.value = err instanceof Error ? err.message : 'Unknown error'
    rendering.value = false
  } finally {
    loading.value = false
  }
}

const startRenderLoop = () => {
  if (!gl || !renderer || !canvasRef.value) return
  
  const render = () => {
    if (!gl || !renderer || !canvasRef.value) return
    
    // Clear canvas
    gl.viewport(0, 0, canvasRef.value.width, canvasRef.value.height)
    gl.clearColor(0.53, 0.81, 0.92, 1.0) // Sky blue
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)
    
    // Create view matrix
    const view = mat4.create()
    mat4.translate(view, view, [0, 0, -camera.value.distance])
    mat4.rotateX(view, view, camera.value.rotation.x * Math.PI / 180)
    mat4.rotateY(view, view, camera.value.rotation.y * Math.PI / 180)
    mat4.translate(view, view, [-8, -8, -8]) // Center the structure
    
    // Draw structure
    try {
      renderer.drawStructure(view)
    } catch (err) {
      console.error('Render error:', err)
    }
    
    animationFrameId = requestAnimationFrame(render)
  }
  
  render()
}

// Mouse controls
const onMouseDown = (e: MouseEvent) => {
  camera.value.isDragging = true
  camera.value.lastX = e.clientX
  camera.value.lastY = e.clientY
}

const onMouseMove = (e: MouseEvent) => {
  if (!camera.value.isDragging) return
  
  const dx = e.clientX - camera.value.lastX
  const dy = e.clientY - camera.value.lastY
  
  camera.value.rotation.y += dx * 0.5
  camera.value.rotation.x += dy * 0.5
  
  // Clamp rotation
  camera.value.rotation.x = Math.max(-89, Math.min(89, camera.value.rotation.x))
  
  camera.value.lastX = e.clientX
  camera.value.lastY = e.clientY
}

const onMouseUp = () => {
  camera.value.isDragging = false
}

const onWheel = (e: WheelEvent) => {
  e.preventDefault()
  camera.value.distance += e.deltaY * 0.05
  camera.value.distance = Math.max(10, Math.min(200, camera.value.distance))
}

onMounted(() => {
  if (canvasRef.value) {
    canvasRef.value.addEventListener('mousedown', onMouseDown)
    canvasRef.value.addEventListener('mousemove', onMouseMove)
    canvasRef.value.addEventListener('mouseup', onMouseUp)
    canvasRef.value.addEventListener('mouseleave', onMouseUp)
    canvasRef.value.addEventListener('wheel', onWheel)
  }
  
  // Auto-load on mount
  if (props.savePath) {
    setTimeout(() => loadMap(), 500)
  }
})

onUnmounted(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
  
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('mousedown', onMouseDown)
    canvasRef.value.removeEventListener('mousemove', onMouseMove)
    canvasRef.value.removeEventListener('mouseup', onMouseUp)
    canvasRef.value.removeEventListener('mouseleave', onMouseUp)
    canvasRef.value.removeEventListener('wheel', onWheel)
  }
})

watch(() => props.savePath, () => {
  loaded.value = false
  if (props.savePath) {
    loadMap()
  }
})
</script>

<style scoped>
.map-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

canvas {
  background: #1e1e1e;
  border-radius: 4px;
  cursor: grab;
}

canvas:active {
  cursor: grabbing;
}
</style>
