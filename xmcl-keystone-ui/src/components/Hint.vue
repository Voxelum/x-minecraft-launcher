<template>
  <div
    class="h-full w-full overflow-hidden"
    :class="{ 'absoluted': absolute }"
    @click="$emit('click', $event)"
  >
    <div
      class="flex h-full items-center justify-center"
    >
      <div
        v-if="!button"
        class="headline text-button select-none text-center"
        :style="{ 'color': color, }"
      >
        <v-icon
          :style="{ 'font-size' : `${size}px`, 'color': color }"
          style="display: block"
        >
          {{ icon }}
        </v-icon>
        {{ text }}
      </div>
      <div
        v-else
        class="headline select-none text-center"
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
    </div>
  </div>
</template>

<script lang=ts setup>

defineProps({
  absolute: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String,
    default: '',
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
  secondary: {
    type: Boolean,
    default: false,
  },
})
</script>

<style scoped>
.absoluted {
  position: absolute;
  left: 0;
  top: 0;
}
</style>
