<template>
  <v-card class="rounded-b-xl">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div
      v-if="changelog"
      class="p-4 markdown"
      v-html="render(changelog)"
    />
    <ErrorView :error="error" />
  </v-card>
</template>

<script lang=ts setup>
import ErrorView from '@/components/ErrorView.vue'
import { useFeedTheBeastChangelog } from '@/composables/ftb'
import { useMarkdown } from '@/composables/markdown'
import { FTBVersion } from '@xmcl/runtime-api'

const { render } = useMarkdown()
const props = defineProps<{ id: number; version: FTBVersion }>()
const { changelog, refreshing, error } = useFeedTheBeastChangelog(computed(() => props))
</script>
