<template>
  <div
    v-if="!project"
    class="flex w-full flex-col gap-4 overflow-auto p-4 lg:flex-row"
  >
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
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
    class="flex flex-col gap-4 p-4 lg:flex-row"
  >
    <v-progress-linear
      class="absolute left-0 top-0 z-10 m-0 p-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <div class="flex flex-shrink flex-grow-0 flex-col gap-4 lg:max-w-[40%]">
      <v-icon
        v-if="_upstream"
        class="z-19 lg:scale-400 scale-200 absolute rotate-45 transform"
      >
        attach_file
      </v-icon>
      <v-card
        outlined
        class="p-4"
      >
        <ModrinthProjectHeader
          class="flex-grow-0 flex-wrap"
          :project="project"
          :install-to="installTo"
          @destination="installTo = $event"
        />
        <v-divider class="my-4 w-full" />
        <ModrinthProjectBasicInfo :project="project" />
      </v-card>
      <v-card
        outlined
        class="hidden flex-col p-4 lg:flex"
      >
        <ModrinthProjectExternal
          :project="project"
          :install-to="installTo"
        />
        <v-divider class="my-2 w-full" />
        <ModrinthProjectFeaturedVersions
          :project="project"
          :install-to="installTo"
        />
        <v-divider class="my-2 w-full" />
        <ModrinthProjectMembers
          :project-id="project.id"
        />
        <v-divider class="my-2 w-full" />
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

    <div
      class="relative flex flex-grow flex-col gap-4 overflow-auto"
    >
      <ModrinthProjectUpstream
        v-if="_upstream && _upstream.upstream && (_upstream.upstream.type === 'modrinth-modpack')"
        :upstream="_upstream.upstream"
        :project="project.id"
      />
      <v-card
        outlined
      >
        <v-tabs
          v-model="tab"
          class="flex-1 flex-grow-0 rounded-lg"
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
          v-model="tab"
        >
          <v-tab-item
            :key="0"
          >
            <ModrinthProjectDescription :description="project.body" />
          </v-tab-item>
          <v-tab-item
            v-if="project.gallery.length !== 0"
            :key="1"
          >
            <ModrinthProjectGallery
              :gallery="project.gallery"
              @view="imageDialog.show"
            />
          </v-tab-item>
          <v-tab-item
            :key="2"
          >
            <ModrinthProjectVersions
              :versions="project.versions"
              :mod-loaders="project.loaders"
              :project="project.id"
              :modpack="project.project_type === 'modpack'"
            />
          </v-tab-item>
        </v-tabs-items>
      </v-card>
    </div>
  </div>
</template>
<script lang="ts"  setup>
import ErrorView from '@/components/ErrorView.vue'
import { useService } from '@/composables'
import { kImageDialog } from '@/composables/imageDialog'
import { kUpstream } from '@/composables/instanceUpdate'
import { kModrinthInstall, useModrinthInstall } from '@/composables/modrinthInstall'
import { useModrinthInstanceResource } from '@/composables/modrinthInstanceResource'
import { useModrinthProject } from '@/composables/modrinthProject'
import { kModrinthVersionsHolder, kModrinthVersionsStatus, useModrintTasks, useModrinthVersionsResources } from '@/composables/modrinthVersions'
import { usePresence } from '@/composables/presence'
import { injection } from '@/util/inject'
import { ProjectVersion } from '@xmcl/modrinth'
import { InstanceServiceKey } from '@xmcl/runtime-api'
import ModrinthProjectBasicInfo from './ModrinthProjectBasicInfo.vue'
import ModrinthProjectDescription from './ModrinthProjectDescription.vue'
import ModrinthProjectExternal from './ModrinthProjectExternal.vue'
import ModrinthProjectFeaturedVersions from './ModrinthProjectFeaturedVersions.vue'
import ModrinthProjectGallery from './ModrinthProjectGallery.vue'
import ModrinthProjectHeader from './ModrinthProjectHeader.vue'
import ModrinthProjectMembers from './ModrinthProjectMembers.vue'
import ModrinthProjectTags from './ModrinthProjectTags.vue'
import ModrinthProjectUpstream from './ModrinthProjectUpstream.vue'
import ModrinthProjectVersions from './ModrinthProjectVersions.vue'
import { kInstance } from '@/composables/instance'

const props = defineProps<{ id: string }>()

// Image dialog
const imageDialog = injection(kImageDialog)

const tab = ref(0)

const { t } = useI18n()
const projectId = computed(() => props.id)

const { project, refreshing, refreshError, refresh } = useModrinthProject(projectId)

// modrinth project
const { path } = inject(kInstance, ({ path: '' }) as any)
const installTo = ref(project.value?.project_type === 'mod' ? path.value : '')

// modrinth version status
const holder = ref({} as Record<string, ProjectVersion>)
provide(kModrinthVersionsHolder, holder)
const versions = computed(() => Object.values(holder.value))
const status = useModrinthVersionsResources(versions)
const tasks = useModrintTasks(projectId)
provide(kModrinthVersionsStatus, { ...status, tasks })

const _upstream = inject(kUpstream)

if (_upstream && _upstream.value.upstream?.type === 'modrinth-modpack') {
  // In home page
  // Current instance resource
  const { resource: currentVersionResource } = useModrinthInstanceResource(projectId, computed(() => (_upstream.value.upstream?.type === 'modrinth-modpack' ? _upstream.value.upstream.sha1 : undefined) || ''))
  provide(kModrinthInstall, useModrinthInstall(project, tasks, installTo, status.getResource, currentVersionResource))
} else {
  provide(kModrinthInstall, useModrinthInstall(project, tasks, installTo, status.getResource, computed(() => undefined)))
}

if (!_upstream) {
  usePresence(computed(() => t('presence.modrinthProject', { name: project.value?.title || '' })))
}
</script>
