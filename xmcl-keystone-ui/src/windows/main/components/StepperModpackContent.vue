<template>
  <div class="flex flex-col h-full overflow-auto">
    <v-list
      v-if="!!curseforgeMetadata"
      two-line
    >
      <StepperModpackContentFile
        v-for="file in files"
        :key="file.fileID"
        :file-id="file.fileID"
        :project-id="file.projectID"
      />
    </v-list>
  </div>
</template>
<script lang="ts">
import { computed, defineComponent } from '@vue/composition-api'
import { optional, required } from '/@/util/props'
import type { ModpackTemplate } from './StepperTemplateContent.vue'
import { ModpackFileInfoCurseforge } from '@xmcl/runtime-api'
import StepperModpackContentFile from './StepperModpackContentFile.vue'

export default defineComponent({
  components: { StepperModpackContentFile },
  props: {
    modpack: optional<ModpackTemplate>(Object),
    shown: required(Boolean),
  },
  setup(props) {
    const curseforgeMetadata = computed(() => props.modpack?.source.metadata)
    const files = computed(() =>
      !curseforgeMetadata.value
        ? []
        : 'files' in curseforgeMetadata.value ? curseforgeMetadata.value.files?.map(v => v).filter((v) : v is ModpackFileInfoCurseforge => 'fileID' in v) ?? [] : [],
    )
    return {
      curseforgeMetadata,
      files,
    }
  },
})
</script>
<style scoped>
.v-list {
  background: transparent;
}
</style>
