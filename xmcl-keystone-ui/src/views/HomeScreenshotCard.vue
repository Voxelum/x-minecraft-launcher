<template>
  <v-card
    class="flex flex-col h-full"
  >
    <v-card-title class="bg-dark-100">
      <v-icon left>
        image
      </v-icon>
      {{ t('screenshots.name') }}
    </v-card-title>
    <div class="flex-grow flex flex-row flex-wrap gap-2 items-center justify-center">
      <!-- <template v-if="refreshing">
        <v-skeleton-loader type="paragraph" />
      </template>
      <template v-else>
        <img
          v-for="i of urls"
          :key="i"
          class="rounded"
          :style="{ 'height': perHeight }"
          :src="i"
        >
      </template> -->
    </div>
    <v-card-actions>
      <v-btn
        color="teal accent-4"
        text
        @click="onOpen"
      >
        {{ t('screenshots.goto') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts" setup>
import { useRefreshable, useSemaphore, useService } from '@/composables'
import { BaseServiceKey, Instance, InstanceScreenshotServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{ instance: Instance; width: number; height: number }>()

const { getScreenshots } = useService(InstanceScreenshotServiceKey)
const { showItemInDirectory } = useService(BaseServiceKey)

const urls = ref([] as string[])
const { refresh, refreshing } = useRefreshable(async () => {
  urls.value = await getScreenshots()
})

const perHeight = computed(() => {
  const remain = props.height - 64 - 52
  return (remain / 2) + 'px'
})

onMounted(refresh)

watch(() => props.instance, () => {
  refresh()
})

const onOpen = () => {
  // showItemInDirectory()
}

const { t } = useI18n()
</script>
