<template>
  <div
    v-if="!project"
    class="flex gap-4 overflow-auto p-4 lg:flex-row flex-col w-full"
  >
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <ErrorView
      class="h-full"
      :error="refreshError"
      @refresh="refresh"
    />
  </div>
  <div
    v-else
    class="flex gap-4 overflow-auto p-4 lg:flex-row flex-col"
  >
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div class="flex-grow-0 flex-shrink flex-1 gap-4 flex flex-col">
      <v-card
        outlined
        class="p-4"
      >
        <ModrinthProjectHeader
          class="flex-grow-0"
          :project="project"
          :install-to="installTo"
          @destination="installTo = $event"
          @install="onInstall"
        />
        <v-divider class="w-full my-4" />
        <ModrinthProjectBasicInfo :project="project" />
      </v-card>
      <v-card
        outlined
        class="p-4 flex-col overflow-auto hidden lg:flex"
      >
        <ModrinthProjectExternal
          :project="project"
          :install-to="installTo"
          @install="onInstall"
        />
        <v-divider class="w-full my-2" />
        <ModrinthProjectFeaturedVersions
          :project="project"
          :install-to="installTo"
          @install="onInstall"
        />
        <v-divider class="w-full my-2" />
        <ModrinthProjectMembers
          :project-id="project.id"
        />
        <v-divider class="w-full my-2" />
        <ModrinthProjectTags
          :downloads="project.downloads"
          :license="project.license"
          :server-side="project.server_side"
          :client-side="project.client_side"
          :project-id="id"
          :create-at="project.published"
          :update-at="project.updated"
        />
      </v-card>
    </div>

    <v-card
      outlined
      class="flex flex-col w-full h-full overflow-auto flex-grow relative"
    >
      <v-tabs
        v-model="rightTab"
        class="rounded-lg flex-grow-0 flex-1"
      >
        <v-tab :key="0">
          {{ t('modrinth.description') }}
        </v-tab>
        <v-tab
          v-if="project.gallery.length !== 0"
          :key="1"
        >
          {{ t('modrinth.gallery') }}
        </v-tab>
        <v-tab :key="2">
          {{ t('modrinth.versions') }}
        </v-tab>
      </v-tabs>
      <v-tabs-items
        v-model="rightTab"
        class="h-full"
      >
        <v-tab-item
          :key="0"
          class="h-full max-h-full overflow-auto"
        >
          <ModrinthProjectDescription :description="project.body" />
        </v-tab-item>
        <v-tab-item
          v-if="project.gallery.length !== 0"
          :key="1"
          class="h-full max-h-full overflow-auto"
        >
          <ModrinthProjectGallery
            :gallery="project.gallery"
            @view="imageDialog.show"
          />
        </v-tab-item>
        <v-tab-item
          :key="2"
          class="h-full max-h-full overflow-hidden"
        >
          <ModrinthProjectVersions
            :versions="project.versions"
            :project="project.id"
            :modpack="project.project_type === 'modpack'"
            @install="onInstall"
          />
        </v-tab-item>
      </v-tabs-items>
    </v-card>
    <ImageDialog />
  </div>
</template>
<script lang="ts"  setup>
import ErrorView from '@/components/ErrorView.vue'
import ImageDialog from '@/components/ImageDialog.vue'
import { useService } from '@/composables'
import { kImageDialog, useImageDialog } from '@/composables/imageDialog'
import { useModrinthInstall } from '@/composables/modrinthInstall'
import { kModrinthVersions, kModrinthVersionsStatus, useModrinthVersions, useModrinthVersionsStatus } from '@/composables/modrinthVersions'
import { useRefreshable } from '@/composables/refreshable'
import { Project } from '@xmcl/modrinth'
import { InstanceServiceKey, ModrinthServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import ModrinthProjectBasicInfo from './ModrinthProjectBasicInfo.vue'
import ModrinthProjectDescription from './ModrinthProjectDescription.vue'
import ModrinthProjectExternal from './ModrinthProjectExternal.vue'
import ModrinthProjectFeaturedVersions from './ModrinthProjectFeaturedVersions.vue'
import ModrinthProjectGallery from './ModrinthProjectGallery.vue'
import ModrinthProjectHeader from './ModrinthProjectHeader.vue'
import ModrinthProjectMembers from './ModrinthProjectMembers.vue'
import ModrinthProjectTags from './ModrinthProjectTags.vue'
import ModrinthProjectVersions from './ModrinthProjectVersions.vue'

const props = defineProps<{ id: string }>()

const imageDialog = useImageDialog()
provide(kImageDialog, imageDialog)

const rightTab = ref(0)
const leftTab = ref(0)

const { t } = useI18n()
const { state: instanceState } = useService(InstanceServiceKey)

const versions = useModrinthVersions(computed(() => props.id))
provide(kModrinthVersions, versions)
const status = useModrinthVersionsStatus(versions.versions)
provide(kModrinthVersionsStatus, status)

const { getProject } = useService(ModrinthServiceKey)
const project: Ref<undefined | Project> = ref(undefined)
const installTo = ref(project.value?.project_type === 'mod' ? instanceState.path : '')
const { refresh, refreshing, error: refreshError } = useRefreshable(async () => {
  const result = await getProject(props.id)
  project.value = result
  installTo.value = project.value?.project_type === 'mod' ? instanceState.path : ''
})

const { onInstall } = useModrinthInstall(project, installTo, status.getResource)

onMounted(refresh)
</script>
