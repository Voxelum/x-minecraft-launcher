<template>
  <v-card>
    <v-card-title>
      <v-icon left>
        $vuetify.icons.modrinth
      </v-icon>
      Modrinth
      {{ t('modpack.name', 1) }}
      <v-spacer />
      <v-btn
        icon
        @click="goToPage"
      >
        <v-icon>
          open_in_new
        </v-icon>
      </v-btn>
    </v-card-title>
    <v-card-text v-if="project">
      This instance is created by Modrinth modpack from <code class="rounded bg-[rgba(123,123,123,0.2)] p-1">{{ project.title }}</code> (project id:
      <code class="rounded bg-[rgba(123,123,123,0.2)] p-1">{{ project.id }}</code>)
      <div>
        Last Update At:
        {{ getLocalDateString(project.updated) }}
      </div>
    </v-card-text>
    <v-card-text v-else>
      <v-skeleton-loader
        type="paragraph"
      />
    </v-card-text>
    <v-card-actions>
      <v-btn
        text
        :loading="refreshing"
        @click="checkUpdate()"
      >
        {{ t('checkUpdate') }}
      </v-btn>
      <v-spacer />
      <v-btn
        v-if="latestVersion"
        :disabled="refreshing"
        :loading="refreshing || downloadingModpack"
        color="teal accent-4"
        text
        @click="update()"
      >
        <template v-if="hasUpdate && currentVersion && !pendingModpack">
          {{ t('download') }} ({{ currentVersion.version_number }} -> {{ latestVersion.version_number }})
        </template>
        <template v-else-if="hasUpdate && currentVersion && pendingModpack">
          {{ t('install') }} ({{ currentVersion.version_number }} -> {{ latestVersion.version_number }})
        </template>
        <template v-else>
          {{ t('launcherUpdate.noUpdateAvailable' ) }}
        </template>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script lang="ts" setup>
import { Project, ProjectVersion } from '@xmcl/modrinth'
import { InstanceData, ModpackServiceKey, ModrinthServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useService, useServiceBusy } from '@/composables'
import { getLocalDateString } from '@/util/date'

const props = defineProps<{
  path: string
  upstream: InstanceData['upstream'] & { type: 'modrinth-modpack' }
}>()

const { state } = useService(ResourceServiceKey)
const currentModpack = computed(() => state.modpacks.find(v => v.metadata.modrinth &&
  v.metadata.modrinth.projectId === props.upstream.projectId &&
  v.metadata.modrinth.versionId === props.upstream.versionId))

const { getLatestProjectVersion, getProject, getProjectVersion, installVersion } = useService(ModrinthServiceKey)
const { getInstallModpackProfile } = useService(ModpackServiceKey)

const project = ref(undefined as undefined | Project)
const currentVersion = ref(undefined as undefined | ProjectVersion)
const latestVersion = ref(undefined as undefined | ProjectVersion)

const hasUpdate = computed(() => latestVersion.value && latestVersion.value.id !== props.upstream.versionId)
const pendingModpack = computed(() => !latestVersion.value ? undefined : state.modpacks.find(m => m.metadata.modrinth?.projectId === latestVersion.value?.project_id && m.metadata.modrinth?.versionId === latestVersion.value?.id))

const refreshingLatestProjectVersion = useServiceBusy(ModrinthServiceKey, 'getLatestProjectVersion', computed(() => currentModpack.value?.hash ?? ''))
const refreshingProject = useServiceBusy(ModrinthServiceKey, 'getProject')
const refreshing = computed(() => refreshingLatestProjectVersion.value || refreshingProject.value)

async function checkUpdate() {
  if (currentModpack.value?.hash) {
    latestVersion.value = await getLatestProjectVersion(currentModpack.value?.hash)
  }
}

const downloadingModpack = useServiceBusy(ModrinthServiceKey, 'installVersion', computed(() => latestVersion.value?.id ?? ''))
const { push } = useRouter()
function goToPage() {
  push(`/modrinth/${props.upstream.projectId}`)
}

async function refreshProject() {
  project.value = await getProject(props.upstream.projectId)
  currentVersion.value = await getProjectVersion(props.upstream.versionId)
}

const { show } = useDialog('instance-install')

async function update() {
  if (latestVersion.value) {
    if (!pendingModpack.value) {
      await installVersion({ version: latestVersion.value, project: project.value })
    } else {
      show(pendingModpack.value.path)
    }
  }
}

onMounted(() => {
  refreshProject()
  checkUpdate()
})

const { t } = useI18n()
</script>
