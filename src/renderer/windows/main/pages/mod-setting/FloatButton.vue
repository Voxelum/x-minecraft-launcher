<template>
  <v-fab-transition>
    <v-btn
      v-if="visible"
      style="right: 40vw; bottom: 10px;"
      large
      absolute
      dark
      fab
      bottom
      :color="deleting ? 'red' : 'green'"
      :loading="loading"
      @dragover.prevent
      @drop="$emit('drop', $event)"
      @click="$emit('click', $event)"
    >
      <v-icon
        v-if="deleting"
        :key="1"
      >
        delete
      </v-icon>
      <v-icon
        v-else
        :key="2"
      >
        save
      </v-icon>
    </v-btn>
  </v-fab-transition>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'

export default defineComponent({
  props: {
    visible: Boolean,
    deleting: Boolean,
    loading: Boolean,
  },
})
</script>
