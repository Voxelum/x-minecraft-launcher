<template>
  <div>
    <GridLayout
      :layout.sync="layout"
      :is-draggable="true"
      :col-num="12"
      :row-height="30"
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
      >
        <HomeModCard
          v-if="isType(item.i, CardType.Mod)"
        />
        <HomeResourcePacksCard
          v-else-if="isType(item.i, CardType.ResourcePack)"
        />
        <HomeShaderPackCard
          v-else-if="isType(item.i, CardType.ShaderPack)"
        />
        <HomeSavesCard
          v-else-if="isType(item.i, CardType.Save)"
        />
        <HomeServerStatusBar
          v-else-if="isServer && isType(item.i, CardType.ServerStatus)"
        />
        <HomeUpstreamCard
          v-else-if="instance.upstream && isType(item.i, CardType.Upstream)"
          class="col-span-2"
          :instance="instance"
          :upstream="instance.upstream"
        />
      </GridItem>
    </GridLayout>
    <div class="flex flex-col gap-4 mx-4 mt-4">
      <HomeNewsCard
        v-for="n of news"
        :key="n.id"
        :news="n"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>

import HomeModCard from './HomeModCard.vue'
import HomeUpstreamCard from './HomeUpstreamCard.vue'
import HomeResourcePacksCard from './HomeResourcePacksCard.vue'
import HomeSavesCard from './HomeSavesCard.vue'
import HomeServerStatusBar from './HomeServerStatusBar.vue'
import HomeShaderPackCard from './HomeShaderPackCard.vue'
import HomeNewsCard from './HomeNewsCard.vue'
import { Instance } from '@xmcl/runtime-api'
import { useMojangNews } from '@/composables/mojangNews'
import { GridLayout, GridItem } from 'vue-grid-layout'

defineProps<{
  isServer: boolean
  instance: Instance
}>()

enum CardType {
  Mod,
  ResourcePack,
  ShaderPack,
  Save,
  ServerStatus,
  Upstream,
  News,
}

function rawType(type: CardType) {
  return type + ''
}

function isType(id: string, type: CardType) {
  const [typeString, param] = id.split('@')
  return Number(typeString) === type
}

function getNewsParamter(id: string) {
  const [typeString, param] = id.split('@')
  return Number(param)
}

function generateNewsId(index: number) {
  return `${CardType.News}@${index}`
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

const layout = ref([
  { x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.Mod) },
  { x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.ResourcePack) },
  { x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.ShaderPack) },
  { x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 4, i: rawType(CardType.Save) },
  { x: 0, y: 4, w: 4, h: 6, minW: 4, minH: 6, i: rawType(CardType.ServerStatus) },
  { x: 6, y: 4, w: 4, h: 4, minW: 3, minH: 4, i: rawType(CardType.Upstream) },
] as GridItemType[])

const { refresh, news } = useMojangNews()
onMounted(async () => {
  await refresh()
  // for (let i = 0; i < news.value.length; ++i) {
  //   generateNews(i)
  // }
})

// function generateNews(index: number) {
//   // Add a new item. It must have a unique key!
//   layout.value.push({
//     x: (layout.value.length * 3) % (12),
//     y: layout.value.length + (12), // puts it at the bottom
//     w: 3,
//     h: 8,
//     i: generateNewsId(index),
//   })
//   // Increment the counter to ensure key is always unique.
// }

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
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><circle cx='5' cy='5' r='5' fill='#999999'/></svg>") no-repeat;
    background-position: bottom right;
    padding: 0 8px 8px 0;
    background-repeat: no-repeat;
    background-origin: content-box;
    box-sizing: border-box;
    cursor: pointer;
}
</style>
