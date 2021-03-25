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
      <v-flex
        v-if="!button"
        style="text-align:center; user-select: none;"
        class="headline"
      >
        <v-icon
          :style="{ 'font-size' : `${size}px` }"
          style="display: block"
        >
          {{ icon }}
        </v-icon>
        {{ text }}
      </v-flex>
      <v-flex
        v-else
        style="text-align:center; user-select: none;"
        class="headline"
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
      </v-flex>
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
