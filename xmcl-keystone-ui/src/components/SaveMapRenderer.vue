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
      
      <div class="controls mt-4">
        <v-btn 
          small 
          @click="loadMap"
          :loading="loading"
        >
          {{ t('save.loadMap') }}
        </v-btn>
        
        <v-chip small class="ml-2" v-if="loaded">
          {{ t('save.mapLoaded') }}
        </v-chip>
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps<{
  savePath: string
}>()

const { t } = useI18n()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
const loaded = ref(false)

// Placeholder for deepslate integration
// This will be expanded with actual deepslate rendering logic
const loadMap = async () => {
  if (!canvasRef.value) return
  
  loading.value = true
  
  try {
    // TODO: Implement actual deepslate rendering
    // For now, show a placeholder message
    const ctx = canvasRef.value.getContext('2d')
    if (!ctx) return
    
    // Clear canvas
    ctx.fillStyle = '#2d2d2d'
    ctx.fillRect(0, 0, 800, 600)
    
    // Draw placeholder text
    ctx.fillStyle = '#ffffff'
    ctx.font = '24px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Map Renderer (Deepslate Integration)', 400, 280)
    ctx.font = '16px sans-serif'
    ctx.fillText(`Save Path: ${props.savePath}`, 400, 320)
    ctx.fillText('Full implementation coming soon...', 400, 360)
    
    loaded.value = true
  } catch (error) {
    console.error('Failed to load map:', error)
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
}
</style>
