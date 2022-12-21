<template>
  <div
    class="h-full overflow-auto lg:p-4 p-2 lg:px-8 px-4 w-full"
  >
    <div class="flex lg:flex-row md:flex-col flex-grow lg:gap-5 gap-2 h-full max-h-full overflow-auto">
      <div
        class="flex lg:flex-col lg:flex lg:gap-5 gap-2 flex-shrink"
      >
        <CurseforgeProjectHeader
          :destination="destination"
          :from="destination"
          :project="project"
          :loading="refreshing && !project"
          @destination="destination = $event"
        />
        <CurseforgeProjectRecentFiles
          :files="project ? project.latestFiles : undefined"
          :from="destination"
          :type="type"
        />
      </div>

      <v-card
        outlined
        class="flex flex-col w-full h-full overflow-auto flex-grow relative"
      >
        <v-tabs
          v-model="tab"
          slider-color="yellow"
          class="flex-grow-0"
        >
          <v-tab :key="0">
            {{ t("curseforge.project.description") }}
          </v-tab>
          <v-tab :key="1">
            {{ t("curseforge.project.files") }}
          </v-tab>
          <v-tab
            v-if="project && project.screenshots.length > 0"
            :key="2"
          >
            {{ t("curseforge.project.images") }}
          </v-tab>
        </v-tabs>
        <v-tabs-items
          v-model="tab"
          class="h-full"
        >
          <v-tab-item
            :key="0"
            class="h-full max-h-full overflow-auto"
          >
            <CurseforgeProjectDescription
              :project="projectId"
            />
          </v-tab-item>
          <v-tab-item
            :key="1"
            class="h-full max-h-full overflow-auto"
          >
            <CurseforgeProjectFiles
              class="overflow-auto"
              :project="projectId"
              :type="type"
              :from="destination"
            />
          </v-tab-item>
          <v-tab-item
            v-if="project && project.screenshots.length > 0"
            :key="2"
            class="h-full max-h-full overflow-auto"
          >
            <CurseforgeProjectImages
              v-if="project"
              :screenshots="project.screenshots"
              @image="imageDialog.show"
            />
          </v-tab-item>
        </v-tabs-items>
      </v-card>
    </div>
    <ImageDialog />
  </div>
</template>

<script lang=ts setup>
import ImageDialog from '@/components/ImageDialog.vue'
import { useService } from '@/composables'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'
import { InstanceServiceKey, ProjectType } from '@xmcl/runtime-api'
import { useCurseforgeProject } from '../composables/curseforge'
import CurseforgeProjectDescription from './CurseforgeProjectDescription.vue'
import CurseforgeProjectFiles from './CurseforgeProjectFiles.vue'
import CurseforgeProjectHeader from './CurseforgeProjectHeader.vue'
import CurseforgeProjectImages from './CurseforgeProjectImages.vue'
import CurseforgeProjectRecentFiles from './CurseforgeProjectRecentFiles.vue'

const props = withDefaults(defineProps<{
  type: ProjectType
  id: string
  from: string
}>(), {
  type: 'mc-mods',
  id: '',
  from: '',
})

const projectId = computed(() => Number.parseInt(props.id, 10))
const { project, refreshing, error } = useCurseforgeProject(projectId.value)
const { state: instanceState } = useService(InstanceServiceKey)
const destination = ref(props.from || instanceState.path)
const { t } = useI18n()
const tab = ref(0)
const imageDialog = useImageDialog()
provide(kImageDialog, imageDialog)

</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}

.headline {
  text-align: center;
}
</style>
