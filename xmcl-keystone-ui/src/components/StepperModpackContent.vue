<template>
  <div class="flex h-full flex-col overflow-auto">
    <v-skeleton-loader
      v-if="isValidating"
      type="list-item-avatar-two-line,list-item-avatar-two-line,list-item-avatar-two-line,list-item-avatar-two-line,list-item-avatar-two-line"
    />
    <ErrorView
      v-else-if="error"
      :error="error"
    />
    <InstanceManifestFileTree
      v-else
      :value="[]"
    />
  </div>
</template>
<script lang="ts" setup>
import { InstanceFileNode, provideFileNodes } from '@/composables/instanceFileNodeData'
import { basename } from '@/util/basename'
import useSWRV from 'swrv'
import { Template } from '../composables/instanceTemplates'
import InstanceManifestFileTree from './InstanceManifestFileTree.vue'
import ErrorView from './ErrorView.vue'

const props = defineProps<{
  modpack: Template
  shown: boolean
}>()

const { data, isValidating, error } = useSWRV(computed(() => props.modpack && `/modpack/preview/${props.modpack.filePath ?? ''}`), async () => {
  const files = await props.modpack.loadFiles()
  return files.map((f) => {
    // const avatar = mods.value?.find(v => v.id === f.curseforge?.projectId)?.logo.thumbnailUrl
    return {
      path: f.path,
      name: basename(f.path),
      size: f.size ?? 0,
      // avatar,
    } as InstanceFileNode<any>
  })
})

provideFileNodes(computed(() => data.value ?? []))

</script>

<style scoped>
.v-list {
  background: transparent;
}
</style>
