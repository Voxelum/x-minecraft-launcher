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
    class="flex h-full overflow-auto"
  >
    <v-layout
      row
      wrap
    >
      <v-flex
        v-for="(img, index) in attachments"
        :key="index"
        d-flex
      >
        <v-card
          hover
          style="min-width: 100px"
          @click="$emit('image', img)"
        >
          <v-img :src="img.url" />
          <v-card-title>{{ img.title }}</v-card-title>
        </v-card>
      </v-flex>
    </v-layout>
  </div>
</template>
<script lang="ts">
import { AddonInfo } from '@xmcl/curseforge'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    attachments: required<AddonInfo['attachments']>(Array),
  },
})
</script>
