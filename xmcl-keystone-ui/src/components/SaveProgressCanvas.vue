<template>
  <div class="h-full flex flex-col overflow-hidden relative select-none">
    <!-- Top Toolbar -->
    <div class="flex items-center justify-between px-3 py-1.5 border-b border-white/10 gap-2 flex-wrap flex-shrink-0 bg-neutral-900/60 z-20">
      <!-- Category Mode & Progress -->
      <div class="flex items-center gap-2">
        <template v-if="!category">
          <v-btn-toggle
            v-if="hasQuests && hasAdvancements"
            v-model="activeCategory"
            mandatory
            density="compact"
            variant="outlined"
            rounded="lg"
          >
            <v-btn value="quests" size="small">
              <v-icon start size="16">military_tech</v-icon>
              {{ t('save.progress.quests') }}
            </v-btn>
            <v-btn value="advancements" size="small">
              <v-icon start size="16">emoji_events</v-icon>
              {{ t('save.progress.advancements') }}
            </v-btn>
          </v-btn-toggle>
          <div v-else class="flex items-center gap-1.5 font-semibold text-xs" :class="hasQuests ? 'text-amber-400' : 'text-emerald-400'">
            <v-icon size="16">{{ hasQuests ? 'military_tech' : 'emoji_events' }}</v-icon>
            <span>{{ hasQuests ? t('save.progress.quests') : t('save.progress.advancements') }}</span>
          </div>
        </template>

        <v-chip
          size="x-small"
          variant="tonal"
          :color="activeTabStats.completed === activeTabStats.total && activeTabStats.total > 0 ? 'success' : undefined"
          class="font-mono font-bold"
        >
          {{ activeTabStats.completed }} / {{ activeTabStats.total }} ({{ activeTabStats.percent }}%)
        </v-chip>
      </div>

      <!-- Controls: Search, Zoom, Mode, Modal -->
      <div class="flex items-center gap-1.5">
        <v-text-field
          v-model="searchQuery"
          density="compact"
          variant="outlined"
          hide-details
          prepend-inner-icon="search"
          :placeholder="t('save.progress.filterPlaceholder')"
          class="w-32 sm:w-44 text-xs"
          clearable
        />

        <!-- Zoom Controls -->
        <div v-if="viewMode === 'graph'" class="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
          <v-btn icon size="x-small" variant="text" @click="zoomOut">
            <v-icon size="14">remove</v-icon>
          </v-btn>
          <span class="text-[10px] font-mono px-1 min-w-[32px] text-center">{{ Math.round(scale * 100) }}%</span>
          <v-btn icon size="x-small" variant="text" @click="zoomIn">
            <v-icon size="14">add</v-icon>
          </v-btn>
          <v-btn icon size="x-small" variant="text" @click="centerCamera">
            <v-icon size="14">center_focus_strong</v-icon>
          </v-btn>
        </div>

        <!-- View Mode Switcher -->
        <v-btn-toggle v-model="viewMode" mandatory density="compact" variant="outlined" rounded="lg">
          <v-btn value="graph" size="small" :title="t('save.progress.treeView')">
            <v-icon size="16">hub</v-icon>
          </v-btn>
          <v-btn value="list" size="small" :title="t('save.progress.listView')">
            <v-icon size="16">view_list</v-icon>
          </v-btn>
        </v-btn-toggle>

        <!-- Full Window Modal Button -->
        <v-btn
          icon
          size="small"
          variant="text"
          :title="isModal ? t('save.progress.exitFullscreen') : t('save.progress.fullscreen')"
          @click="toggleModal"
        >
          <v-icon size="18">{{ isModal ? 'close_fullscreen' : 'open_in_full' }}</v-icon>
        </v-btn>
      </div>
    </div>

    <!-- Chapter / Branch Tabs (Native Launcher v-tabs) -->
    <div v-if="currentTabs.length > 1" class="border-b border-white/10 bg-neutral-900/30 flex-shrink-0 z-10 px-2">
      <v-tabs
        v-model="selectedTabId"
        density="compact"
        bg-color="transparent"
        show-arrows
        class="chapter-tabs"
      >
        <v-tab
          v-for="tab in currentTabs"
          :key="tab.id"
          :value="tab.id"
          class="text-xs font-medium"
        >
          <img v-if="tab.iconDataUrl" :src="tab.iconDataUrl" class="w-4 h-4 mr-1.5 pixelated object-contain flex-shrink-0" />
          <v-icon v-else size="15" class="mr-1.5 flex-shrink-0">{{ tab.fallbackIcon || 'military_tech' }}</v-icon>
          <span class="truncate max-w-[140px]">{{ tab.title }}</span>
          <v-chip
            size="x-small"
            variant="tonal"
            class="ml-2 font-mono text-[10px] flex-shrink-0"
            :color="tab.completed === tab.total && tab.total > 0 ? 'success' : undefined"
          >
            {{ tab.completed }}/{{ tab.total }}
          </v-chip>
        </v-tab>
      </v-tabs>
    </div>

    <!-- Canvas Graph View -->
    <div
      v-if="viewMode === 'graph'"
      ref="canvasRef"
      class="progress-canvas flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @wheel.prevent="onWheel"
    >
      <div
        class="graph-world absolute inset-0 transform-gpu origin-top-left"
        :style="{ transform: `translate3d(${panX}px, ${panY}px, 0px) scale(${scale})` }"
      >
        <!-- Connecting Lines -->
        <svg class="absolute overflow-visible pointer-events-none" style="width: 1px; height: 1px; left: 0; top: 0;">
          <path
            v-for="(line, idx) in activeLines"
            :key="idx"
            :d="getLinePath(line)"
            :class="[
              activeCategory === 'advancements' ? 'adv-line' : 'ftb-line',
              { 'line--done': line.done, 'line--locked': line.locked },
            ]"
          />
        </svg>

        <!-- Nodes -->
        <div
          v-for="node in currentNodes"
          :key="node.id"
          class="absolute cursor-pointer transition-transform hover:scale-110"
          :style="{
            left: `${node.screenX}px`,
            top: `${node.screenY}px`,
            transform: 'translate(-50%, -50%)',
          }"
          @mouseenter="onNodeMouseEnter($event, node)"
          @mouseleave="onNodeMouseLeave"
          @click.stop="selectedNode = node"
        >
          <div
            class="progress-node flex items-center justify-center relative"
            :class="[
              activeCategory === 'advancements' ? `adv-frame--${node.shape}` : `ftb-shape--${node.shape}`,
              {
                'node--done': node.done,
                'node--locked': node.locked,
                'node--active': selectedNode?.id === node.id || hoveredNode?.id === node.id,
              },
            ]"
          >
            <!-- SVG gear teeth background for gear nodes -->
            <svg v-if="node.shape === 'gear'" viewBox="0 0 64 64" class="absolute inset-0 w-full h-full pointer-events-none">
              <path
                d="M26,4 L38,4 L39.5,11.5 L44.5,13.5 L50,8.5 L58.5,17 L53.5,22.5 L55.5,27.5 L63,29 L63,41 L55.5,42.5 L53.5,47.5 L58.5,53 L50,61.5 L44.5,56.5 L39.5,58.5 L38,66 L26,66 L24.5,58.5 L19.5,56.5 L14,61.5 L5.5,53 L10.5,47.5 L8.5,42.5 L1,41 L1,29 L8.5,27.5 L10.5,22.5 L5.5,17 L14,8.5 L19.5,13.5 L24.5,11.5 Z"
                class="gear-path"
              />
            </svg>

            <!-- Icon -->
            <img v-if="node.iconDataUrl" :src="node.iconDataUrl" class="w-6 h-6 pixelated object-contain relative z-1" />
            <v-icon v-else size="20" :color="node.done ? 'amber' : 'grey'" class="relative z-1">{{ node.fallbackIcon }}</v-icon>

            <!-- Lock badge for locked/uncompleted items -->
            <div v-if="node.locked" class="lock-badge">
              <v-icon size="9" color="grey-lighten-2">lock</v-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- Drag Hint (Floating Bottom Left) -->
      <div class="absolute bottom-3 left-3 pointer-events-none text-[10px] text-neutral-400 font-mono flex items-center gap-1 bg-black/60 backdrop-blur px-2.5 py-1 rounded border border-white/5">
        <v-icon size="12">pan_tool</v-icon>
        <span>{{ t('save.mapHintPan') }}</span>
      </div>

      <!-- Stats Bar (Floating Bottom Right - Native Launcher Overlay) -->
      <div
        v-if="hasStats"
        class="absolute bottom-3 right-3 flex items-center gap-3 rounded bg-black/60 px-3 py-1 text-xs text-neutral-300 backdrop-blur border border-white/10 pointer-events-none z-10 font-mono"
      >
        <span class="flex items-center gap-1"><v-icon size="13" color="cyan">schedule</v-icon> {{ formattedPlayTime }}</span>
        <span class="flex items-center gap-1"><v-icon size="13" color="red">heart_broken</v-icon> {{ progress?.stats?.deaths ?? 0 }}</span>
        <span class="flex items-center gap-1"><v-icon size="13" color="amber">swords</v-icon> {{ progress?.stats?.mobKills ?? 0 }}</span>
        <span class="flex items-center gap-1"><v-icon size="13" color="emerald">construction</v-icon> {{ progress?.stats?.minedBlocksTotal ?? 0 }}</span>
      </div>
    </div>

    <!-- Tooltip Hover Card -->
    <transition name="fade">
      <div
        v-if="hoveredNode"
        class="absolute pointer-events-none z-30"
        :style="{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }"
      >
        <v-card class="p-2.5 flex flex-col gap-1 shadow-2xl max-w-xs border border-white/10" color="surface">
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold text-xs text-amber-300">{{ hoveredNode.title }}</span>
            <v-chip
              size="x-small"
              :color="hoveredNode.done ? 'success' : hoveredNode.locked ? 'grey' : 'amber'"
              variant="flat"
              class="font-bold text-[10px]"
            >
              {{ hoveredNode.done ? t('save.progress.done') : hoveredNode.locked ? 'Locked' : t('save.progress.inProgress') }}
            </v-chip>
          </div>
          <span v-if="hoveredNode.subtitle" class="text-[11px] text-purple-300 italic">{{ hoveredNode.subtitle }}</span>
          <p v-if="hoveredNode.description" class="text-[11px] text-neutral-300 whitespace-pre-line leading-snug">{{ hoveredNode.description }}</p>
          <div class="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] font-mono text-neutral-400">
            <span v-if="hoveredNode.tasksCount !== undefined">{{ hoveredNode.tasksCompleted }}/{{ hoveredNode.tasksCount }}</span>
            <span v-if="hoveredNode.completedTime" class="ml-auto">{{ hoveredNode.completedTime }}</span>
          </div>
        </v-card>
      </div>
    </transition>

    <!-- Alternative List View -->
    <div v-if="viewMode === 'list'" class="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
      <div
        v-for="item in currentNodes"
        :key="item.id"
        class="p-2.5 rounded-lg flex items-center justify-between bg-white/5 border border-white/10 hover:border-white/20 transition-all"
        :class="{ 'border-emerald-500/40 bg-emerald-950/10': item.done, 'opacity-60': item.locked }"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded flex items-center justify-center bg-black/40 border border-white/10 flex-shrink-0">
            <img v-if="item.iconDataUrl" :src="item.iconDataUrl" class="w-6 h-6 pixelated object-contain" />
            <v-icon v-else size="18" :color="item.done ? 'emerald-accent-3' : 'grey'">{{ item.fallbackIcon }}</v-icon>
          </div>
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-bold text-xs text-neutral-100 truncate">{{ item.title }}</span>
              <v-chip v-if="item.subtitle" size="x-small" variant="text" class="text-purple-300 italic text-[10px]">{{ item.subtitle }}</v-chip>
            </div>
            <span v-if="item.description" class="text-[11px] text-neutral-400 truncate max-w-lg">{{ item.description }}</span>
          </div>
        </div>
        <v-chip
          size="x-small"
          :color="item.done ? 'success' : item.locked ? 'grey' : 'amber'"
          variant="tonal"
          class="font-bold text-[10px] flex-shrink-0 ml-3"
        >
          {{ item.done ? t('save.progress.done') : item.locked ? 'Locked' : t('save.progress.inProgress') }}
        </v-chip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { InstanceSaveProgress } from '@xmcl/runtime-api'
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  progress?: InstanceSaveProgress
  isModal?: boolean
  category?: 'quests' | 'advancements'
}>()

const emit = defineEmits<{
  (e: 'open-modal'): void
  (e: 'close-modal'): void
}>()

function toggleModal() {
  if (props.isModal) {
    emit('close-modal')
  } else {
    emit('open-modal')
  }
}

const { t } = useI18n()

function cleanTitle(title?: string): string {
  if (!title) return ''
  let cleaned = title
    .replace(/\{image:[^}]+\}/gi, '')
    .replace(/§[0-9a-fk-or]/gi, '')
    .replace(/&[0-9a-fk-or]/gi, '')
    .replace(/^[\p{Extended_Pictographic}\p{Emoji}\p{Symbol}\p{Punctuation}\s]+-\s*/u, '')
    .trim()
  return cleaned || title.trim()
}

const hasAdvancements = computed(() => (props.progress?.advancements?.items?.length ?? 0) > 0)
const hasQuests = computed(() => !!props.progress?.quests && props.progress.quests.chapters.length > 0)
const hasStats = computed(() => !!props.progress?.stats)

const activeCategory = ref<'quests' | 'advancements'>(props.category || 'advancements')
const selectedTabId = ref<string>('')
const viewMode = ref<'graph' | 'list'>('graph')
const searchQuery = ref('')
const selectedNode = ref<any>(null)
const hoveredNode = ref<any>(null)
const tooltipPos = ref({ x: 0, y: 0 })

const canvasRef = ref<HTMLElement | null>(null)
const panX = ref(100)
const panY = ref(100)
const scale = ref(1.0)
let isDragging = false
let startMouseX = 0
let startMouseY = 0
let initialPanX = 0
let initialPanY = 0

watch(() => props.category, (c) => {
  if (c) activeCategory.value = c
}, { immediate: true })

watch([hasQuests, hasAdvancements], ([q, a]) => {
  if (props.category) {
    activeCategory.value = props.category
    return
  }
  if (q) activeCategory.value = 'quests'
  else if (a) activeCategory.value = 'advancements'
}, { immediate: true })

interface TabInfo {
  id: string
  title: string
  icon?: string
  iconDataUrl?: string
  fallbackIcon?: string
  completed: number
  total: number
}

const currentTabs = computed<TabInfo[]>(() => {
  if (activeCategory.value === 'quests' && props.progress?.quests) {
    return props.progress.quests.chapters.map(ch => ({
      id: ch.id,
      title: cleanTitle(ch.title) || ch.id,
      icon: ch.icon,
      iconDataUrl: ch.iconDataUrl,
      fallbackIcon: getFallbackItemIcon(ch.icon || ch.title),
      completed: ch.completedQuests,
      total: ch.totalQuests,
    }))
  }

  const items = props.progress?.advancements?.items || []
  const branchMap: Record<string, { completed: number; total: number; rootIcon?: string; rootIconDataUrl?: string }> = {}

  for (const item of items) {
    const key = getBranchKey(item.id)
    if (!branchMap[key]) {
      branchMap[key] = { completed: 0, total: 0 }
    }
    branchMap[key].total++
    if (item.done) branchMap[key].completed++
    if (item.id.endsWith('/root') || !item.parent) {
      branchMap[key].rootIcon = item.icon
      branchMap[key].rootIconDataUrl = item.iconDataUrl
    } else if (!branchMap[key].rootIconDataUrl && item.iconDataUrl) {
      branchMap[key].rootIcon = item.icon
      branchMap[key].rootIconDataUrl = item.iconDataUrl
    }
  }

  const list: TabInfo[] = []
  for (const [key, val] of Object.entries(branchMap)) {
    list.push({
      id: key,
      title: formatBranchTitle(key),
      icon: val.rootIcon,
      iconDataUrl: val.rootIconDataUrl,
      fallbackIcon: getBranchIcon(key),
      completed: val.completed,
      total: val.total,
    })
  }

  if (list.length === 0 && items.length > 0) {
    list.push({
      id: 'all',
      title: t('save.progress.all'),
      icon: 'military_tech',
      fallbackIcon: 'military_tech',
      completed: items.filter(i => i.done).length,
      total: items.length,
    })
  }

  return list
})

watch(currentTabs, (tabs) => {
  if (tabs.length > 0 && (!selectedTabId.value || !tabs.find(t => t.id === selectedTabId.value))) {
    selectedTabId.value = tabs[0].id
  }
}, { immediate: true })

const activeTabStats = computed(() => {
  const tab = currentTabs.value.find(t => t.id === selectedTabId.value)
  if (!tab) return { completed: 0, total: 0, percent: 0 }
  const percent = tab.total > 0 ? Math.round((tab.completed / tab.total) * 100) : 0
  return { completed: tab.completed, total: tab.total, percent }
})

interface RenderNode {
  id: string
  title: string
  subtitle?: string
  description?: string
  icon?: string
  iconDataUrl?: string
  shape: string
  done: boolean
  locked: boolean
  tasksCount?: number
  tasksCompleted?: number
  completedTime?: string
  screenX: number
  screenY: number
  fallbackIcon: string
  dependencies: string[]
}

const currentNodes = computed<RenderNode[]>(() => {
  const result: RenderNode[] = []
  const gridSpacing = 68

  if (activeCategory.value === 'quests' && props.progress?.quests) {
    const ch = props.progress.quests.chapters.find(c => c.id === selectedTabId.value) || props.progress.quests.chapters[0]
    if (ch) {
      for (const q of ch.quests) {
        if (searchQuery.value) {
          const s = searchQuery.value.toLowerCase()
          if (!q.title.toLowerCase().includes(s) && !q.id.toLowerCase().includes(s)) continue
        }
        result.push({
          id: q.id,
          title: q.title,
          subtitle: q.subtitle,
          description: q.description,
          icon: q.icon,
          iconDataUrl: q.iconDataUrl,
          shape: q.shape || ch.defaultShape || 'circle',
          done: q.done,
          locked: !!q.locked,
          tasksCount: q.tasksCount,
          tasksCompleted: q.tasksCompleted,
          screenX: q.x * gridSpacing,
          screenY: q.y * gridSpacing,
          fallbackIcon: getFallbackItemIcon(q.icon || q.title),
          dependencies: q.dependencies || [],
        })
      }
    }
  } else {
    let items = props.progress?.advancements?.items || []
    if (selectedTabId.value && selectedTabId.value !== 'all') {
      items = items.filter(i => getBranchKey(i.id) === selectedTabId.value)
    }

    for (const adv of items) {
      if (searchQuery.value) {
        const s = searchQuery.value.toLowerCase()
        if (!adv.id.toLowerCase().includes(s) && !(adv.title || '').toLowerCase().includes(s)) continue
      }
      const x = adv.x ?? 0
      const y = adv.y ?? 0
      result.push({
        id: adv.id,
        title: adv.title || formatAdvancementTitle(adv.id),
        description: adv.description,
        icon: adv.icon,
        iconDataUrl: adv.iconDataUrl,
        shape: adv.frame || (adv.id.endsWith('/root') ? 'root' : 'task'),
        done: adv.done,
        locked: !adv.done,
        completedTime: adv.completedTime,
        screenX: x * gridSpacing,
        screenY: y * gridSpacing,
        fallbackIcon: getFallbackItemIcon(adv.icon || adv.id),
        dependencies: adv.parent ? [adv.parent] : [],
      })
    }
  }

  return result
})

interface RenderLine {
  x1: number
  y1: number
  x2: number
  y2: number
  done: boolean
  locked: boolean
}

const activeLines = computed<RenderLine[]>(() => {
  const lines: RenderLine[] = []
  const nodeMap = new Map<string, RenderNode>()
  for (const n of currentNodes.value) nodeMap.set(n.id, n)

  for (const node of currentNodes.value) {
    for (const depId of node.dependencies) {
      const parent = nodeMap.get(depId)
      if (parent) {
        lines.push({
          x1: parent.screenX,
          y1: parent.screenY,
          x2: node.screenX,
          y2: node.screenY,
          done: parent.done && node.done,
          locked: node.locked,
        })
      }
    }
  }

  return lines
})

function getLinePath(line: RenderLine): string {
  if (activeCategory.value === 'advancements') {
    const midX = (line.x1 + line.x2) / 2
    return `M ${line.x1} ${line.y1} L ${midX} ${line.y1} L ${midX} ${line.y2} L ${line.x2} ${line.y2}`
  }
  return `M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`
}

function centerCamera() {
  const nodes = currentNodes.value
  if (!nodes || nodes.length === 0 || !canvasRef.value) return

  const w = canvasRef.value.clientWidth
  const h = canvasRef.value.clientHeight
  if (!w || !h) return

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.screenX < minX) minX = n.screenX
    if (n.screenX > maxX) maxX = n.screenX
    if (n.screenY < minY) minY = n.screenY
    if (n.screenY > maxY) maxY = n.screenY
  }

  const spanX = maxX - minX + 160
  const spanY = maxY - minY + 160
  if (spanX > w || spanY > h) {
    const fitScale = Math.min(w / spanX, h / spanY, 1.0)
    scale.value = Math.max(Math.round(fitScale * 10) / 10, 0.4)
  }

  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  panX.value = Math.round(w / 2 - midX * scale.value)
  panY.value = Math.round(h / 2 - midY * scale.value)
}

watch([selectedTabId, activeCategory], () => {
  nextTick(() => centerCamera())
}, { immediate: true })

watch(currentNodes, () => {
  nextTick(() => centerCamera())
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (canvasRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      centerCamera()
    })
    resizeObserver.observe(canvasRef.value)
  }
  nextTick(() => centerCamera())
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

function onMouseDown(e: MouseEvent) {
  isDragging = true
  startMouseX = e.clientX
  startMouseY = e.clientY
  initialPanX = panX.value
  initialPanY = panY.value
}

function onMouseMove(e: MouseEvent) {
  if (isDragging) {
    panX.value = initialPanX + (e.clientX - startMouseX)
    panY.value = initialPanY + (e.clientY - startMouseY)
  }
}

function onMouseUp() {
  isDragging = false
}

function onWheel(e: WheelEvent) {
  const delta = e.deltaY < 0 ? 0.1 : -0.1
  const newScale = Math.min(Math.max(scale.value + delta, 0.4), 2.5)
  scale.value = Math.round(newScale * 10) / 10
}

function zoomIn() {
  scale.value = Math.min(scale.value + 0.15, 2.5)
}

function zoomOut() {
  scale.value = Math.max(scale.value - 0.15, 0.4)
}

function onNodeMouseEnter(e: MouseEvent, node: RenderNode) {
  hoveredNode.value = node
  if (canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect()
    tooltipPos.value = {
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top + 15,
    }
  }
}

function onNodeMouseLeave() {
  hoveredNode.value = null
}

function getBranchKey(id: string): string {
  const colonIdx = id.indexOf(':')
  const mod = colonIdx !== -1 ? id.substring(0, colonIdx) : 'minecraft'
  const path = colonIdx !== -1 ? id.substring(colonIdx + 1) : id
  const slashIdx = path.indexOf('/')
  const branchName = slashIdx !== -1 ? path.substring(0, slashIdx) : path
  return `${mod}:${branchName}`
}

const BRANCH_ICONS: [RegExp, string][] = [
  [/story/, 'auto_stories'],
  [/nether/, 'local_fire_department'],
  [/end/, 'dark_mode'],
  [/adventure/, 'explore'],
  [/husbandry/, 'agriculture'],
  [/tip|guide|help/, 'lightbulb'],
  [/phase|stage|chapter/, 'flag'],
  [/ob|quest|task/, 'stars'],
  [/tech|machine|energy/, 'precision_manufacturing'],
  [/magic|spell|witch/, 'auto_fix_high'],
  [/combat|weapon|fight/, 'swords'],
]

function getBranchIcon(branchKey: string): string {
  const k = branchKey.toLowerCase()
  return BRANCH_ICONS.find(([re]) => re.test(k))?.[1] || 'military_tech'
}

function formatBranchTitle(branchKey: string): string {
  if (branchKey === 'all') return t('save.progress.all')
  const parts = branchKey.split(':')
  const mod = parts[0]
  const path = parts[1] || parts[0]
  const formatted = path.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  if (mod === 'minecraft') return formatted
  const cleanMod = mod.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  if (formatted.toLowerCase() === cleanMod.toLowerCase()) return formatted
  return `${formatted} · ${cleanMod}`
}

function formatAdvancementTitle(id: string): string {
  const colonIdx = id.lastIndexOf(':')
  const clean = colonIdx !== -1 ? id.substring(colonIdx + 1) : id
  const slashIdx = clean.lastIndexOf('/')
  const leaf = slashIdx !== -1 ? clean.substring(slashIdx + 1) : clean
  if (leaf.toLowerCase() === 'root') return t('save.progress.root')
  return leaf.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const ITEM_ICONS: [RegExp, string][] = [
  [/pickaxe|mine|ore/, 'hardware'],
  [/sword|kill|attack/, 'swords'],
  [/chest|inventory/, 'inventory_2'],
  [/book|story|guide/, 'menu_book'],
  [/craft|table/, 'handyman'],
  [/furnace|smelt|fire/, 'local_fire_department'],
  [/bed|sleep/, 'bed'],
  [/shield|armor/, 'shield'],
  [/gear|tech|machine|create/, 'settings'],
  [/pipe|fluid|water/, 'water_drop'],
  [/team|party/, 'groups'],
  [/star|quest/, 'stars'],
]

function getFallbackItemIcon(name: string): string {
  const k = name.toLowerCase()
  return ITEM_ICONS.find(([re]) => re.test(k))?.[1] || 'military_tech'
}

const formattedPlayTime = computed(() => {
  const ticks = props.progress?.stats?.playTimeTicks || 0
  const seconds = Math.floor(ticks / 20)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
})
</script>

<style scoped>
.progress-canvas {
  background-color: #14161d;
  background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 0);
  background-size: 24px 24px;
}

/* Lines */
.adv-line {
  stroke: #3e4756;
  stroke-width: 2.5;
  fill: none;
  stroke-linecap: square;
}
.adv-line.line--done {
  stroke: #ffffff;
  stroke-width: 3;
}
.ftb-line {
  stroke: #374151;
  stroke-width: 2.5;
  fill: none;
  stroke-linecap: round;
}
.ftb-line.line--done {
  stroke: #10b981;
  stroke-width: 3;
}
.ftb-line.line--locked {
  stroke: #1f2937;
  stroke-dasharray: 4 3;
}

/* Base Node */
.progress-node {
  transition: all 0.2s ease;
}

/* Minecraft Advancement Frames */
.adv-frame--task {
  width: 38px;
  height: 38px;
  border-radius: 6px;
  background: #232733;
  border: 2px solid #4a5568;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 3px 6px rgba(0,0,0,0.5);
}
.adv-frame--goal {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: #232733;
  border: 2px solid #4a5568;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 3px 6px rgba(0,0,0,0.5);
}
.adv-frame--challenge {
  width: 38px;
  height: 38px;
  background: #232733;
  border: 2px solid #4a5568;
  clip-path: polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%);
}
.adv-frame--root {
  width: 38px;
  height: 38px;
  border-radius: 6px;
  background: #232733;
  border: 2px solid #d97706;
}
.node--done.adv-frame--task,
.node--done.adv-frame--goal,
.node--done.adv-frame--challenge {
  background: #333d4e;
  border-color: #ffffff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
}
.node--done.adv-frame--root {
  background: #333d4e;
  border-color: #fbbf24;
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.5);
}

/* FTB Frames */
.ftb-shape--circle {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #1c212c;
  border: 2px solid #374151;
  box-shadow: 0 4px 6px rgba(0,0,0,0.4);
}
.ftb-shape--square {
  width: 38px;
  height: 38px;
  border-radius: 6px;
  background: #1c212c;
  border: 2px solid #374151;
  box-shadow: 0 4px 6px rgba(0,0,0,0.4);
}
.ftb-shape--diamond {
  width: 34px;
  height: 34px;
  transform: rotate(45deg);
  border-radius: 3px;
  background: #1c212c;
  border: 2px solid #374151;
  box-shadow: 0 4px 6px rgba(0,0,0,0.4);
}
.ftb-shape--diamond > * {
  transform: rotate(-45deg);
}
.ftb-shape--hexagon {
  width: 38px;
  height: 38px;
  background: #1c212c;
  border: 2px solid #374151;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
}
.ftb-shape--gear {
  width: 44px;
  height: 44px;
}
.gear-path {
  fill: #1c212c;
  stroke: #374151;
  stroke-width: 2;
  transition: all 0.2s ease;
}

/* Node States */
.node--done.ftb-shape--circle,
.node--done.ftb-shape--square,
.node--done.ftb-shape--diamond,
.node--done.ftb-shape--hexagon {
  background: #133324;
  border-color: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
}
.node--done.ftb-shape--gear .gear-path {
  fill: #133324;
  stroke: #10b981;
}

.node--locked {
  opacity: 0.7;
}

.lock-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #1a1e27;
  border: 1px solid #4a5568;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  box-shadow: 0 2px 4px rgba(0,0,0,0.6);
}

.pixelated {
  image-rendering: pixelated;
}
</style>
