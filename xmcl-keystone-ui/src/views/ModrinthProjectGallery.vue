<template>
  <div class="grid grid-cols-2 gap-2 p-4">
    <v-card
      v-for="g of gallery"
      :key="g.url"
      hover
      @click="emit('view', g.url)"
    >
      <v-img
        :src="g.url"
        height="200px"
      />
      <v-card-title>
        {{ g.title }}
      </v-card-title>
      <v-card-subtitle>
        {{ g.description }}
        <div>
          {{ getLocalDateString(g.created) }}
        </div>
      </v-card-subtitle>
    </v-card>
  </div>
</template>
<script lang="ts" setup>
import { ProjectGallery } from '@xmcl/modrinth'
import { getLocalDateString } from '@/util/date'

defineProps<{
  gallery: ProjectGallery[]
}>()

const emit = defineEmits(['view'])

</script>
