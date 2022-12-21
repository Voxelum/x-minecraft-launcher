
<template>
  <v-dialog v-model="isShown">
    <v-img :src="image" />
    <v-btn
      outlined
      icon
      large
      class="absolute top-20 right-20 z-20 border-2 non-moveable z-10"
      @click="isShown = false"
    >
      <v-icon>close</v-icon>
    </v-btn>
  </v-dialog>
</template>

<script lang="ts" setup>
import { kImageDialog } from '@/composables/imageDialog'
import { injection } from '@/util/inject'

const { isShown, image } = injection(kImageDialog)
</script>
