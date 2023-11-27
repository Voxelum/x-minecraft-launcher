<template>
  <div class="relative flex gap-4">
    <div
      class="absolute left-0 flex h-full items-center lg:static"
      @click="prev"
    >
      <v-btn icon>
        <v-icon>
          chevron_left
        </v-icon>
      </v-btn>
    </div>
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
          class="flex h-40 max-h-40 max-w-full overflow-auto"
          @click="$emit('enter', g)"
        >
          <img
            v-if="g.logo"
            :src="g.logo"
            class="white--text w-30 h-30"
          >
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
                :ripple="false"
                small
              >
                {{ c }}
              </v-chip>
            </v-card-actions>
          </div>
        </v-card>
      </div>
    </Transition>
    <div
      class="absolute right-0 flex h-full items-center lg:static"
      @click="next"
    >
      <v-btn icon>
        <v-icon>
          chevron_right
        </v-icon>
      </v-btn>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useDateString } from '@/composables/date'
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
