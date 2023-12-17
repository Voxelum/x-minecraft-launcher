<template>
  <div
    class="me flex h-full max-h-full w-full flex-col overflow-auto p-4 pl-6"
    @dragover.prevent
  >
    <section class="">
      <h2>
        {{ t('me.news') }}
      </h2>
      <div
        ref="container"
        class="row-span-4 flex w-full gap-4 overflow-x-auto overflow-y-hidden"
        @wheel="onWheel"
      >
        <div
          v-for="n of news"
          :key="n.id"
          class="flex flex-col gap-2"
        >
          <div class="v-subtitle text-sm">
            {{ n.date }}
          </div>
          <v-img
            class="rounded-lg"
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

    <section class="mt-4">
      <h2>
        {{ t('me.recentPlay') }}
      </h2>
      <div class="row-span-4 flex w-full gap-4 overflow-x-auto overflow-y-hidden">
        <div
          v-for="i of sorted"
          :key="i.path"
          class="flex flex-shrink flex-grow-0 flex-col items-center "
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
              {{ getDateString(i.lastAccessDate) }}
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
</template>

<script lang=ts setup>
import { useDateString } from '@/composables/date'
import { kInstances } from '@/composables/instances'
import { useMojangNews } from '@/composables/mojangNews'
import { useScrollRight } from '@/composables/scroll'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'

const { t } = useI18n()
const { refresh, news } = useMojangNews()
const { getDateString } = useDateString()
onMounted(refresh)

const { instances } = injection(kInstances)
const sorted = computed(() => [...instances.value].sort((a, b) => a.lastAccessDate - b.lastAccessDate).slice(0, 5))

const container = ref(null as null | HTMLElement)
const { onWheel } = useScrollRight(container)
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
</style>
<style scoped>
h2 {
  @apply heading-2 mt-4 mb-2 text-lg;
}
</style>
