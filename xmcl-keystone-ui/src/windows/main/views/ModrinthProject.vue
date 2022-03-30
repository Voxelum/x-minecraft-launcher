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
        :title="project.title"
        :description="project.description"
        :icon="project.icon_url"
        :discord-url="project.discord_url"
        :issue-url="project.issues_url"
        :wiki_url="project.wiki_url"
        :source-url="project.source_url"
      />
      <v-card outlined>
        <v-tabs
          v-model="tab"
          class="rounded-lg flex-grow-0 flex-1"
        >
          <v-tab :key="0">
            {{ $t('modrinth.description') }}
          </v-tab>
          <v-tab :key="1">
            {{ $t('modrinth.versions') }}
          </v-tab>
        </v-tabs>
        <v-tabs-items v-model="tab">
          <v-tab-item :key="0">
            <Description :description="project.body" />
          </v-tab-item>
          <v-tab-item :key="1">
            <Versions
              :versions="project.versions"
              :project="project.id"
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
  </div>
</template>
<script lang="ts">
import { Ref } from '@vue/composition-api'
import { useService } from '/@/composables'
import { ModrinthServiceKey } from '@xmcl/runtime-api'
import { useRefreshable } from '/@/composables/refreshable'
import { required } from '/@/util/props'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import Tags from './ModrinthProjectTags.vue'
import Members from './ModrinthProjectMembers.vue'
import FeaturedVersions from './ModrinthProjectFeaturedVersions.vue'
import Header from './ModrinthProjectHeader.vue'
import Versions from './ModrinthProjectVersions.vue'
import Description from './ModrinthProjectDescription.vue'

export default defineComponent({
  components: { Tags, Members, FeaturedVersions, Header, Versions, Description },
  props: {
    id: required(String),
  },
  setup(props) {
    const tab = ref(0)
    const { getProject, installVersion } = useService(ModrinthServiceKey)
    const project: Ref<undefined | Project> = ref(undefined)
    const { refresh, refreshing } = useRefreshable(async () => {
      const result = await getProject(props.id)
      project.value = result
    })
    const onInstall = (project: ProjectVersion) => {
      installVersion({ version: project })
    }
    onMounted(() => {
      refresh()
    })
    return {
      tab,
      onInstall,
      project,
      refreshing,
    }
  },
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
