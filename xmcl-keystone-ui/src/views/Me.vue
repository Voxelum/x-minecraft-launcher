<template>
  <div
    ref="container"
    class="visible-scroll h-full overflow-auto"
    @wheel="onWheel"
  >
    <ImageGradient
      v-if="news[0]"
      class="fixed transition-opacity duration-500"
      :opacity="opacity"
      :news="news[0]"
    />
    <div
      class="footer me z-2 relative flex w-full flex-col py-4"
      @dragover.prevent
    >
      <!-- background description -->
      <section class="message-box text-align-left py-25 mt-5 px-10">
        <div class="mt-10 text-5xl font-bold">
          {{ news[0]?.title }}
        </div>
        <div class="mt-4 text-lg">
          {{ getDateString(news[0]?.date) }}
          {{ news[0]?.category }}
        </div>
        <div class="mt-2 text-xl">
          {{ news[0]?.text }}
        </div>
        <div class="mt-4">
          <v-btn
            color="primary"
            large
          >
            {{ t('news.readMore') }}
          </v-btn>
        </div>
      </section>
      <!-- extra news -->
      <section class="news-box mt-4 px-2">
        <h2 class="text-align-left">
          {{ t('me.news') }}
        </h2>
        <div
          ref="containerSecondLayer"
          class="row-span-4 flex w-full gap-4 overflow-x-auto overflow-y-hidden "
        >
          <div
            v-for="n of news"
            :key="n.id"
            class="flex flex-col gap-2 "
          >
            <div class="v-subtitle text-sm">
              {{ n.date }}
            </div>
            <v-img
              class="rounded-lg "
              :src="n.newsPageImage.url"
              :width="n.newsPageImage.dimensions.width / 2"
              :height="n.newsPageImage.dimensions.height / 2"
            >
              <div class="flex h-full w-full cursor-pointer items-center justify-center bg-[rgba(123,123,123,0.5)] opacity-0 transition-all duration-300 hover:opacity-100">
                {{ n.text }}
              </div>
            </v-img>
            <div>
              {{ n.title }}
            </div>
          </div>
        </div>
      </section>
      <!-- my instance -->
      <section class="instance-box mt-4 px-2">
        <h2 class="text-align-left">
          {{ t('me.recentPlay') }}
        </h2>
        <div class="row-span-4 flex w-full gap-4 overflow-x-auto overflow-y-hidden">
          <div
            v-for="i of sorted"
            :key="i.path"
            class="flex flex-shrink flex-grow-0 flex-col items-center"
          >
            <img
              width="64"
              height="64"
              :src="getInstanceIcon(i, undefined)"
              class="z-10 max-h-[64px] max-w-[64px] rounded-lg"
            >
            <v-card
              outlined
              class="h-30 w-35 -my-5 px-2 py-7"
            >
              <div class="v-btn max-h-12 overflow-hidden overflow-ellipsis">
                {{ i.name }}
              </div>
              <v-subheader>
                {{ getAgoOrDate(i.lastAccessDate) }}
              </v-subheader>
            </v-card>
            <v-btn class="primary">
              <v-icon>
                play_arrow
              </v-icon>
            </v-btn>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang=ts setup>
import { kInstances } from '@/composables/instances'
import { useMojangNews } from '@/composables/mojangNews'
import { getAgoOrDate } from '@/util/date'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'

import { useDateString } from '@/composables/date'
import { onMounted, ref } from 'vue'
import ImageGradient from './ImageGradient.vue'

const { t } = useI18n()
const { refresh, news } = useMojangNews()
onMounted(refresh)

const { getDateString } = useDateString()

const { instances } = injection(kInstances)
const sorted = computed(() => [...instances.value].sort((a, b) => a.lastAccessDate - b.lastAccessDate).slice(0, 5))

// 透明度代码
const opacity = ref(1) // 初始透明度设为1

const container = ref(undefined as undefined | HTMLDivElement)
const onWheel = (e: WheelEvent) => {
  const element = container.value
  if (!element) return
  const maxVal = element.scrollHeight - element.clientHeight
  const currentVal = element.scrollTop
  opacity.value = 1 - currentVal / maxVal
}

</script>

<style>

.me .theme--dark.v-tabs-items {
  background-color: transparent;
}
.me .v-window__container {
  height: 100%;
}

.me .v-tabs-items {
  background: transparent !important;
  background-color: transparent !important;
}
.bottom-layer {
  position: relative; /* 或者 absolute, fixed, sticky */
  z-index: 1; /* 较低的z-index值 */
}

.second-layer {
  position: absolute; /* 或者 relative, fixed, sticky */
  z-index: 2; /* 较高的z-index值 */
  top: 10px; /* 你可以根据需要调整位置 */
  left: 10px; /* 你可以根据需要调整位置 */
}
.footer {
  width: 100%;
  color: white;
  text-align: center;
  padding: 10px 0;
  /* 如果你需要清除浮动或其他布局问题 */
}
/* .cover {
    width: 180px;
    height: 180px;
    position: relative;
} */
.dynamicOpacity{
  transition: opacity 0.3s;
  opacity: dynamicOpacity;
}
.cover {
    position: relative;
}
.cover:after {
    position: absolute;
    content: '';
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    box-shadow:0 0 60px 60px #000000 inset;
}
.top-layer-news-title{
  font-size: 700px;
}
.text-align-left {
  text-align: left;
}
.message-box {

  height:50%;   /* 视口的高度 */
}
.news-box {

height:25%;   /* 视口的高度 */
}
.instance-box {

height:25%;   /* 视口的高度 */
}

</style>
<style scoped>
h2 {
  @apply heading-2 mt-4 mb-2 text-lg;
}
</style>
