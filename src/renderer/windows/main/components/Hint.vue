<template>
  <v-container fill-height :class="{ 'absoluted': absolute }">
    <v-layout align-center justify-center row fill-height>
      <v-flex style="text-align:center; user-select: none;" class="headline">
        <v-icon :style="{ 'font-size' : `${size}px` }" style="display: block">
          {{ icon }}
        </v-icon>
        {{ text }}
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
export default {
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
  },
};
</script>

<style scoped>
.absoluted {
  position: absolute;
  left: 0;
  top: 0;
}
</style>
