<template>
  <div class="relative flex w-full select-none gap-4">
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
      class="elevation-1 w-full"
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
        class="grid w-full gap-4 overflow-auto"
        :style="{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        }"
      >
        <v-card
          v-for="g of currentGroup"
          :key="g.id"
          class="flex flex-col overflow-auto"
          outlined
          @click="$emit('enter', g)"
        >
          <v-img
            v-if="g.image"
            :src="g.image"
            height="200px"
            class="flex-shrink flex-grow-0"
          />
          <v-card-subtitle class="h-[98px] flex-grow">
            <v-icon
              class="mr-1"
              size="16"
            >
              {{ g.type === 'modrinth' ? '$vuetify.icons.modrinth': '$vuetify.icons.curseforge' }}
            </v-icon> {{ g.title }}
          </v-card-subtitle>

          <v-divider />
          <v-card-actions>
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
                $vuetify.icons.minecraft
              </v-icon>
              {{ g.gameVersion }}
            </v-chip>
            <div class="flex-grow" />
            <v-chip
              v-for="c of g.categories.slice(0, 1)"
              :key="c"
              small
              :ripple="false"
            >
              {{ c }}
            </v-chip>
          </v-card-actions>
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
import { useBreakpoints } from '@vueuse/core'

const props = defineProps<{
  items: ListGalleryItem[]
}>()

defineEmits<{
  enter: (item: ListGalleryItem) => void
}>()

const breakpoints = useBreakpoints({
  sm: 240 * 5,
  md: 240 * 6,
}, { window })
const current = breakpoints.current()

export interface ListGalleryItem {
  id: string
  type: string
  image: string
  title: string
  gameVersion: string
  categories: string[]
}

const size = computed(() => {
  const size = current.value.includes('sm')
    ? current.value.includes('md') ? 6 : 5
    : 4
  return size
})

const grouped = computed(() => {
  const group: ListGalleryItem[][] = []
  const _sz = size.value
  for (let i = 0; i < props.items.length; i += _sz) {
    group.push(props.items.slice(i, i + _sz))
  }
  return group
})

const index = ref(0)
const currentGroup = computed(() => grouped.value[index.value])

const next = () => {
  index.value = (index.value + 1) % grouped.value.length
}
const prev = () => {
  index.value = (index.value - 1 + grouped.value.length) % grouped.value.length
}
</script>
