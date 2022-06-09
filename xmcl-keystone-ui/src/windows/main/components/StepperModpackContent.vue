<template>
  <div class="flex flex-col h-full overflow-auto">
    <v-list
      v-if="!!curseforgeFiles"
      color="transparent"
      two-line
    >
      <StepperModpackContentFile
        v-for="file in curseforgeFiles"
        :key="file.fileID"
        :file-id="file.fileID"
        :project-id="file.projectID"
      />
    </v-list>
    <InstanceManifestFileTree
      v-else-if="ftbFiles.length > 0 || modrinthFiles.length > 0"
      :value="[]"
    />
  </div>
</template>
<script lang="ts" setup>
import { FTBFile } from '@xmcl/runtime-api'
import { Template } from '../composables/instanceAdd'
import { InstanceFileNode, provideFileNodes } from '../composables/instanceFiles'
import InstanceManifestFileTree from './InstanceManifestFileTree.vue'
import StepperModpackContentFile from './StepperModpackContentFile.vue'
import { basename } from '/@/util/basename'

const props = defineProps<{
  modpack?: Template
  shown: Boolean
}>()

const curseforgeFiles = computed(() => props.modpack?.source.type === 'curseforge' ? props.modpack.source.resource.metadata.files : undefined)

const ftbFiles = computed(() => props.modpack?.source.type === 'ftb' ? props.modpack.source.manifest.files : [])

const modrinthFiles = computed(() => props.modpack?.source.type === 'modrinth' ? props.modpack.source.resource.metadata.files : [])

provideFileNodes(computed(() => {
  function getFTBNode(file: FTBFile): InstanceFileNode {
    return {
      id: file.path.replace('./', '') + file.name,
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

  if (ftbFiles.value.length > 0) {
    return ftbFiles.value.map(getFTBNode)
  } else {
    return modrinthFiles.value.map(getNode)
  }
}))

</script>

<style scoped>
.v-list {
  background: transparent;
}
</style>
