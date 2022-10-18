<template>
  <v-container
    v-if="false"
    fill-height
    style="min-height: 65vh"
  >
    <v-layout
      justify-center
      align-center
      fill-height
    >
      <v-progress-circular
        indeterminate
        :size="100"
      />
    </v-layout>
  </v-container>
  <div
    v-else
    class="grid lg:grid-cols-3 sm:grid-cols-2 gap-2 p-4"
  >
    <v-card
      v-for="(img, index) in screenshots"
      :key="index"
      hover
      style="min-width: 100px"
      @click="emit('image', img)"
    >
      <v-img :src="img.url" />
      <v-card-title>{{ img.title }}</v-card-title>
    </v-card>
  </div>
</template>
<script lang="ts" setup>
import { ModAsset } from '@xmcl/curseforge'

defineProps<{ screenshots: ModAsset[] }>()
const emit = defineEmits(['image'])
</script>
