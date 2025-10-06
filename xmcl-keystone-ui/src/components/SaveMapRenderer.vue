<template>
  <v-card class="map-renderer">
    <v-card-title>
      {{ t('save.mapPreview') }}
    </v-card-title>
    
    <v-card-text>
      <div class="map-container">
        <div 
          ref="mapContainer" 
          class="leaflet-map"
          style="width: 100%; height: 600px; border: 1px solid #ccc; border-radius: 4px;"
        />
      </div>
      
      <div class="controls mt-4 flex items-center gap-2">
        <v-btn 
          small 
          @click="loadMap"
          :loading="loading"
          :disabled="loading"
        >
          {{ t('save.loadMap') }}
        </v-btn>
        
        <v-chip small v-if="loaded && !error">
          {{ t('save.mapLoaded') }}
        </v-chip>
        
        <v-chip small color="error" v-if="error">
          {{ t('save.mapError') }}: {{ errorMessage }}
        </v-chip>
      </div>
      
      <div class="info mt-2 text-sm text-gray-600" v-if="loaded && !error">
        <p>{{ t('save.mapInfo') }}</p>
        <ul class="ml-4 mt-1">
          <li>{{ t('save.useMouseDrag') }}</li>
          <li>{{ t('save.useScrollZoom') }}</li>
        </ul>
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { 
  BiomeSource, 
  Identifier, 
  Climate, 
  NoiseGeneratorSettings, 
  RandomState,
  WorldgenRegistries,
  DensityFunction,
  Holder,
  NoiseParameters,
} from 'deepslate'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'
import { useService } from '../composables/service'

const props = defineProps<{
  savePath: string
}>()

const { t } = useI18n()
const { getWorldGenSettings } = useService(InstanceSavesServiceKey)
const mapContainer = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const loaded = ref(false)
const error = ref(false)
const errorMessage = ref('')

// Simple biome color map (you can expand this)
const BIOME_COLORS: Record<string, { r: number; g: number; b: number }> = {
  'minecraft:plains': { r: 141, g: 179, b: 96 },
  'minecraft:forest': { r: 5, g: 102, b: 33 },
  'minecraft:desert': { r: 250, g: 148, b: 24 },
  'minecraft:mountains': { r: 96, g: 96, b: 96 },
  'minecraft:ocean': { r: 0, g: 105, b: 148 },
  'minecraft:deep_ocean': { r: 0, g: 85, b: 128 },
  'minecraft:river': { r: 0, g: 125, b: 255 },
  'minecraft:swamp': { r: 7, g: 249, b: 178 },
  'minecraft:taiga': { r: 11, g: 102, b: 89 },
  'minecraft:snowy_tundra': { r: 255, g: 255, b: 255 },
  'minecraft:snowy_plains': { r: 255, g: 255, b: 255 },
  'minecraft:savanna': { r: 189, g: 178, b: 95 },
  'minecraft:badlands': { r: 217, g: 69, b: 21 },
  'minecraft:jungle': { r: 89, g: 138, b: 27 },
  'minecraft:birch_forest': { r: 48, g: 116, b: 68 },
  'minecraft:dark_forest': { r: 64, g: 81, b: 26 },
  'minecraft:mushroom_fields': { r: 255, g: 0, b: 255 },
  'minecraft:beach': { r: 250, g: 222, b: 85 },
  'minecraft:frozen_ocean': { r: 112, g: 112, b: 214 },
  'minecraft:frozen_river': { r: 160, g: 160, b: 255 },
  'minecraft:ice_spikes': { r: 180, g: 220, b: 220 },
  'minecraft:stony_shore': { r: 162, g: 162, b: 132 },
}

// Hash function for generating colors from biome IDs
const hashCode = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

// Get biome color with fallback to hash-based color
const getBiomeColor = (biomeId: string): { r: number; g: number; b: number } => {
  const color = BIOME_COLORS[biomeId]
  if (color) return color
  
  // Generate color from hash
  const hash = Math.abs(hashCode(biomeId))
  return {
    r: (hash & 0xFF0000) >> 16,
    g: (hash & 0x00FF00) >> 8,
    b: hash & 0x0000FF,
  }
}

// Render a 2D biome map on canvas
const renderBiomeMap = (
  canvas: HTMLCanvasElement,
  biomeSource: BiomeSource,
  sampler: Climate.Sampler,
  centerX: number,
  centerZ: number,
  scale: number,
) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  const width = canvas.width
  const height = canvas.height
  
  // Clear canvas
  ctx.fillStyle = '#a5d6a7'
  ctx.fillRect(0, 0, width, height)
  
  // Render biomes
  for (let px = 0; px < width; px++) {
    for (let py = 0; py < height; py++) {
      // Convert pixel to world coordinates
      const worldX = Math.floor(centerX + (px - width / 2) * scale)
      const worldZ = Math.floor(centerZ + (py - height / 2) * scale)
      
      // Get biome at this position (divide by 4 for biome coordinates)
      const biomeX = Math.floor(worldX / 4)
      const biomeZ = Math.floor(worldZ / 4)
      const biomeY = 64 / 4 // Sea level for biome sampling
      
      try {
        const biome = biomeSource.getBiome(biomeX, biomeY, biomeZ, sampler)
        const color = getBiomeColor(biome.toString())
        
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`
        ctx.fillRect(px, py, 1, 1)
      } catch (err) {
        // Fallback color for errors
        ctx.fillStyle = '#808080'
        ctx.fillRect(px, py, 1, 1)
      }
    }
  }
}

const loadMap = async () => {
  if (!mapContainer.value) return
  
  loading.value = true
  error.value = false
  errorMessage.value = ''
  
  try {
    // Create canvas for rendering
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.imageRendering = 'pixelated'
    canvas.style.cursor = 'grab'
    
    mapContainer.value.innerHTML = ''
    mapContainer.value.appendChild(canvas)
    
    // Read world generation settings from save
    const worldGenSettings = await getWorldGenSettings(props.savePath)
    
    if (!worldGenSettings) {
      throw new Error('Failed to read world generation settings from save file')
    }
    
    // Get the overworld dimension (or fallback to first available dimension)
    const dimensionKey = 'minecraft:overworld'
    const dimension = worldGenSettings.dimensions[dimensionKey] || Object.values(worldGenSettings.dimensions)[0]
    
    if (!dimension) {
      throw new Error('No dimension data found in world generation settings')
    }
    
    const generator = dimension.generator
    
    // Register density functions and noises if provided
    if (generator.settings) {
      // Parse noise settings
      const noiseSettingsJson = typeof generator.settings === 'string' 
        ? JSON.parse(generator.settings) 
        : generator.settings
        
      // Create noise generator settings and random state
      const noiseSettings = NoiseGeneratorSettings.fromJson(noiseSettingsJson)
      const randomState = new RandomState(noiseSettings, worldGenSettings.seed)
      
      // Create climate sampler from the random state
      const sampler = Climate.Sampler.fromRouter(randomState.router)
      
      // Parse biome source
      let biomeSource: BiomeSource
      
      if (generator.biome_source) {
        const biomeSourceJson = typeof generator.biome_source === 'string'
          ? JSON.parse(generator.biome_source)
          : generator.biome_source
        
        biomeSource = BiomeSource.fromJson(biomeSourceJson)
      } else {
        // Fallback to a simple fixed biome if no biome source
        throw new Error('No biome source found in generator settings')
      }
      
      // State for panning
      let centerX = 0
      let centerZ = 0
      let scale = 4
      let isDragging = false
      let lastX = 0
      let lastY = 0
      
      const render = () => {
        renderBiomeMap(canvas, biomeSource, sampler, centerX, centerZ, scale)
      }
      
      // Mouse controls
      canvas.addEventListener('mousedown', (e) => {
        isDragging = true
        lastX = e.clientX
        lastY = e.clientY
        canvas.style.cursor = 'grabbing'
      })
      
      canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return
        
        const dx = e.clientX - lastX
        const dy = e.clientY - lastY
        
        centerX -= dx * scale
        centerZ -= dy * scale
        
        lastX = e.clientX
        lastY = e.clientY
        
        render()
      })
      
      canvas.addEventListener('mouseup', () => {
        isDragging = false
        canvas.style.cursor = 'grab'
      })
      
      canvas.addEventListener('mouseleave', () => {
        isDragging = false
        canvas.style.cursor = 'grab'
      })
      
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault()
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9
        scale *= zoomFactor
        scale = Math.max(0.25, Math.min(32, scale))
        render()
      })
      
      // Initial render
      render()
      
      loaded.value = true
    } else {
      throw new Error('Generator settings not found in dimension data')
    }
  } catch (err) {
    console.error('Failed to load map:', err)
    error.value = true
    errorMessage.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // Auto-load on mount
  if (props.savePath) {
    setTimeout(() => loadMap(), 500)
  }
})

onUnmounted(() => {
  // Cleanup
  if (mapContainer.value) {
    mapContainer.value.innerHTML = ''
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
  position: relative;
  background: #a5d6a7;
  border-radius: 4px;
}

.leaflet-map {
  position: relative;
}
</style>
