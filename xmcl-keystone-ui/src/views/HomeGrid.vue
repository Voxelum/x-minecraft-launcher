<template>
  <div data-testid="home-grid" v-context-menu="getBackgroundMenu">
    <GridLayout
      class="z-1"
      v-model:layout="layout"
      :is-draggable="true"
      :cols="cols"
      :col-num="12"
      :row-height="32"
      :is-resizable="true"
      :responsive="true"
      :vertical-compact="true"
      :use-css-transforms="true"
      @breakpoint-changed="onBreakpoint"
      @layout-updated="onLayoutUpdated"
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
        v-context-menu="() => getCardMenu(item.i)"
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
        <HomeServerCard v-else-if="isType(item.i, CardType.Server)" />
      </GridItem>
    </GridLayout>
  </div>
</template>
<script lang="ts" setup>
import { useLocalStorageCache } from '@/composables/cache'
import { ContextMenuItem } from '@/composables/contextMenu'
import { kInstance } from '@/composables/instance'
import { kUpstream } from '@/composables/instanceUpdate'
import { vContextMenu } from '@/directives/contextMenu'
import { injection } from '@/util/inject'
import debounce from 'lodash.debounce'
import { GridItem, GridLayout } from 'grid-layout-plus'
import HomeModCard from './HomeModCard.vue'
import HomeResourcePacksCard from './HomeResourcePacksCard.vue'
import HomeSavesCard from './HomeSavesCard.vue'
import HomeScreenshotCard from './HomeScreenshotCard.vue'
import HomeServerCard from './HomeServerCard.vue'
import HomeShaderPackCard from './HomeShaderPackCard.vue'

const { t } = useI18n()
const { instance } = injection(kInstance)

enum CardType {
  Mod,
  ResourcePack,
  ShaderPack,
  Save,
  Screenshots,
  Server,
}

/** The hardcoded, authoritative list of cards. The rendered layout is
    derived from this — there is no persisted card list to migrate. */
const CARD_TYPES = [
  CardType.Mod,
  CardType.ResourcePack,
  CardType.ShaderPack,
  CardType.Save,
  CardType.Screenshots,
  CardType.Server,
]

const cardIcon: Record<number, string> = {
  [CardType.Mod]: 'extension',
  [CardType.ResourcePack]: 'palette',
  [CardType.ShaderPack]: 'gradient',
  [CardType.Save]: 'map',
  [CardType.Screenshots]: 'image',
  [CardType.Server]: 'dns',
}

const cardLabel: Record<number, () => string> = {
  [CardType.Mod]: () => t('mod.name'),
  [CardType.ResourcePack]: () => t('resourcepack.name'),
  [CardType.ShaderPack]: () => t('shaderPack.name'),
  [CardType.Save]: () => t('save.name'),
  [CardType.Screenshots]: () => t('screenshots.gallery'),
  [CardType.Server]: () => t('server.serversListTitle'),
}

provide(
  kUpstream,
  computed(() => ({
    upstream: instance.value.upstream,
    minecraft: instance.value.runtime.minecraft,
  })),
)

function isType(id: string, type: CardType) {
  const [typeString, param] = id.split('@')
  return Number(typeString) === type
}

interface GridGeom {
  x: number
  y: number
  w: number
  h: number
  minW: number
  minH: number
}

interface GridItemType extends GridGeom {
  i: string
  maxW?: number
  maxH?: number
}

type Breakpoint = 'lg' | 'md' | 'sm' | 'xs' | 'xxs'

/**
 * Persisted, per-card metadata. Keyed by the card type so adding or removing
 * a `CardType` never corrupts the stored shape: an unknown key is simply
 * ignored, a missing key falls back to {@link DEFAULTS}. `hidden` is global
 * (a hidden card stays hidden in every breakpoint); `layout` holds the
 * user's per-breakpoint position/size overrides.
 */
interface CardMeta {
  hidden?: boolean
  layout?: Partial<Record<Breakpoint, Partial<GridGeom>>>
}

const cols = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 4 }

/** Width thresholds grid-layout-plus uses to pick a breakpoint. */
const breakpointWidths: Record<Breakpoint, number> = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }

/**
 * Hardcoded default geometry per breakpoint per card. The set of cards shown
 * is derived from this — there is no persisted "list" of cards to migrate.
 */
const DEFAULTS: Record<Breakpoint, Partial<Record<CardType, GridGeom>>> = {
  lg: {
    [CardType.Mod]: { x: 0, y: 0, w: 3, h: 9, minW: 2, minH: 4 },
    [CardType.ResourcePack]: { x: 9, y: 0, w: 3, h: 9, minW: 2, minH: 4 },
    [CardType.Save]: { x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 4 },
    [CardType.ShaderPack]: { x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 4 },
    [CardType.Screenshots]: { x: 3, y: 4, w: 6, h: 5, minW: 3, minH: 4 },
    [CardType.Server]: { x: 0, y: 9, w: 3, h: 5, minW: 2, minH: 4 },
  },
  md: {
    [CardType.Mod]: { x: 0, y: 0, w: 3, h: 9, minW: 2, minH: 4 },
    [CardType.ResourcePack]: { x: 9, y: 0, w: 3, h: 9, minW: 2, minH: 4 },
    [CardType.Save]: { x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 4 },
    [CardType.ShaderPack]: { x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 4 },
    [CardType.Screenshots]: { x: 3, y: 4, w: 6, h: 5, minW: 3, minH: 4 },
    [CardType.Server]: { x: 0, y: 9, w: 3, h: 5, minW: 2, minH: 4 },
  },
  sm: {
    [CardType.Mod]: { x: 0, y: 0, w: 2, h: 6, minW: 2, minH: 4 },
    [CardType.ResourcePack]: { x: 2, y: 0, w: 2, h: 5, minW: 2, minH: 4 },
    [CardType.ShaderPack]: { x: 2, y: 5, w: 2, h: 5, minW: 2, minH: 4 },
    [CardType.Save]: { x: 0, y: 6, w: 2, h: 4, minW: 2, minH: 4 },
    [CardType.Screenshots]: { x: 4, y: 0, w: 2, h: 10, minW: 2, minH: 4 },
    [CardType.Server]: { x: 0, y: 10, w: 2, h: 5, minW: 2, minH: 4 },
  },
  xs: {
    [CardType.Mod]: { x: 0, y: 0, w: 2, h: 6, minW: 2, minH: 4 },
    [CardType.Save]: { x: 2, y: 4, w: 2, h: 4, minW: 2, minH: 4 },
    [CardType.ResourcePack]: { x: 0, y: 6, w: 2, h: 6, minW: 2, minH: 4 },
    [CardType.ShaderPack]: { x: 2, y: 0, w: 2, h: 4, minW: 2, minH: 4 },
    [CardType.Screenshots]: { x: 2, y: 8, w: 2, h: 4, minW: 1, minH: 4 },
    [CardType.Server]: { x: 0, y: 12, w: 2, h: 5, minW: 2, minH: 4 },
  },
  xxs: {
    [CardType.Mod]: { x: 0, y: 0, w: 2, h: 6, minW: 2, minH: 4 },
    [CardType.Save]: { x: 2, y: 4, w: 2, h: 4, minW: 2, minH: 4 },
    [CardType.ResourcePack]: { x: 0, y: 6, w: 2, h: 6, minW: 2, minH: 4 },
    [CardType.ShaderPack]: { x: 2, y: 0, w: 2, h: 4, minW: 2, minH: 4 },
    [CardType.Screenshots]: { x: 2, y: 8, w: 2, h: 4, minW: 1, minH: 4 },
    [CardType.Server]: { x: 0, y: 12, w: 2, h: 5, minW: 2, minH: 4 },
  },
}

const STORE_KEY = 'homeCardsState'
const cardState = useLocalStorageCache(
  STORE_KEY,
  () => ({} as Record<string, CardMeta>),
  JSON.stringify,
  JSON.parse,
)

function saveCardState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(cardState.value))
}

function getBreakpoint(width: number): Breakpoint {
  if (width >= breakpointWidths.lg) return 'lg'
  if (width >= breakpointWidths.md) return 'md'
  if (width >= breakpointWidths.sm) return 'sm'
  if (width >= breakpointWidths.xs) return 'xs'
  return 'xxs'
}

/**
 * Whether a card type should be rendered at all, independent of the user's
 * hidden flag. The Server card only exists when the instance has a pinned
 * server to ping.
 */
const hasPinnedServer = computed(() => !!instance.value?.server?.host)
function isAvailable(type: CardType) {
  if (type === CardType.Server) return hasPinnedServer.value
  return true
}

/**
 * Build the live layout array for the given breakpoint. The card *list* is
 * the hardcoded {@link CARD_TYPES}; persisted state only contributes
 * per-card overrides and the hidden flag.
 */
function buildLayout(bp: Breakpoint): GridItemType[] {
  const defs = DEFAULTS[bp] ?? DEFAULTS.xs
  const items: GridItemType[] = []
  for (const type of CARD_TYPES) {
    if (!isAvailable(type)) continue
    const def = defs[type]
    if (!def) continue
    const meta = cardState.value[String(type)]
    if (meta?.hidden) continue
    const ov = meta?.layout?.[bp] ?? {}
    items.push({
      i: String(type),
      x: ov.x ?? def.x,
      y: ov.y ?? def.y,
      w: ov.w ?? def.w,
      h: ov.h ?? def.h,
      minW: def.minW,
      minH: def.minH,
    })
  }
  return items
}

const currentBreakpoint = ref<Breakpoint>(getBreakpoint(window.innerWidth))
const layout = ref<GridItemType[]>(buildLayout(currentBreakpoint.value))

const onBreakpoint = (newBreakpoint: string) => {
  currentBreakpoint.value = newBreakpoint as Breakpoint
  layout.value = buildLayout(newBreakpoint as Breakpoint)
}

// Rebuild when the pinned server appears or disappears so the Server card
// shows up / drops out without a reload.
watch(hasPinnedServer, () => {
  layout.value = buildLayout(currentBreakpoint.value)
})

const containerWidths = reactive({
  [CardType.Mod]: 0,
  [CardType.ResourcePack]: 0,
  [CardType.Save]: 0,
  [CardType.ShaderPack]: 0,
} as Record<string, number>)

const screenshotHeight = ref(0)

/** Write the current breakpoint's live geometry back into the per-card store. */
const persist = debounce(() => {
  const bp = currentBreakpoint.value
  for (const item of layout.value) {
    const meta = cardState.value[item.i] ?? (cardState.value[item.i] = {})
    const byBreakpoint = meta.layout ?? (meta.layout = {})
    byBreakpoint[bp] = { x: item.x, y: item.y, w: item.w, h: item.h }
  }
  saveCardState()
}, 500)

function onLayoutUpdated() {
  persist()
}

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
  persist()
}

const getRowCount = (width: number) => (width ? Math.floor((width - 34) / 30) : 7)
const resourcePackRowCount = computed(() => getRowCount(containerWidths[CardType.ResourcePack]))
const modRowCount = computed(() => getRowCount(containerWidths[CardType.Mod]))
const saveRowCount = computed(() => getRowCount(containerWidths[CardType.Save]))

function hideCard(id: string) {
  const meta = cardState.value[id] ?? (cardState.value[id] = {})
  meta.hidden = true
  saveCardState()
  layout.value = buildLayout(currentBreakpoint.value)
}

function restoreCard(id: string) {
  const meta = cardState.value[id]
  if (meta) meta.hidden = false
  saveCardState()
  layout.value = buildLayout(currentBreakpoint.value)
}

const hiddenTypes = computed(() => CARD_TYPES.filter((type) => isAvailable(type) && cardState.value[String(type)]?.hidden))

function getCardMenu(id: string): ContextMenuItem[] {
  return [
    {
      text: t('instance.hideCard'),
      icon: 'visibility_off',
      onClick: () => hideCard(id),
    },
  ]
}

function getBackgroundMenu(): ContextMenuItem[] {
  return hiddenTypes.value.map((type) => ({
    text: t('instance.showHiddenCards') + ': ' + cardLabel[type](),
    icon: cardIcon[type] ?? 'visibility',
    onClick: () => restoreCard(String(type)),
  }))
}
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
