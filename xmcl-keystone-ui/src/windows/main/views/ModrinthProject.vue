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
  </div>
  <div
    v-else
    class="flex gap-4 overflow-auto p-4 xl:flex-row flex-col"
  >
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div class="flex flex-col gap-4 flex-grow xl:max-w-110vh max-w-full">
      <Header
        class="flex-grow-0"
        :project="project"
        @create="onCreate"
        @install="onInstall"
      />
      <v-card outlined>
        <v-tabs
          v-model="tab"
          class="rounded-lg flex-grow-0 flex-1"
        >
          <v-tab :key="0">
            {{ $t('modrinth.description') }}
          </v-tab>
          <v-tab
            v-if="project.gallery.length !== 0"
            :key="1"
          >
            {{ $t('modrinth.gallery') }}
          </v-tab>
          <v-tab :key="2">
            {{ $t('modrinth.versions') }}
          </v-tab>
        </v-tabs>
        <v-tabs-items v-model="tab">
          <v-tab-item :key="0">
            <Description :description="project.body" />
          </v-tab-item>
          <v-tab-item
            v-if="project.gallery.length !== 0"
            :key="1"
          >
            <ModrinthProjectGallery
              :gallery="project.gallery"
              @view="viewedImage = $event"
            />
          </v-tab-item>
          <v-tab-item :key="2">
            <Versions
              :versions="project.versions"
              :project="project.id"
              :modpack="project.project_type === 'modpack'"
              @create="onCreate"
              @install="onInstall"
            />
          </v-tab-item>
        </v-tabs-items>
      </v-card>
      <div class="min-h-[10px]" />
    </div>
    <div class="flex flex-col gap-4 flex-grow">
      <Tags
        :downloads="project.downloads"
        :license="project.license"
        :server-side="project.server_side"
        :client-side="project.client_side"
        :project-id="id"
        :create-at="project.published"
        :update-at="project.updated"
      />
      <Members />
      <FeaturedVersions />
    </div>
    <v-dialog v-model="viewingImage">
      <v-img :src="viewedImage" />
    </v-dialog>
  </div>
</template>
<script lang="ts"  setup>
import { Ref } from '@vue/composition-api'
import { useService } from '/@/composables'
import { ModrinthServiceKey, PersistedResource, ResourceServiceKey } from '@xmcl/runtime-api'
import { useRefreshable } from '/@/composables/refreshable'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import Tags from './ModrinthProjectTags.vue'
import Members from './ModrinthProjectMembers.vue'
import FeaturedVersions from './ModrinthProjectFeaturedVersions.vue'
import Header from './ModrinthProjectHeader.vue'
import Versions from './ModrinthProjectVersions.vue'
import Description from './ModrinthProjectDescription.vue'
import ModrinthProjectGallery from './ModrinthProjectGallery.vue'
import { AddInstanceDialogKey } from '../composables/instanceAdd'
import { useDialog } from '../composables/dialog'

const props = defineProps<{ id: string }>()

const tab = ref(0)
const viewedImage = ref('')
const viewingImage = ref(false)

watch(viewedImage, (v) => {
  if (v) viewingImage.value = true
})
watch(viewingImage, (v) => {
  if (!v) viewedImage.value = ''
})

const { show } = useDialog(AddInstanceDialogKey)
const { state: resourceState } = useService(ResourceServiceKey)

const { getProject, installVersion } = useService(ModrinthServiceKey)
const project: Ref<undefined | Project> = ref(undefined)
const { refresh, refreshing } = useRefreshable(async () => {
  const result = await getProject(props.id)
  project.value = result
})
const onInstall = (project: ProjectVersion) => {
  installVersion({ version: project })
}

const onCreate = (v: ProjectVersion) => {
  const fileUrl = v.files[0].url
  const find = (m: PersistedResource) => {
    if (m.uri.indexOf(fileUrl) !== -1) {
      return true
    }
    if ('modrinth' in m && typeof m.modrinth === 'object') {
      const s = m.modrinth
      if (s.url === fileUrl) return true
    }
    return false
  }
  const res = resourceState.modpacks.find(find)
  if (res) {
    show(res.path)
  }
}

onMounted(() => {
  refresh()
})
</script>
<style>
/* .v-tabs__bar {
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
  border-bottom-right-radius: unset;
  border-bottom-left-radius: unset;
} */
</style>
