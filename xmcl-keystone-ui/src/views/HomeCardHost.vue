<template>
  <div class="select-none mx-4 relative">
    <SharedTooltip />
    <GridLayout
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
        drag-allow-from=".v-card__title"
        drag-ignore-from=".no-drag"
        @container-resized="onResized"
        @resized="onResized"
      >
        <!-- <span class="absolute left-0 top-0 z-10">
          {{ item.x }} {{ item.y }}
          {{ item.w }} {{ item.h }}
        </span> -->
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
          :height="item.h * 32"
          :instance="instance"
        />
      </GridItem>
    </GridLayout>

    <v-divider class="my-4" />
    <HomeServerStatusBar v-if="isServer" />
    <HomeCurseforgeUpstream
      v-else-if="instance.upstream && instance.upstream.type === 'curseforge-modpack'"
      :instance="instance"
      :upstream="instance.upstream"
    />
    <HomeModrinthUpstream
      v-else-if="instance.upstream && instance.upstream.type === 'modrinth-modpack'"
      :instance="instance"
      :upstream="instance.upstream"
    />
    <GridLayout
      v-else
      :layout.sync="newsLayout"
      :is-draggable="false"
      :col-num="12"
      :row-height="30"
      :is-resizable="false"
      :responsive="false"
      :vertical-compact="true"
      :use-css-transforms="true"
    >
      <GridItem
        v-for="item in newsLayout"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :min-w="item.minW"
        :min-h="item.minH"
        :i="item.i"
      >
        <HomeNewsCard
          :news="news[Number(item.i)]"
        />
      </GridItem>
    </GridLayout>
  </div>
</template>
<script lang="ts" setup>

import { useMojangNews } from '@/composables/mojangNews'
import { kSharedTooltip, useSharedTooltip } from '@/composables/sharedTooltip'
import { Instance } from '@xmcl/runtime-api'
import { GridItem, GridLayout } from 'vue-grid-layout'
import SharedTooltip from '../components/SharedTooltip.vue'
import HomeCurseforgeUpstream from './HomeCurseforgeUpstream.vue'
import HomeModCard from './HomeModCard.vue'
import HomeModrinthUpstream from './HomeModrinthUpstream.vue'
import HomeNewsCard from './HomeNewsCard.vue'
import HomeResourcePacksCard from './HomeResourcePacksCard.vue'
import HomeSavesCard from './HomeSavesCard.vue'
import HomeScreenshotCard from './HomeScreenshotCard.vue'
import HomeServerStatusBar from './HomeServerStatusBar.vue'
import HomeShaderPackCard from './HomeShaderPackCard.vue'

provide(kSharedTooltip, useSharedTooltip<string>((content) => {
  return content
}))

defineProps<{
  isServer: boolean
  instance: Instance
}>()

enum CardType {
  Mod,
  ResourcePack,
  ShaderPack,
  Save,
  Screenshots,
}

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

const layouts = reactive({
  md: [
    { x: 0, y: 0, w: 3, h: 9, minW: 2, minH: 4, i: rawType(CardType.Mod) },
    { x: 9, y: 0, w: 3, h: 9, minW: 2, minH: 4, i: rawType(CardType.ResourcePack) },
    { x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.Save) },
    { x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.ShaderPack) },
    { x: 3, y: 4, w: 6, h: 5, minW: 3, minH: 4, i: rawType(CardType.Screenshots) },
    // { x: 0, y: 4, w: 4, h: 6, minW: 4, minH: 6, i: rawType(CardType.ServerStatus) },
    // { x: 6, y: 4, w: 4, h: 4, minW: 3, minH: 4, i: rawType(CardType.Upstream) },
  ],
  lg: [
    { x: 0, y: 0, w: 3, h: 9, minW: 2, minH: 4, i: rawType(CardType.Mod) },
    { x: 9, y: 0, w: 3, h: 9, minW: 2, minH: 4, i: rawType(CardType.ResourcePack) },
    { x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.Save) },
    { x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.ShaderPack) },
    { x: 3, y: 4, w: 6, h: 5, minW: 3, minH: 4, i: rawType(CardType.Screenshots) },
    // { x: 0, y: 4, w: 4, h: 6, minW: 4, minH: 6, i: rawType(CardType.ServerStatus) },
    // { x: 6, y: 4, w: 4, h: 4, minW: 3, minH: 4, i: rawType(CardType.Upstream) },
  ],
  sm: [
    { x: 0, y: 0, w: 2, h: 6, minW: 2, minH: 4, i: rawType(CardType.Mod) },
    { x: 2, y: 0, w: 2, h: 5, minW: 2, minH: 4, i: rawType(CardType.ResourcePack) },
    { x: 2, y: 5, w: 2, h: 5, minW: 2, minH: 4, i: rawType(CardType.ShaderPack) },
    { x: 0, y: 6, w: 2, h: 4, minW: 2, minH: 4, i: rawType(CardType.Save) },
    { x: 4, y: 0, w: 2, h: 10, minW: 2, minH: 4, i: rawType(CardType.Screenshots) },
    // { x: 0, y: 4, w: 4, h: 6, i: rawType(CardType.ServerStatus) },
    // { x: 0, y: 4, w: 4, h: 4, i: rawType(CardType.Upstream) },
  ],
  xs: [
    { x: 0, y: 0, w: 2, h: 6, i: rawType(CardType.Mod) },
    { x: 2, y: 4, w: 2, h: 4, i: rawType(CardType.Save) },
    { x: 2, y: 0, w: 2, h: 4, i: rawType(CardType.ResourcePack) },
    { x: 0, y: 6, w: 2, h: 4, i: rawType(CardType.ShaderPack) },
    // { x: 0, y: 4, w: 4, h: 6, i: rawType(CardType.ServerStatus) },
    // { x: 0, y: 4, w: 4, h: 4, i: rawType(CardType.Upstream) },
    // { x: 0, y: 4, w: 4, h: 4, i: rawType(CardType.Screenshots) },
  ],
})

const layout = ref([
  { x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.Mod) },
  { x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.ResourcePack) },
  { x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.ShaderPack) },
  { x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.Save) },
  { x: 6, y: 4, w: 4, h: 4, minW: 3, minH: 4, i: rawType(CardType.Screenshots) },
] as GridItemType[])

const containerWidths = reactive({
  [CardType.Mod]: 0,
  [CardType.ResourcePack]: 0,
  [CardType.Save]: 0,
  [CardType.ShaderPack]: 0,
} as Record<string, number>)

const onResized = (i: string, newH: number, newW: number, newHPx: number, newWPx: number) => {
  containerWidths[i] = newWPx
}

const getRowCount = (width: number) => width ? Math.floor((width - 34) / 30) : 7
const resourcePackRowCount = computed(() => getRowCount(containerWidths[CardType.ResourcePack]))
const modRowCount = computed(() => getRowCount(containerWidths[CardType.Mod]))
const saveRowCount = computed(() => getRowCount(containerWidths[CardType.Save]))

const newsLayout = ref([] as GridItemType[])

const { t } = useI18n()
const { refresh, news } = useMojangNews()
onMounted(async () => {
  await refresh()
  const layout = [] as GridItemType[]
  for (let i = 0; i < news.value.length; ++i) {
    const n = news.value[i]
    const titleLines = Math.floor(n.title.length / 28)
    const textLine = Math.floor(n.text.length / 40)
    const x = (layout.length * 3) % (12)
    let y: number
    if ((layout.length - 3) > 0) {
      const lastLayout = layout[layout.length - 3]
      y = lastLayout.y + lastLayout.h
    } else {
      y = 0
    }
    const newLayout = {
      x,
      y,
      w: 3,
      h: 10 + titleLines + textLine,
      i: i.toString(),
    }
    layout.push(newLayout)
  }
  newsLayout.value = layout
})

</script>

<style scoped>
.vue-grid-layout {
  padding: 0 4px;
}

.vue-grid-item:not(.vue-grid-placeholder) {
    /* background: #ccc; */
}

.vue-grid-placeholder {
  background: var(--primary);
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
