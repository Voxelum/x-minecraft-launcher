<template>
  <v-tooltip
    v-model="isShown"
    :color="cached?.color"
    :transition="{
      name: 'scroll-y-reverse-transition',
      duration: {
        leave: 0,
        enter: 200,
      }
    }"
    :target="[cached.x, cached.y]"
    class="z-1000"
    :location="location"
  >
    {{ cached.text }}
    <div
      v-if="cached.items"
      class="flex gap-1 items-center"
    >
      <template 
        v-for="r of cached.items" 
        :key="r.icon + 'icon'"
      >
        <v-avatar
          size="28"
        >
          <v-img :src="r.icon" />
        </v-avatar>
        {{ r.text }}
      </template>
    </div>
    <template v-if="cached.list">
      <ul class="pl-2">
        <li
          v-for="i in cached.list"
          :key="i"
        >
          {{ i }}
        </li>
      </ul>
    </template>
  </v-tooltip>
</template>

<script lang="ts" setup>
import { useSharedTooltipData } from '@/composables/sharedTooltip'
import { Anchor } from 'vuetify'

const { isShown, stack } = useSharedTooltipData()
const cur = computed(() => stack.value[stack.value.length - 1])

watch(cur, (v) => {
  if (v) {
    const newValue = {
      x: v.x,
      y: v.y,
      top: v.direction === 'top',
      left: v.direction === 'left',
      right: v.direction === 'right',
      bottom: v.direction === 'bottom',
      color: v.color,
      text: v.text,
      items: v.items,
      list: v.list,
    }
    cached.value = newValue
  }
})

const location = computed(() => {
  const result = [] as string[]
  if (cached.value.top) result.push('top')
  else if (cached.value.bottom) result.push('bottom')
  if (cached.value.left) result.push('left')
  else if (cached.value.right) result.push('right')
  return result.join(' ') as Anchor
})

const cached = shallowRef({
  x: 0,
  y: 0,
  top: true,
  left: false,
  right: false,
  bottom: false,
  color: '',
  text: '',
  items: [] as ({ icon: string; text: string }[]) | undefined,
  list: [] as string[] | undefined,
})

</script>
