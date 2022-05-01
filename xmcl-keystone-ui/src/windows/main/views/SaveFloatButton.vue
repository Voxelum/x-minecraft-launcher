<template>
  <v-fab-transition>
    <v-btn
      v-if="visible"
      style="right: 40vw; bottom: 10px;"
      large
      absolute

      fab
      bottom
      :color="'error'"
      @dragover.prevent
      @drop="$emit('drop', $event)"
    >
      <v-icon>delete</v-icon>
    </v-btn>
  </v-fab-transition>
</template>

<script lang=ts>
export default defineComponent({
  props: {
    visible: Boolean,
  },
})
</script>
