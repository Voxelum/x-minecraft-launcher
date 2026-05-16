<template>
  <div
    class="avatar-item flex flex-grow-0 items-center rounded-lg px-2 py-1 text-sm transition-colors"
    :class="{ 'cursor-pointer hover:bg-white/8': hasClickHandler }"
    @click="onclick ? onclick($event) : emit('click', $event)"
  >
    <v-avatar
      class="mr-2 hidden lg:block"
      :size="32"
      color="transparent"
      :class="{ responsive }"
    >
      <v-img
        v-if="avatar"
        :src="avatar"
        :width="32"
        :height="32"
      />
      <v-icon v-else-if="icon" :size="20" class="text-medium-emphasis">
        {{ icon }}
      </v-icon>
    </v-avatar>

    <div
      v-if="text"
      class="avatar-item__text overflow-hidden overflow-ellipsis whitespace-nowrap"
    >
      <div
        class="select-none text-[0.7rem] font-medium uppercase tracking-wide text-medium-emphasis"
        :style="{
          color: bgColor
        }"
      >
        {{ title }}
      </div>
      <div class="text-high-emphasis leading-tight">
        {{ text }}
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useVuetifyColor } from '@/composables/vuetify'

export interface AvatarItemProps {
  color?: string
  avatar?: string
  icon?: string
  title?: string
  text?: string
  responsive?: boolean
  onclick?: (e: Event) => void
}
const props = defineProps<AvatarItemProps>()
const { getColorCode } = useVuetifyColor()
const bgColor = computed(() => props.color ? getColorCode(props.color) : undefined)
const emit = defineEmits(['click'])
const attrs = useAttrs()
const hasClickHandler = computed(() => !!attrs.onClick || !!props.onclick)
</script>
<style scoped>

.responsive {
  display: none !important;
}
.avatar-item__text {
  line-height: 1.3;
}
@media (min-width: 1000px) {
  .responsive {
    display: inline-flex !important;
  }
}
</style>
