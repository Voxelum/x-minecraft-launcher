<template>
  <v-container
    :class="{ 'absoluted': absolute }"
    @click="$emit('click', $event)"
  >
    <v-layout
      align-center
      justify-center
      row
      fill-height
    >
      <div
        v-if="!button"
        class="headline text-center select-none"
      >
        <v-icon
          :style="{ 'font-size' : `${size}px` }"
          style="display: block"
        >
          {{ icon }}
        </v-icon>
        {{ text }}
      </div>
      <div
        v-else
        class="headline text-center select-none"
      >
        <v-btn>
          <v-icon
            :style="{ 'font-size' : `${size}px` }"
            style="display: block"
          >
            {{ icon }}
          </v-icon>
          {{ text }}
        </v-btn>
      </div>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'

export default defineComponent({
  props: {
    absolute: {
      type: Boolean,
      default: false,
    },
    text: {
      type: String,
      default: '',
    },
    icon: {
      type: String,
      default: '',
    },
    size: {
      type: Number,
      default: 50,
    },
    button: {
      type: Boolean,
      default: false,
    },
  },
})
</script>

<style>
.absoluted {
  position: absolute;
  left: 0;
  top: 0;
}
</style>
