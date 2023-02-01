<template>
  <div
    class="flex flex-col h-full overflow-auto w-full me max-h-full px-4"
    @dragover.prevent
  >
    <section class="">
      <v-subheader>
        News
      </v-subheader>
      <div class="flex overflow-x-auto overflow-y-hidden row-span-4 w-full gap-4">
        <div
          v-for="n of news"
          :key="n.id"
        >
          <div>{{ n.date }}</div>
          <v-img
            :src="n.newsPageImage.url"
            :width="n.newsPageImage.dimensions.width / 2"
            :height="n.newsPageImage.dimensions.height / 2"
          >
            <div class="hover:opacity-100 opacity-0 bg-[rgba(123,123,123,0.5)] w-full h-full transition-all duration-300 flex items-center justify-center">
              {{ n.text }}
            </div>
          </v-img>
          <div>
            {{ n.title }}
          </div>
        </div>
      </div>
    </section>

    <section>
      <v-subheader>
        Recent Played
      </v-subheader>
      <div class="flex overflow-x-auto overflow-y-hidden row-span-4 w-full gap-4">
        <div
          v-for="i of sorted"
          :key="i.path"
          class="flex flex-col flex-grow-0 flex-shrink items-center "
        >
          <img
            width="64"
            height="64"
            :src="getInstanceIcon(i, undefined)"
            class="z-10 max-w-[64px] max-h-[64px] rounded-lg"
          >
          <v-card
            outlined
            class="-mt-5 py-7 px-2 h-50 w-30 -mb-5"
          >
            {{ i.name }}
            {{ getLocalDateString(i.lastAccessDate) }}
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
import { useInstances } from '@/composables/instance'
import { useMojangNews } from '@/composables/mojangNews'
import { getLocalDateString } from '@/util/date'
import { getInstanceIcon } from '@/util/favicon'

const { t } = useI18n()
const { refresh, news } = useMojangNews()
onMounted(refresh)
const { instances } = useInstances()
const sorted = computed(() => instances.value.sort((a, b) => a.lastAccessDate - b.lastAccessDate).slice(0, 5))
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
