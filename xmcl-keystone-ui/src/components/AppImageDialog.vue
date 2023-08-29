<template>
  <v-dialog
    v-model="isShown"
    content-class="image-dialog"
  >
    <div
      class="relative"
    >
      <v-img
        max-height="90vh"
        contain
        :src="image"
      />
      <div class="absolute bottom-10 flex w-full flex-col items-center justify-center gap-2">
        {{ description }}
        <div v-if="date">
          {{ getLocalDateString(date) }}
        </div>
        <v-card class="hover:(scale-100 opacity-100) flex flex-grow-0 gap-2 rounded-xl px-2 py-1 opacity-60 transition">
          <v-btn
            icon
            small
            @click="isShown=false"
          >
            <v-icon>close</v-icon>
          </v-btn>
          <v-btn
            icon
            small
            @click="onOpen"
          >
            <v-icon>open_in_new</v-icon>
          </v-btn>
        </v-card>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { kImageDialog } from '@/composables/imageDialog'
import { getLocalDateString } from '@/util/date'
import { injection } from '@/util/inject'

const { isShown, image, description, date } = injection(kImageDialog)
const onOpen = () => {
  window.open(image.value, 'browser')
}
</script>
<style>
.image-dialog {
  box-shadow: none;
}
</style>
