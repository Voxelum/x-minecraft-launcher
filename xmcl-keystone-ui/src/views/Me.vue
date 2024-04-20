<template>
  <div
    ref="container"
    class="visible-scroll h-full select-none overflow-auto pb-8"
    @wheel="onWheel"
  >
    <div
      class="z-2 relative flex w-full flex-col py-4"
      @dragover.prevent
    >
      <div
        v-if="displayNewsHeader"
        class="absolute right-2 top-4"
      >
        <v-btn
          id="hide-news-button"
          v-shared-tooltip.left="_ => t('setting.hideNewsHeader')"
          icon
          text
          @click="displayNewsHeader = false"
        >
          <v-icon>
            visibility
          </v-icon>
        </v-btn>
      </div>
      <transition
        v-if="displayNewsHeader"
        name="fade-transition"
        mode="out-in"
      >
        <section class="pt-25 mt-5 max-h-[480px] min-h-[480px] px-10">
          <div
            v-if="currentNews"
            :key="currentNews.title"
          >
            <div
              class="mt-10 text-5xl font-bold"
              style="letter-spacing: 1.5px"
            >
              {{ currentNews.title }}
            </div>
            <div class="mt-4 text-lg dark:text-gray-400">
              {{ getDateString(currentNews?.date, { dateStyle: 'long' }) }}
            </div>
            <div class="mt-2 text-xl">
              {{ currentNews?.description }}
            </div>
            <div class="mt-4">
              <v-btn
                color="primary"
                large
                @click="openInBrowser(currentNews.link)"
              >
                {{ t('news.readMore') }}
              </v-btn>
            </div>
          </div>
        </section>
      </transition>

      <section class="mt-4 px-2">
        <MeSectionHeader :title="t('me.news')">
          <template #extra>
            <v-btn
              v-if="!displayNewsHeader"
              v-shared-tooltip.left="t('setting.showNewsHeader')"
              icon
              text
              @click="displayNewsHeader = true"
            >
              <v-icon>
                visibility_off
              </v-icon>
            </v-btn>
          </template>
        </MeSectionHeader>
        <div
          ref="newsContainer"
          class="flex w-full gap-4 overflow-x-auto overflow-y-hidden p-2"
          @wheel.stop="onNewsWheel"
        >
          <div
            v-for="(n, i) of allNews"
            :key="n.title"
            class="gap-2"
            @mouseenter="current = i"
            @click="openInBrowser(n.link)"
          >
            <v-chip
              label
              outlined
              small
            >
              <v-icon left>
                event
              </v-icon>
              {{ getDateString(n.date, { dateStyle: 'long' }) }}
            </v-chip>
            <v-chip
              v-if="n.category"
              label
              class="float-right"
              color="primary"
              outlined
              small
            >
              {{ n.category }}
            </v-chip>
            <v-img
              class="mt-2 rounded-lg"
              :src="n.image.url"
              :width="n.image.width / 2"
              :height="n.image.height / 2"
            >
              <div
                class="flex h-full w-full cursor-pointer items-center justify-center bg-[rgba(123,123,123,0.5)] opacity-0 transition-all duration-300 hover:opacity-100"
              >
                {{ n.description }}
              </div>
            </v-img>
            <div class="font-lg mt-1.5 font-bold">
              {{ n.title }}
            </div>
          </div>
        </div>
      </section>
      <section class="mt-4 px-2">
        <MeSectionHeader
          id="my-stuff-header"
          :title="options.find(o => o.value === currentDisplaied)?.text ?? ''"
          :options="options"
          @select="currentDisplaied = $event"
        />
        <InstancesCards
          v-if="currentDisplaied === ''"
          :instances="sorted"
          class="px-2"
          @select="onInstanceClick"
        />
        <ResourceManageModpack
          v-else-if="currentDisplaied === 'modpack'"
          class="mt-2"
        />
        <ResourceManageVersions
          v-else-if="currentDisplaied === 'version'"
          class="mt-2"
        />
      </section>
    </div>
  </div>
</template>

<script lang=ts setup>
import { useLocalStorageCacheBool } from '@/composables/cache'
import { useDateString } from '@/composables/date'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { useMojangNews } from '@/composables/mojangNews'
import { LauncherNews, useLauncherNews } from '@/composables/launcherNews'
import { useScrollRight } from '@/composables/scroll'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { ref } from 'vue'
import MeSectionHeader from './MeSectionHeader.vue'

import { useQuery } from '@/composables/query'
import InstancesCards from './InstancesCards.vue'
import ResourceManageModpack from './ResourceManageModpack.vue'
import ResourceManageVersions from './ResourceManageVersions.vue'
import { useTutorial } from '@/composables/tutorial'
import { DriveStep } from 'driver.js'
import { kTheme } from '@/composables/theme'

const currentDisplaied = useQuery('view')

const { t } = useI18n()
const { news } = useMojangNews()
const { news: launcherNews } = useLauncherNews()
const { backgroundImageOverride } = injection(kTheme)

const allNews = computed(() => {
  const result: LauncherNews[] = [
    ...launcherNews.value,
    ...news.value.map(n => ({
      title: n.title,
      category: n.tag,
      date: n.date,
      description: n.text,
      image: {
        url: n.newsPageImage.url,
        width: n.newsPageImage.dimensions.width,
        height: n.newsPageImage.dimensions.height,
      },
      link: n.readMoreLink,
    })),
  ]
  return result.sort((a, b) => -Date.parse(a.date) + Date.parse(b.date))
})
const { getDateString } = useDateString()

const options = computed(() => [{
  text: t('me.games', 2),
  value: '',
  icon: 'apps',
},
{
  text: t('me.versions', 2),
  value: 'version',
  icon: 'power',
},
{
  text: t('me.modpacks', 2),
  value: 'modpack',
  icon: 'inventory_2',
}])

const displayNewsHeader = useLocalStorageCacheBool('displayNewsHeader', true)

const current = ref(0)
const currentNews = computed(() => allNews.value[current.value])
const { instances } = injection(kInstances)
const sorted = computed(() => [...instances.value].sort((a, b) => -a.lastAccessDate + b.lastAccessDate))

watch([displayNewsHeader, currentNews], ([v, cur]) => {
  if (v) {
    backgroundImageOverride.value = cur?.image.url
  } else {
    backgroundImageOverride.value = ''
  }
}, { immediate: true })

onUnmounted(() => {
  backgroundImageOverride.value = ''
})

const opacity = ref(1)

const newsContainer = ref(null as null | HTMLDivElement)
const { onWheel: onNewsWheel } = useScrollRight(newsContainer)

const container = ref(undefined as undefined | HTMLDivElement)
const onWheel = (e: WheelEvent) => {
  const element = container.value
  if (!element) return
  const maxVal = element.scrollHeight - element.clientHeight
  const currentVal = element.scrollTop
  opacity.value = 1 - currentVal / maxVal
}

const { path } = injection(kInstance)
const { push, currentRoute } = useRouter()
const onInstanceClick = (instance: string) => {
  if (currentRoute.path === '/') return
  path.value = instance
  push('/')
}

const openInBrowser = (url: string) => {
  window.open(url, 'browser')
}

// Tutorial
useTutorial(computed(() => {
  const steps: DriveStep[] = [
    { element: '#hide-news-button', popover: { title: t('setting.hideNewsHeader'), description: t('tutorial.hideNewsHeaderDescription') } },
    { element: '#my-stuff-header', popover: { title: t('me.recentPlay'), description: t('tutorial.recentPlayDescription') } },
  ]
  return steps
}))

</script>
