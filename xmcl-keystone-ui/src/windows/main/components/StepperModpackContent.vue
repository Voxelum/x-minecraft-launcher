<template>
  <div class="flex flex-col h-full overflow-auto">
    <v-list two-line>
      <StepperModpackContentFile
      v-for="file in curseforgeMetadata.files"
      :key="file.fileID"
      :file-id="file.fileID"
      :project-id="file.projectID"
    />
    </v-list>
  </div>
</template>
<script lang="ts">
import { computed, defineComponent, watch } from '@vue/composition-api';
import { optional, required } from '/@/util/props';
import type { InstanceTemplate, ModpackTemplate } from './StepperTemplateContent.vue'
import { useService } from '/@/hooks';
import { CurseForgeServiceKey } from '@xmcl/runtime-api';
import { useRefreshable } from '/@/hooks/useRefreshable';
import { CurseforgeModpackManifest } from '@xmcl/runtime-api';
import StepperModpackContentFile from './StepperModpackContentFile.vue';

export default defineComponent({
  props: {
    modpack: optional<ModpackTemplate>(Object),
    shown: required(Boolean),
  },
  setup(props) {
    const { fetchProject } = useService(CurseForgeServiceKey);
    const curseforgeMetadata = computed(() => props.modpack?.source.metadata as CurseforgeModpackManifest);
    watch(() => props.shown, (isShown) => {
      if (isShown) {
      }
    });
    return {
      curseforgeMetadata
    };
  },
  components: { StepperModpackContentFile }
})
</script>
<style scoped>
.v-list {
  background: transparent;
}
</style>