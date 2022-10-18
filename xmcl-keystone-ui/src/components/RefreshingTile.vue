<template>
  <v-container>
    <v-layout
      align-center
      justify-center
      row
      fill-height
    >
      <v-flex
        shrink
        style="text-align:center; user-select: none;"
      >
        <v-progress-circular
          :size="100"
          indeterminate
        />
      </v-flex>
    </v-layout>
  </v-container>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({ setup() { return {} } })
</script>
