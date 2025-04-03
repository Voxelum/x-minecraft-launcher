<template>
  <v-tooltip
    v-model="isShown"
    :color="cached?.color"
    transition="scroll-y-reverse-transition"
    :position-x="cached.x"
    :position-y="cached.y"
    class="z-1000"
    :top="cached.top"
    :left="cached.left"
    :right="cached.right"
    :bottom="cached.bottom"
  >
    {{ cached.text }}
    <div v-if="cached.items">
      <template v-for="r of cached.items">
        <v-avatar
          :key="r.icon + 'icon'"
          size="28"
        >
          <img :src="r.icon">
        </v-avatar>
        {{ r.text }}
      </template>
    </div>
    <template v-if="cached.list">
      <ul>
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
