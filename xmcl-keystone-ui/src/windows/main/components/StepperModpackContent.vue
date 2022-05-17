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
      v-else-if="ftbFiles.length > 0"
      :value="[]"
    />
  </div>
</template>
<script lang="ts" setup>
import { FTBFile } from '@xmcl/runtime-api'
import { Template } from '../composables/instanceAdd'
import { InstanceFileNode, provideFileNodes } from '../composables/instanceFiles'
import StepperModpackContentFile from './StepperModpackContentFile.vue'
import InstanceManifestFileTree from './InstanceManifestFileTree.vue'

const props = defineProps<{
  modpack?: Template
  shown: Boolean
}>()

const curseforgeFiles = computed(() => props.modpack?.source.type === 'curseforge' ? props.modpack.source.resource.metadata.files : undefined)

const ftbFiles = computed(() => props.modpack?.source.type === 'ftb' ? props.modpack.source.manifest.files : [])

provideFileNodes(computed(() => {
  function getNode(file: FTBFile): InstanceFileNode {
    return {
      id: file.path.replace('./', '') + file.name,
      name: file.name,
      size: file.size,
      choices: [],
      choice: [],
    }
  }
  return ftbFiles.value.map(getNode)
}))

</script>

<style scoped>
.v-list {
  background: transparent;
}
</style>
