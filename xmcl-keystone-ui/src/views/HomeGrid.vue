<template>
  <GridLayout
    class="z-1"
    :layout.sync="layout"
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
    :key="layoutKey"
  >
    <GridItem
      v-for="item in layout"
      :key="item.i"
      v-if="isVisible(item.i)"
      :x="item.x"
      :y="item.y"
      :w="item.w"
      :h="item.h"
      :min-w="item.minW"
      :min-h="item.minH"
      :i="item.i"
      drag-allow-from=".v-card__title"
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
      <HomeShaderPackCard
        v-else-if="isType(item.i, CardType.ShaderPack)"
      />
      <HomeSavesCard
        v-else-if="isType(item.i, CardType.Save)"
        :row-count="saveRowCount"
        :row="item.h - 4"
      />
      <HomeScreenshotCard
        v-else-if="isType(item.i, CardType.Screenshots)"
        :width="item.w"
        :height="screenshotHeight"
        :instance="instance"
      />
    </GridItem>
  </GridLayout>
</template>
<script lang="ts" setup>

import { kInstance } from '@/composables/instance'
import { kUpstream } from '@/composables/instanceUpdate'
import { injection } from '@/util/inject'
import debounce from 'lodash.debounce'
import { GridItem, GridLayout } from 'vue-grid-layout'
import HomeModCard from './HomeModCard.vue'
import HomeResourcePacksCard from './HomeResourcePacksCard.vue'
import HomeSavesCard from './HomeSavesCard.vue'
import HomeScreenshotCard from './HomeScreenshotCard.vue'
import HomeShaderPackCard from './HomeShaderPackCard.vue'
import { kTheme, getDefaultHomeLayout } from '@/composables/theme'
import { watch } from 'vue'

const { instance } = injection(kInstance)
const { visibleCards } = injection(kTheme)

enum CardType {
  Mod,
  ResourcePack,
  ShaderPack,
  Save,
  Screenshots,
}

provide(kUpstream, computed(() => ({ upstream: instance.value.upstream, minecraft: instance.value.runtime.minecraft })))

function rawType(type: CardType) {
  return type + ''
}

function isType(id: string, type: CardType) {
  const [typeString, param] = id.split('@')
  return Number(typeString) === type
}

function isVisible(id: string) {
  const type = Number(id.split('@')[0]);
  switch (type) {
    case CardType.Mod:
      return (visibleCards.value as string[]).includes('mod');
    case CardType.ResourcePack:
      return (visibleCards.value as string[]).includes('resource-pack');
    case CardType.ShaderPack:
      return (visibleCards.value as string[]).includes('shader-pack');
    case CardType.Save:
      return (visibleCards.value as string[]).includes('save');
    case CardType.Screenshots:
      return (visibleCards.value as string[]).includes('screenshots');
    default:
      return false;
  }
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

const { homeLayout } = injection(kTheme)
const layouts = computed(() => homeLayout.value || getDefaultHomeLayout())

const layout = ref([] as GridItemType[])
const layoutKey = ref(0)

let lastBreakpoint = ''



function syncLayout(breakpoint: string) {
  if (!breakpoint) return;
  let current = [...(layouts.value[breakpoint] ?? getDefaultHomeLayout()[breakpoint])];
  const toRemove: number[] = [];
  const presentTypes: number[] = [];
  for (let i = 0; i < current.length; i++) {
    const item = current[i];
    const type = Number(item.i.split('@')[0]);
    presentTypes.push(type);
    let str = '';
    switch (type) {
      case CardType.Mod: str = 'mod'; break;
      case CardType.ResourcePack: str = 'resource-pack'; break;
      case CardType.ShaderPack: str = 'shader-pack'; break;
      case CardType.Save: str = 'save'; break;
      case CardType.Screenshots: str = 'screenshots'; break;
    }
    if (!(visibleCards.value as string[]).includes(str)) {
      toRemove.push(i);
    }
  }
  toRemove.reverse().forEach(i => current.splice(i, 1));
  const toAdd: GridItemType[] = [];
  for (const t in CardType) {
    const type = CardType[t as keyof typeof CardType];
    if (typeof type === 'string') continue;
    let str = '';
    switch (type) {
      case CardType.Mod: str = 'mod'; break;
      case CardType.ResourcePack: str = 'resource-pack'; break;
      case CardType.ShaderPack: str = 'shader-pack'; break;
      case CardType.Save: str = 'save'; break;
      case CardType.Screenshots: str = 'screenshots'; break;
    }
    if ((visibleCards.value as string[]).includes(str) && !presentTypes.includes(type)) {
      const maxY = current.length > 0 ? Math.max(...current.map((i: GridItemType) => i.y + i.h)) : 0;
      const defaultW = (breakpoint === 'lg' || breakpoint === 'md') ? 3 : 2;
      const defaultH = type === CardType.Screenshots ? 5 : (type === CardType.Mod || type === CardType.ResourcePack) ? 9 : 4;
      const minW = (type === CardType.Screenshots) ? 3 : 2;
      toAdd.push({ x: 0, y: maxY, w: defaultW, h: defaultH, minW, minH: 4, i: type + '' });
    }
  }
  current.push(...toAdd);
  layout.value = current;
  layoutKey.value++;
}

watch(visibleCards, () => syncLayout(lastBreakpoint), { deep: true });

const onBreakpoint = (newBreakpoint: string) => {
  if (lastBreakpoint) {
    layouts.value[lastBreakpoint] = [...layout.value];
    homeLayout.value = { ...layouts.value };
  }
  lastBreakpoint = newBreakpoint;
  syncLayout(newBreakpoint);
};

const containerWidths = reactive({
  [CardType.Mod]: 0,
  [CardType.ResourcePack]: 0,
  [CardType.Save]: 0,
  [CardType.ShaderPack]: 0,
} as Record<string, number>)

const screenshotHeight = ref(0)

const saveLayouts = debounce(() => {
  homeLayout.value = layouts.value
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

const getRowCount = (width: number) => width ? Math.floor((width - 34) / 30) : 7
const resourcePackRowCount = computed(() => getRowCount(containerWidths[CardType.ResourcePack]))
const modRowCount = computed(() => getRowCount(containerWidths[CardType.Mod]))
const saveRowCount = computed(() => getRowCount(containerWidths[CardType.Save]))
</script>


<style scoped>
.vue-grid-layout {
  padding: 0 4px;
}

.vue-grid-item:not(.vue-grid-placeholder) {
    /* background: #ccc; */
}

.vue-grid-placeholder {
  background: var(--color-primary);
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
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><circle cx='5' cy='5' r='5' fill='#FFFFFF'/></svg>") no-repeat;
    background-position: bottom right;
    padding: 0 8px 8px 0;
    background-repeat: no-repeat;
    background-origin: content-box;
    box-sizing: border-box;
    cursor: pointer;
}
</style>
