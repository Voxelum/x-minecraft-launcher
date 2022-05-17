<template>
  <v-card class="rounded-b-xl">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div
      class="p-4 markdown"
      v-html="changelog"
    />
  </v-card>
</template>

<script lang=ts setup>
import { FeedTheBeastServiceKey, FTBVersion } from '@xmcl/runtime-api'
import { useRefreshable, useService } from '/@/composables'
import MarkdownIt from 'markdown-it'

const parser = new MarkdownIt()

const props = defineProps<{ id: number; version: FTBVersion }>()
const { getModpackVersionChangelog } = useService(FeedTheBeastServiceKey)
const changelog = ref('')
const { refresh, refreshing } = useRefreshable(async () => {
  const result = await getModpackVersionChangelog({ modpack: props.id, version: props.version })
  changelog.value = parser.render(result)
})

watch([() => props.version], () => {
  refresh()
})

onMounted(refresh)
</script>
