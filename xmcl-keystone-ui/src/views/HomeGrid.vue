<template>
  <div ref="gridRoot" data-testid="home-grid" v-context-menu="getBackgroundMenu">
    <GridLayout
      class="z-1"
      v-model:layout="layout"
      :is-draggable="true"
      :col-num="currentCols"
      :row-height="32"
      :is-resizable="true"
      :vertical-compact="true"
      :use-css-transforms="true"
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
        <HomeBlueprintCard v-else-if="isType(item.i, CardType.Blueprint)" />
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
        <HomeServerCard
          v-else-if="isType(item.i, CardType.Server)"
          :server-key="getParam(item.i)"
        />
        <HomeWorldCard
          v-else-if="isType(item.i, CardType.World)"
          :world="getParam(item.i)"
        />
      </GridItem>
    </GridLayout>
  </div>
</template>
<script lang="ts" setup>
import { ContextMenuItem } from '@/composables/contextMenu'
import { kInstance } from '@/composables/instance'
import { kInstanceSave } from '@/composables/instanceSave'
import { kInstanceServerInfo } from '@/composables/instanceServerInfo'
import { kUpstream } from '@/composables/instanceUpdate'
import { vContextMenu } from '@/directives/contextMenu'
import { injection } from '@/util/inject'
import { useLocalStorage, useResizeObserver } from '@vueuse/core'
import { formatServerAddress, parseServerAddress } from '@xmcl/runtime-api'
import { useDebounceFn } from '@vueuse/core'
import { GridItem, GridLayout } from 'grid-layout-plus'
import HomeModCard from './HomeModCard.vue'
import HomeResourcePacksCard from './HomeResourcePacksCard.vue'
import HomeSavesCard from './HomeSavesCard.vue'
import HomeScreenshotCard from './HomeScreenshotCard.vue'
import HomeServerCard from './HomeServerCard.vue'
import HomeShaderPackCard from './HomeShaderPackCard.vue'
import HomeWorldCard from './HomeWorldCard.vue'
import HomeBlueprintCard from './HomeBlueprintCard.vue'

const { t } = useI18n()
const { instance } = injection(kInstance)
const { servers: datServers } = injection(kInstanceServerInfo)
const { saves } = injection(kInstanceSave)

enum CardType {
  Mod,
  ResourcePack,
  ShaderPack,
  Save,
  Screenshots,
  Server,
  World,
  Blueprint,
}

const cardIcon: Record<number, string> = {
  [CardType.Mod]: 'extension',
  [CardType.ResourcePack]: 'palette',
  [CardType.ShaderPack]: 'gradient',
  [CardType.Save]: 'map',
  [CardType.Screenshots]: 'image',
  [CardType.Server]: 'dns',
  [CardType.World]: 'public',
  [CardType.Blueprint]: 'view_in_ar',
}

const cardLabel: Record<number, () => string> = {
  [CardType.Mod]: () => t('mod.name'),
  [CardType.ResourcePack]: () => t('resourcepack.name'),
  [CardType.ShaderPack]: () => t('shaderPack.name'),
  [CardType.Save]: () => t('save.name'),
  [CardType.Screenshots]: () => t('screenshots.gallery'),
  [CardType.Server]: () => t('server.serversListTitle'),
  [CardType.World]: () => t('save.world', 2),
  [CardType.Blueprint]: () => t('blueprint.name'),
}

provide(
  kUpstream,
  computed(() => ({
    upstream: instance.value.upstream,
    minecraft: instance.value.runtime.minecraft,
  })),
)

function isType(id: string, type: CardType) {
  const [typeString] = id.split('@')
  return Number(typeString) === type
}

/** Extract the per-instance discriminator from a card id (`type@param`). */
function getParam(id: string): string | undefined {
  const idx = id.indexOf('@')
  return idx >= 0 ? id.slice(idx + 1) : undefined
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

type Breakpoint = 'lg' | 'md' | 'sm' | 'xs'

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

const cols = { lg: 12, md: 12, sm: 6, xs: 4 }

/**
 * Width thresholds (px) that map a container width to a breakpoint. This is the
 * single source of truth: it is both passed to `GridLayout`'s `breakpoints`
 * prop (so the grid picks the same breakpoint we do) and consumed by
 * {@link getBreakpoint}. Tweak these numbers to customize when the layout
 * switches breakpoints.
 */
const breakpointWidths: Record<Breakpoint, number> = { lg: 1600, md: 1280, sm: 1024, xs: 0 }

/**
 * Hardcoded default geometry per breakpoint per card. The set of cards shown
 * is derived from this — there is no persisted "list" of cards to migrate.
 *
 * Visible-by-default cards: Mod, ResourcePack, ShaderPack, Save, Screenshots.
 * Server / World are opt-in (hidden by default); their geometry only applies
 * once the user shows them, where they tuck in under the visible cards.
 *
 * Layout intent (left→right): Mod and ResourcePack are tall list columns on the
 * edges; Save + ShaderPack sit on top of the wide Screenshots gallery in the
 * middle. `lg` (>1600px) is deliberately roomier than `md` (1280–1600px).
 */
const DEFAULTS: Record<Breakpoint, Partial<Record<CardType, GridGeom>>> = {
  // 12 columns, extra-wide — taller cards, bigger gallery.
  lg: {
    [CardType.Mod]: { x: 0, y: 0, w: 3, h: 11, minW: 2, minH: 4 },
    [CardType.Save]: { x: 3, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    [CardType.ShaderPack]: { x: 6, y: 0, w: 3, h: 5, minW: 2, minH: 4 },
    [CardType.ResourcePack]: { x: 9, y: 0, w: 3, h: 11, minW: 2, minH: 4 },
    [CardType.Screenshots]: { x: 3, y: 5, w: 6, h: 6, minW: 3, minH: 4 },
    [CardType.Blueprint]: { x: 0, y: 11, w: 3, h: 5, minW: 2, minH: 4 },
    [CardType.Server]: { x: 3, y: 11, w: 3, h: 5, minW: 2, minH: 4 },
    [CardType.World]: { x: 6, y: 11, w: 3, h: 5, minW: 2, minH: 4 },
  },
  // 12 columns, standard density.
  md: {
    [CardType.Mod]: { x: 0, y: 0, w: 3, h: 9, minW: 2, minH: 4 },
    [CardType.Save]: { x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 4 },
    [CardType.ShaderPack]: { x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 4 },
    [CardType.ResourcePack]: { x: 9, y: 0, w: 3, h: 9, minW: 2, minH: 4 },
    [CardType.Screenshots]: { x: 3, y: 4, w: 6, h: 5, minW: 3, minH: 4 },
    [CardType.Blueprint]: { x: 0, y: 9, w: 3, h: 5, minW: 2, minH: 4 },
    [CardType.Server]: { x: 3, y: 9, w: 3, h: 5, minW: 2, minH: 4 },
    [CardType.World]: { x: 6, y: 9, w: 3, h: 5, minW: 2, minH: 4 },
  },
  // 6 columns — two list columns, then a full-width gallery underneath.
  sm: {
    [CardType.Mod]: { x: 0, y: 0, w: 3, h: 8, minW: 2, minH: 4 },
    [CardType.ResourcePack]: { x: 3, y: 0, w: 3, h: 8, minW: 2, minH: 4 },
    [CardType.Save]: { x: 0, y: 8, w: 3, h: 4, minW: 2, minH: 4 },
    [CardType.ShaderPack]: { x: 3, y: 8, w: 3, h: 4, minW: 2, minH: 4 },
    [CardType.Screenshots]: { x: 0, y: 12, w: 6, h: 6, minW: 3, minH: 4 },
    [CardType.Blueprint]: { x: 0, y: 18, w: 3, h: 5, minW: 2, minH: 4 },
    [CardType.Server]: { x: 3, y: 18, w: 3, h: 5, minW: 2, minH: 4 },
    [CardType.World]: { x: 0, y: 23, w: 3, h: 5, minW: 2, minH: 4 },
  },
  // 4 columns — two columns, full-width gallery underneath.
  xs: {
    [CardType.Mod]: { x: 0, y: 0, w: 2, h: 7, minW: 2, minH: 4 },
    [CardType.ResourcePack]: { x: 2, y: 0, w: 2, h: 7, minW: 2, minH: 4 },
    [CardType.Save]: { x: 0, y: 7, w: 2, h: 4, minW: 2, minH: 4 },
    [CardType.ShaderPack]: { x: 2, y: 7, w: 2, h: 4, minW: 2, minH: 4 },
    [CardType.Screenshots]: { x: 0, y: 11, w: 4, h: 5, minW: 2, minH: 4 },
    [CardType.Blueprint]: { x: 0, y: 16, w: 2, h: 5, minW: 2, minH: 4 },
    [CardType.Server]: { x: 2, y: 16, w: 2, h: 5, minW: 2, minH: 4 },
    [CardType.World]: { x: 0, y: 21, w: 2, h: 5, minW: 2, minH: 4 },
  },
}

const STORE_KEY = 'homeCardsState'
const cardState = useLocalStorage<Record<string, CardMeta>>(STORE_KEY, {}, { deep: false, writeDefaults: false })

function saveCardState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(cardState.value))
}

function getBreakpoint(width: number): Breakpoint {
  if (width >= breakpointWidths.lg) return 'lg'
  if (width >= breakpointWidths.md) return 'md'
  if (width >= breakpointWidths.sm) return 'sm'
  return 'xs'
}

/**
 * A single rendered card. Singleton cards (mods, screenshots, …) have an id
 * equal to their `CardType`. Multi-instance cards (one per world / per server)
 * use `type@param`, where `param` uniquely identifies the world (save folder
 * name) or server (`host[:port]`). The `param` doubles as the per-card key in
 * {@link cardState}, so each world / server remembers its own geometry and
 * hidden flag.
 */
interface CardDescriptor {
  id: string
  type: CardType
  /** Human-readable label used in the show/hide context menu. */
  label: string
}

/** Card types that render exactly once per instance. */
const SINGLETON_TYPES = [
  CardType.Mod,
  CardType.ResourcePack,
  CardType.ShaderPack,
  CardType.Save,
  CardType.Screenshots,
  CardType.Blueprint,
]

/**
 * One Server card per distinct server — the pinned server first, then every
 * `servers.dat` entry, de-duplicated by `host:port`.
 */
const serverCards = computed<CardDescriptor[]>(() => {
  const seen = new Set<string>()
  const result: CardDescriptor[] = []
  const pinned = instance.value?.server
  if (pinned?.host) {
    const key = formatServerAddress({ host: pinned.host, port: pinned.port })
    seen.add(key)
    result.push({ id: `${CardType.Server}@${key}`, type: CardType.Server, label: pinned.name || pinned.host })
  }
  for (const s of datServers.value) {
    const parsed = parseServerAddress(s.ip)
    if (!parsed) continue
    const key = formatServerAddress(parsed)
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ id: `${CardType.Server}@${key}`, type: CardType.Server, label: s.name || parsed.host })
  }
  return result
})

/** One World card per save, keyed by the save folder name. */
const worldCards = computed<CardDescriptor[]>(() =>
  saves.value.map((s) => ({
    id: `${CardType.World}@${s.name}`,
    type: CardType.World,
    label: s.levelName || s.name,
  })),
)

/** The full set of cards to render, before applying the per-card hidden flag. */
const allCards = computed<CardDescriptor[]>(() => {
  const result: CardDescriptor[] = SINGLETON_TYPES.map((type) => ({
    id: String(type),
    type,
    label: cardLabel[type](),
  }))
  result.push(...worldCards.value)
  result.push(...serverCards.value)
  return result
})

/**
 * Card types that start hidden. Per-world / per-server cards are opt-in: the
 * grid would otherwise fill up with one card per save and per server. They only
 * appear once the user explicitly shows them from the context menu (which sets
 * `hidden = false`). Blueprints are likewise opt-in.
 */
const DEFAULT_HIDDEN_TYPES = new Set<CardType>([CardType.World, CardType.Server, CardType.Blueprint])

/** Whether a card is currently hidden, honouring the per-type default. */
function isHidden(card: CardDescriptor): boolean {
  const meta = cardState.value[card.id]
  if (DEFAULT_HIDDEN_TYPES.has(card.type)) {
    return meta?.hidden !== false
  }
  return !!meta?.hidden
}

/**
 * Build the live layout array for the given breakpoint from {@link allCards}.
 * Persisted state only contributes per-card overrides and the hidden flag.
 * Multiple cards of the same type (worlds / servers) share one default
 * geometry, so they're stacked by index until the user rearranges them.
 */
function buildLayout(bp: Breakpoint): GridItemType[] {
  const defs = DEFAULTS[bp] ?? DEFAULTS.xs
  const items: GridItemType[] = []
  const typeIndex: Record<number, number> = {}
  for (const card of allCards.value) {
    const def = defs[card.type]
    if (!def) continue
    if (isHidden(card)) continue
    const idx = typeIndex[card.type] ?? 0
    typeIndex[card.type] = idx + 1
    const ov = cardState.value[card.id]?.layout?.[bp] ?? {}
    items.push({
      i: card.id,
      x: ov.x ?? def.x,
      y: ov.y ?? def.y + idx * def.h,
      w: ov.w ?? def.w,
      h: ov.h ?? def.h,
      minW: def.minW,
      minH: def.minH,
    })
  }
  return items
}

const gridRoot = ref<HTMLElement>()
const currentBreakpoint = ref<Breakpoint>(getBreakpoint(window.innerWidth))
const layout = ref<GridItemType[]>(buildLayout(currentBreakpoint.value))

// The grid's column count is driven by our own breakpoint rather than
// grid-layout-plus' responsive mode, so we stay the single source of truth.
const currentCols = computed(() => cols[currentBreakpoint.value])

function applyBreakpoint(bp: Breakpoint) {
  if (bp === currentBreakpoint.value) return
  currentBreakpoint.value = bp
  layout.value = buildLayout(bp)
}

// Watch the grid *container* width (which excludes the launcher sidebar) and
// switch breakpoints as the window/sidebar resizes. grid-layout-plus' built-in
// responsive mode does not reliably surface these changes in this embedding, so
// we own the breakpoint logic: this fires on mount and on every resize, keeping
// the layout and column count in sync with the available width.
useResizeObserver(gridRoot, (entries) => {
  const width = entries[0]?.contentRect.width
  if (!width) return
  applyBreakpoint(getBreakpoint(width))
})

// Rebuild when the set of cards changes (a world or server is added / removed)
// so the corresponding card shows up / drops out without a reload.
watch(() => allCards.value.map((c) => c.id).join('|'), () => {
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
const writeLayout = () => {
  const bp = currentBreakpoint.value
  for (const item of layout.value) {
    const meta = cardState.value[item.i] ?? (cardState.value[item.i] = {})
    const byBreakpoint = meta.layout ?? (meta.layout = {})
    byBreakpoint[bp] = { x: item.x, y: item.y, w: item.w, h: item.h }
  }
  saveCardState()
}
const persist = useDebounceFn(writeLayout, 500)

function onLayoutUpdated() {
  persist()
}

// The home view is not kept alive, so navigating away unmounts this component.
// `persist` is debounced and VueUse's `useDebounceFn` cannot flush on teardown,
// so we write synchronously here — without it a drag/resize made shortly before
// navigation would never reach localStorage and the layout would appear to
// reset on return.
onBeforeUnmount(() => {
  writeLayout()
})

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
  const meta = cardState.value[id] ?? (cardState.value[id] = {})
  meta.hidden = false
  saveCardState()
  layout.value = buildLayout(currentBreakpoint.value)
}

const hiddenCards = computed(() => allCards.value.filter((c) => isHidden(c)))

function getRestoreMenuItems(): ContextMenuItem[] {
  return hiddenCards.value.map((c) => ({
    text: t('instance.showHiddenCards') + ': ' + c.label,
    icon: cardIcon[c.type] ?? 'visibility',
    onClick: () => restoreCard(c.id),
  }))
}

function getCardMenu(id: string): ContextMenuItem[] {
  return [
    {
      text: t('instance.hideCard'),
      icon: 'visibility_off',
      onClick: () => hideCard(id),
    },
    ...getRestoreMenuItems(),
  ]
}

function getBackgroundMenu(): ContextMenuItem[] {
  return getRestoreMenuItems()
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
