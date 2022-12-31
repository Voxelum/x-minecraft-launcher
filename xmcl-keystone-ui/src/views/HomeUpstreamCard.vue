<template>
  <HomeUpstreamCardModrinth
    v-if="upstream.type === 'modrinth-modpack'"
    :upstream="upstream"
    :instance="instance"
  />
  <HomeUpstreamCardCurseforge
    v-else-if="upstream.type === 'curseforge-modpack'"
    :upstream="upstream"
    :instance="instance"
  />
</template>
<script lang="ts" setup>
import { InstanceData } from '@xmcl/runtime-api'
import HomeUpstreamCardCurseforge from './HomeUpstreamCardCurseforge.vue'
import HomeUpstreamCardModrinth from './HomeUpstreamCardModrinth.vue'

defineProps<{
  instance: InstanceData
  upstream: Required<InstanceData>['upstream']
}>()
</script>
