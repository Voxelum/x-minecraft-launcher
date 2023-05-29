<template>
  <div class="flex flex-col h-full overflow-auto">
    <InstanceManifestFileTree :value="[]" />
  </div>
</template>
<script lang="ts" setup>
import { InstanceFileNode, provideFileNodes } from '@/composables/instanceFileNodeData'
import { basename } from '@/util/basename'
import { Template } from '../composables/instanceAdd'
import InstanceManifestFileTree from './InstanceManifestFileTree.vue'
import useSWRV from 'swrv'
import { clientCurseforgeV1 } from '@/util/clients'
import { InstanceFile } from '@xmcl/runtime-api'

const props = defineProps<{
  modpack?: Template
  shown: Boolean
}>()

const curseforgeFiles = computed(() => (props.modpack?.files ?? []).filter((v): v is (InstanceFile & { curseforge: { projectId: string } }) => !!v.curseforge))

const { data: mods } = useSWRV(computed(() => `/curseforge/files?${curseforgeFiles.value.map(f => f.curseforge.projectId)}`),
  () => clientCurseforgeV1.getMods(curseforgeFiles.value.map(f => f.curseforge.projectId)))

const nodes = useSWRV(computed(() => mods.value && `/modpack/preview/${props.modpack?.filePath ?? ''}`), async (v) => {
  if (!v) return
  if (!props.modpack) return
  return props.modpack.files.map((f) => {
    const avatar = mods.value?.find(v => v.id === f.curseforge?.projectId)?.logo.thumbnailUrl
    return {
      path: f.path,
      name: basename(f.path),
      size: f.size ?? 0,
      avatar,
    } as InstanceFileNode<any>
  })
})

provideFileNodes(computed(() => nodes.data.value ?? []))

</script>

<style scoped>
.v-list {
  background: transparent;
}
</style>
