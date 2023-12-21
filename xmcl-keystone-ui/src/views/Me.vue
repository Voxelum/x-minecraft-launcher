<template>
  <div>
    <!-- bottom layer img -->
    <div class="bottom-layer fixed mt-4">
      <h2></h2>
      <div
        class="row-span-4 flex w-full gap-4 overflow-x-auto overflow-y-hidden"
      >
        <div
          v-for="n of news"
          :key="n.id"
          class="flex flex-col gap-2"
        >
          <!-- <div class="v-subtitle text-sm">
            {{ n.date }}
          </div>
          <div>
            {{ n.title }}
          </div> -->
          <v-img
            class=" background-opacity rounded-lg "
            :src="n.newsPageImage.url"
            :width="n.newsPageImage.dimensions.width *2"
            :height="n.newsPageImage.dimensions.height *2"
            :style="{ opacity: dynamicOpacity }"
          >
            <div class="flex h-full w-full cursor-pointer items-center justify-center bg-[rgba(123,123,123,0.5)] opacity-0 transition-all duration-300 hover:opacity-100">
              {{ n.text }}
            </div>
          </v-img>
        </div>
      </div>
    </div>
    <!-- second layer content -->
    <div
      class="second-layer two-times-hight footer me flex   w-full flex-col overflow-auto p-4 pl-6"
      @dragover.prevent
    >
      <!-- background description -->
      <section class="message-box text-align-left mt-5 ">
        <div class="">
          lol
        </div>
        <div>
          lol
        </div>
      </section>
      <!-- extra news -->
      <section class="news-box mt-4 ">
        <h2 class="text-align-left">
          {{ t('me.news') }}
        </h2>
        <div
          ref="containerSecondLayer"
          class="row-span-4 flex w-full gap-4 overflow-x-auto overflow-y-hidden "
          @wheel="onWheelSecond"
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
      <section class="instance-box mt-4 ">
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
import { useScrollRight } from '@/composables/scroll'
import { getAgoOrDate } from '@/util/date'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'

import { ref, onMounted, onBeforeUnmount } from 'vue'

const { t } = useI18n()
const { refresh, news } = useMojangNews()
onMounted(refresh)

const { instances } = injection(kInstances)
const sorted = computed(() => [...instances.value].sort((a, b) => a.lastAccessDate - b.lastAccessDate).slice(0, 5))

// const containerBottomLayer = ref(null as null | HTMLElement)
// const { onWheel: onWheelBottom } = useScrollRight(containerBottomLayer)

const containerSecondLayer = ref(null as null | HTMLElement)
const { onWheel: onWheelSecond } = useScrollRight(containerSecondLayer)
// 透明度代码
const dynamicOpacity = ref(1) // 初始透明度设为1

// 更新透明度的函数
function updateOpacity() {
  const scrollY = window.scrollY || window.pageYOffset
  const height = document.documentElement.scrollHeight - window.innerHeight
  const scrolled = scrollY / height
  dynamicOpacity.value = 1 - Math.min(scrolled, 1) // 确保透明度在0到1之间
}

// 在组件挂载时添加事件监听器
onMounted(() => {
  window.addEventListener('scroll', updateOpacity)
})

// 在组件销毁前移除事件监听器
onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateOpacity)
})

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
.two-times-hight{
  height: 180%;
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
