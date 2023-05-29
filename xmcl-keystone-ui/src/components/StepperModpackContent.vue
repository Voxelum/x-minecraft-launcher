<template>
  <div class="flex flex-col h-full overflow-auto">
    <StepperModpackContentCurseforge
      v-if="curseforgeFiles.length > 0"
      :files="curseforgeFiles"
    />
    <InstanceManifestFileTree
      v-if="ftbFiles.length > 0 || modrinthFiles.length > 0 || mcbbsAddonFiles.length > 0"
      :value="[]"
    />
  </div>
</template>
<script lang="ts" setup>
import { FTBFile, ModpackFileInfoAddon, ModpackFileInfoCurseforge } from '@xmcl/runtime-api'
import { Template } from '../composables/instanceAdd'
import { InstanceFileNode, provideFileNodes } from '../composables/instanceFiles'
import InstanceManifestFileTree from './InstanceManifestFileTree.vue'
import StepperModpackContentCurseforge from './StepperModpackContentCurseforge.vue'
import { basename } from '@/util/basename'
import { getFTBPath } from '@/util/ftb'

const props = defineProps<{
  modpack?: Template
  shown: Boolean
}>()

const mcbbsFiles = computed(() => props.modpack?.source.type === 'mcbbs' ? props.modpack.source.resource.metadata['mcbbs-modpack'].files ?? [] : [])
const mcbbsAddonFiles = computed(() => mcbbsFiles.value.filter((f): f is ModpackFileInfoAddon => f.type === 'addon'))
const mcbbsCurseforgeFiles = computed(() => mcbbsFiles.value.filter((f): f is ModpackFileInfoCurseforge => f.type === 'curse'))

const curseforgeFiles = computed(() => props.modpack?.source.type === 'curseforge' ? props.modpack.source.resource.metadata['curseforge-modpack'].files : mcbbsCurseforgeFiles.value)

const ftbFiles = computed(() => props.modpack?.source.type === 'ftb' ? props.modpack.source.manifest.files : [])

const modrinthFiles = computed(() => props.modpack?.source.type === 'modrinth' ? props.modpack.source.resource.metadata['modrinth-modpack'].files : [])

provideFileNodes(computed(() => {
  function getFTBNode(file: FTBFile): InstanceFileNode {
    return {
      id: getFTBPath(file),
      name: file.name,
      size: file.size,
    }
  }
  function getNode(file: { path: string; fileSize?: number; downloads: string[] }): InstanceFileNode {
    return {
      id: file.path,
      name: basename(file.path),
      size: file.fileSize ?? 0,
    }
  }
  function getMcbbsNode(file: ModpackFileInfoAddon): InstanceFileNode {
    return {
      id: file.path,
      name: basename(file.path),
      size: 0,
    }
  }

  if (ftbFiles.value.length > 0) {
    return ftbFiles.value.map(getFTBNode)
  } else if (modrinthFiles.value.length > 0) {
    return modrinthFiles.value.map(getNode)
  } else {
    return mcbbsAddonFiles.value.map(getMcbbsNode)
  }
}))

</script>

<style scoped>
.v-list {
  background: transparent;
}
</style>
