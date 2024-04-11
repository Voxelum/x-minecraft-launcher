<template>
  <div class="relative flex gap-4">
    <div
      class="absolute left-0 flex h-full items-center lg:static"
    >
      <v-btn
        icon
        @click="prev"
      >
        <v-icon>
          chevron_left
        </v-icon>
      </v-btn>
    </div>
    <!-- <v-window
      v-model="index"
      class="elevation-1"
    >
      <v-window-item
        v-for="(currentGroup, i) of grouped"
        :key="i"
      > -->
    <Transition
      mode="out-in"
      transition="fade-transition"
    >
      <div
        :key="index"
        class="grid select-none gap-4 overflow-auto"
        :class="{
          'grid-cols-3': !shrink,
          'grid-cols-2': shrink,
        }"
      >
        <v-card
          v-for="g of currentGroup"
          :key="g.id"
          class="flex h-40 max-h-40 max-w-full overflow-auto overflow-x-hidden"
          @click="$emit('enter', g)"
        >
          <v-img
            :src="g.logo"
            class="white--text max-w-36 min-w-36"
          />
          <div class="flex max-w-full flex-col overflow-auto">
            <v-card-title class="ml-1 max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap pt-3">
              {{ g.title }}
            </v-card-title>

            <v-card-subtitle class="description  ml-1">
              {{ g.description }}
            </v-card-subtitle>
            <div class="flex-grow" />
            <v-divider />
            <v-card-actions class="ml-1 flex max-h-10 gap-2 ">
              <v-chip
                small
                :ripple="false"
                outlined
              >
                <v-icon
                  size="20"
                  left
                  class="material-icons-outlined "
                >
                  update
                </v-icon>
                {{ getDateString(g.updatedAt) }}
              </v-chip>
              <div class="flex-grow" />
              <v-icon
                size="16"
              >
                {{ g.type === 'modrinth' ? '$vuetify.icons.modrinth': '$vuetify.icons.curseforge' }}
              </v-icon>
              <v-chip
                v-for="c of g.categories.slice(0, 2)"
                :key="c"
                v-shared-tooltip="c"
                class="hidden lg:block"
                :ripple="false"
                small
              >
                <span class="overflow-hidden overflow-ellipsis whitespace-nowrap">
                  {{ c }}
                </span>
              </v-chip>
            </v-card-actions>
          </div>
        </v-card>
      </div>
    </Transition>
    <!-- </v-window-item>
    </v-window> -->
    <div
      class="absolute right-0 flex h-full items-center lg:static"
    >
      <v-btn
        icon
        @click="next"
      >
        <v-icon>
          chevron_right
        </v-icon>
      </v-btn>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useDateString } from '@/composables/date'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { useBreakpoints } from '@vueuse/core'

const props = defineProps<{
  items: GridGalleryItem[]
}>()

export interface GridGalleryItem {
  id: string
  type: string
  logo: string
  title: string
  description: string
  downloads: number
  categories: string[]
  follows: number
  updatedAt: string
}

const { getDateString } = useDateString()

const breakpoints = useBreakpoints({
  sm: 1300,
}, { window })
const current = breakpoints.current()

const shrink = computed(() => !current.value.includes('sm'))

const grouped = computed(() => {
  const group: GridGalleryItem[][] = []
  const size = shrink.value ? 4 : 6
  for (let i = 0; i < props.items.length; i += size) {
    group.push(props.items.slice(i, i + size))
  }
  return group
})

const index = ref(0)
const currentGroup = computed(() => grouped.value[index.value])

defineEmits<{
  (event: 'enter', object: GridGalleryItem): void
}>()

const next = () => {
  index.value = (index.value + 1) % grouped.value.length
}
const prev = () => {
  index.value = (index.value - 1 + grouped.value.length) % grouped.value.length
}

</script>
<style scoped>
.description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 64px;
}
</style>
