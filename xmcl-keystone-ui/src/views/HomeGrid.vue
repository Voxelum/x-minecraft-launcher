<template>
  <div data-testid="home-grid">
    <GridLayout
      class="z-1"
      v-model:layout="layout"
      :responsive-layouts="layouts"
      :is-draggable="true"
      :cols="cols"
      :col-num="12"
      :row-height="32"
      :is-resizable="true"
      :responsive="true"
      :vertical-compact="true"
      :use-css-transforms="true"
      @breakpoint-changed="onBreakpoint"
    >
      <GridItem
        v-for="item in layout"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :min-w="item.minW"
        :min-h="item.minH"
        :i="item.i"
        drag-allow-from=".v-card-title"
        drag-ignore-from=".no-drag"
        :class="{ 'screenshot-item': Number(item.i) === CardType.Screenshots }"
        @container-resized="onResized"
        @resized="onResized"
      >
        <HomeModCard
          v-if="isType(item.i, CardType.Mod)"
          :row-count="modRowCount"
          :row="item.h - 4"
        />
        <HomeResourcePacksCard
          v-else-if="isType(item.i, CardType.ResourcePack)"
          :row-count="resourcePackRowCount"
          :row="item.h - 4"
        />
        <HomeShaderPackCard v-else-if="isType(item.i, CardType.ShaderPack)" />
        <HomeSavesCard
          v-else-if="isType(item.i, CardType.Save)"
          :row-count="saveRowCount"
          :row="item.h - 4"
        />
        <HomeScreenshotCard
          v-else-if="isType(item.i, CardType.Screenshots)"
          :height="screenshotHeight"
          :instance="instance"
          persistent
        />
      </GridItem>
    </GridLayout>
  </div>
</template>
<script lang="ts" setup>
import { useLocalStorageCache } from '@/composables/cache'
import { kInstance } from '@/composables/instance'
import { kUpstream } from '@/composables/instanceUpdate'
import { injection } from '@/util/inject'
import debounce from 'lodash.debounce'
import { GridItem, GridLayout } from 'grid-layout-plus'
import HomeModCard from './HomeModCard.vue'
import HomeResourcePacksCard from './HomeResourcePacksCard.vue'
import HomeSavesCard from './HomeSavesCard.vue'
import HomeScreenshotCard from './HomeScreenshotCard.vue'
import HomeShaderPackCard from './HomeShaderPackCard.vue'

const { instance } = injection(kInstance)

enum CardType {
  Mod,
  ResourcePack,
  ShaderPack,
  Save,
  Screenshots,
}

provide(
  kUpstream,
  computed(() => ({
    upstream: instance.value.upstream,
    minecraft: instance.value.runtime.minecraft,
  })),
)

function rawType(type: CardType) {
  return type + ''
}

function isType(id: string, type: CardType) {
  const [typeString, param] = id.split('@')
  return Number(typeString) === type
}

interface GridItemType {
  x: number
  y: number
  w: number
  h: number
  i: string
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

const cols = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 4 }

const layouts = useLocalStorageCache(
  'cardsLayout',
  () => ({
    md: [
      { x: 0, y: 0, w: 3, h: 9, minW: 2, minH: 4, i: rawType(CardType.Mod) },
      { x: 9, y: 0, w: 3, h: 9, minW: 2, minH: 4, i: rawType(CardType.ResourcePack) },
      { x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.Save) },
      { x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.ShaderPack) },
      { x: 3, y: 4, w: 6, h: 5, minW: 3, minH: 4, i: rawType(CardType.Screenshots) },
    ],
    lg: [
      { x: 0, y: 0, w: 3, h: 9, minW: 2, minH: 4, i: rawType(CardType.Mod) },
      { x: 9, y: 0, w: 3, h: 9, minW: 2, minH: 4, i: rawType(CardType.ResourcePack) },
      { x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.Save) },
      { x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.ShaderPack) },
      { x: 3, y: 4, w: 6, h: 5, minW: 3, minH: 4, i: rawType(CardType.Screenshots) },
    ],
    sm: [
      { x: 0, y: 0, w: 2, h: 6, minW: 2, minH: 4, i: rawType(CardType.Mod) },
      { x: 2, y: 0, w: 2, h: 5, minW: 2, minH: 4, i: rawType(CardType.ResourcePack) },
      { x: 2, y: 5, w: 2, h: 5, minW: 2, minH: 4, i: rawType(CardType.ShaderPack) },
      { x: 0, y: 6, w: 2, h: 4, minW: 2, minH: 4, i: rawType(CardType.Save) },
      { x: 4, y: 0, w: 2, h: 10, minW: 2, minH: 4, i: rawType(CardType.Screenshots) },
    ],
    xs: [
      { x: 0, y: 0, w: 2, h: 6, minW: 2, minH: 4, i: rawType(CardType.Mod) },
      { x: 2, y: 4, w: 2, h: 4, minW: 2, minH: 4, i: rawType(CardType.Save) },
      { x: 0, y: 6, w: 2, h: 6, minW: 2, minH: 4, i: rawType(CardType.ResourcePack) },
      { x: 2, y: 0, w: 2, h: 4, minW: 2, minH: 4, i: rawType(CardType.ShaderPack) },
      { x: 2, y: 8, w: 2, h: 4, minW: 1, minH: 4, i: rawType(CardType.Screenshots) },
    ],
  }),
  JSON.stringify,
  JSON.parse,
)

const layout = ref([] as GridItemType[])

let lastBreakpoint = ''

const onBreakpoint = (newBreakpoint: string) => {
  if (lastBreakpoint) {
    layouts.value[lastBreakpoint] = layout.value
    localStorage.setItem('cardsLayout', JSON.stringify(layouts.value))
  }
  lastBreakpoint = newBreakpoint
}

const containerWidths = reactive({
  [CardType.Mod]: 0,
  [CardType.ResourcePack]: 0,
  [CardType.Save]: 0,
  [CardType.ShaderPack]: 0,
} as Record<string, number>)

const screenshotHeight = ref(0)

const saveLayouts = debounce(() => {
  localStorage.setItem('cardsLayout', JSON.stringify(layouts.value))
}, 500)

let screenshotItem = undefined as undefined | HTMLElement

const onResized = (i: string, newH: number, newW: number, newHPx: number, newWPx: number) => {
  containerWidths[i] = newWPx
  if (Number(i) === CardType.Screenshots) {
    if (!screenshotItem) {
      screenshotItem = document.getElementsByClassName('screenshot-item').item(0) as HTMLElement
    }
    if (screenshotItem) {
      nextTick().then(() => {
        const h = screenshotItem!.style.height
        screenshotHeight.value = Number(h.substring(0, h.length - 2))
      })
    } else {
      screenshotHeight.value = Number(newHPx)
    }
  }
  layouts.value[lastBreakpoint] = layout.value
  saveLayouts()
}

const getRowCount = (width: number) => (width ? Math.floor((width - 34) / 30) : 7)
const resourcePackRowCount = computed(() => getRowCount(containerWidths[CardType.ResourcePack]))
const modRowCount = computed(() => getRowCount(containerWidths[CardType.Mod]))
const saveRowCount = computed(() => getRowCount(containerWidths[CardType.Save]))
</script>

<style scoped>
.vue-grid-layout {
  padding: 0 4px;
}

.vue-grid-placeholder {
  border-radius: 14px;
  border: 1px solid rgba(var(--v-theme-primary), 0.55);
  background: rgba(var(--v-theme-primary), 0.14);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 14px 40px rgba(var(--v-theme-primary), 0.18);
}
.vue-grid-item .resizing {
  opacity: 0.9;
}
.vue-draggable-handle {
  position: absolute;
  width: 20px;
  height: 20px;
  top: 0;
  left: 0;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><circle cx='5' cy='5' r='5' fill='#FFFFFF'/></svg>")
    no-repeat;
  background-position: bottom right;
  padding: 0 8px 8px 0;
  background-repeat: no-repeat;
  background-origin: content-box;
  box-sizing: border-box;
  cursor: pointer;
}
</style>
<style>
.vgl-layout {
  --vgl-placeholder-bg: transparent;
  --vgl-placeholder-opacity: 100%;
  --vgl-item-dragging-opacity: 96%;
}

.vgl-layout .vgl-item--placeholder {
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid rgba(var(--v-theme-primary), 0.55);
  background:
    linear-gradient(135deg, rgba(var(--v-theme-primary), 0.18), rgba(var(--v-theme-primary), 0.08)),
    rgba(var(--v-theme-surface), 0.36);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 14px 40px rgba(var(--v-theme-primary), 0.18);
  backdrop-filter: blur(12px);
}

.vgl-layout .vgl-item--placeholder::after {
  content: '';
  position: absolute;
  inset: 8px;
  border-radius: 10px;
  border: 1px dashed rgba(var(--v-theme-primary), 0.5);
}

.vgl-layout .vgl-item--dragging {
  filter: drop-shadow(0 18px 36px rgba(0, 0, 0, 0.26));
}

.vgl-layout .vgl-item:not(.vgl-item--placeholder):not(.vgl-item--dragging) > .v-card  {
  border: var(--card-subsection-border);
  transition: border-color 0.5s ease;
}
/* ── Modern card hover ── */
.vgl-layout .vgl-item:hover:not(.vgl-item--placeholder):not(.vgl-item--dragging) > .v-card {
  border: 1px solid rgba(var(--v-theme-primary), 0.45) !important;
}

/* ── Resize handle — diagonal grip lines ── */
.vgl-layout {
  --vgl-resizer-size: 16px;
  --vgl-resizer-border-color: transparent;
  --vgl-resizer-border-width: 0px;
}

.vgl-layout .vgl-item__resizer {
  width: 16px;
  height: 16px;
  right: 2px;
  bottom: 2px;
  opacity: 0;
  transition: opacity 0.22s ease;
}

.vgl-layout .vgl-item:hover .vgl-item__resizer {
  opacity: 0.55;
}

.vgl-layout .vgl-item__resizer:hover {
  opacity: 1 !important;
}

.vgl-layout .vgl-item__resizer::before {
  all: unset;
  content: '';
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 10px;
  height: 10px;
  /* Three diagonal lines */
  background: linear-gradient(
    -45deg,
    transparent 0%,
    transparent 20%,
    rgba(var(--v-theme-on-surface), 0.5) 20%,
    rgba(var(--v-theme-on-surface), 0.5) 25%,
    transparent 25%,
    transparent 45%,
    rgba(var(--v-theme-on-surface), 0.5) 45%,
    rgba(var(--v-theme-on-surface), 0.5) 50%,
    transparent 50%,
    transparent 70%,
    rgba(var(--v-theme-on-surface), 0.5) 70%,
    rgba(var(--v-theme-on-surface), 0.5) 75%,
    transparent 75%
  );
}
</style>
