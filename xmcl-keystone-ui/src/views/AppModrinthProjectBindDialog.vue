<template>
  <v-dialog v-model="isShown" max-width="560" persistent>
    <v-card data-testid="modrinth-project-bind-dialog">
      <v-card-title class="flex items-center gap-3 px-6 pt-5">
        <v-icon color="green">link</v-icon>
        {{ t('modpack.bindProject') }}
      </v-card-title>
      <v-card-text class="flex flex-col gap-4 px-6 py-5">
        <v-alert type="info" variant="tonal" density="compact">{{ t('modpack.bindProjectHint') }}</v-alert>
        <v-alert v-if="hasNonModpackProjects" type="warning" variant="tonal" density="compact">{{ t('modpack.bindProjectTypeImmutableHint') }}</v-alert>
        <v-autocomplete
          v-model="projectId"
          data-testid="modrinth-project-bind-select"
          :items="allProjects"
          item-title="title"
          item-value="id"
          :label="t('modpack.publishProject')"
          :loading="loading"
          variant="outlined"
          hide-details
        >
          <template #item="{ props: itemProps, item }">
            <v-list-item
              v-bind="itemProps"
              :disabled="!isBindable(item)"
              :subtitle="`${item.slug} · ${item.project_type} · ${item.status}`"
            >
              <template #prepend><v-avatar rounded="sm" size="36"><v-img v-if="item.icon_url" :src="item.icon_url" /><v-icon v-else>folder_zip</v-icon></v-avatar></template>
              <template v-if="!isBindable(item)" #append><v-chip size="x-small" variant="tonal">{{ item.project_type }}</v-chip></template>
            </v-list-item>
          </template>
          <template #no-data>
            <div class="px-4 py-3 text-body-2 opacity-70" data-testid="modrinth-project-bind-empty">{{ t('modpack.bindProjectNoProjects') }}</div>
          </template>
        </v-autocomplete>
        <v-alert v-if="error" type="error" variant="tonal" density="compact">{{ error }}</v-alert>
      </v-card-text>
      <v-divider />
      <v-card-actions class="px-6 py-4">
        <v-spacer />
        <v-btn data-testid="modrinth-project-bind-cancel" variant="text" :disabled="binding" @click="hide">{{ t('shared.cancel') }}</v-btn>
        <v-btn data-testid="modrinth-project-bind-confirm" color="primary" variant="flat" prepend-icon="link" :disabled="!selectedProject" :loading="binding" @click="bind">{{ t('modpack.bindProject') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { ModrinthProjectBindDialogKey, notifyModrinthProjectBound } from '@/composables/modrinthProjectBinding'
import { clientModrinthV2 } from '@/util/clients'
import type { Project } from '@xmcl/modrinth'
import { ModpackServiceKey } from '@xmcl/runtime-api'
import { getErrorMessage } from '@/util/error'

const { t } = useI18n()
const { isShown, parameter, hide } = useDialog(ModrinthProjectBindDialogKey)
const { bindModrinthProject } = useService(ModpackServiceKey)
const allProjects = shallowRef<Project[]>([])
const projectId = ref('')
const loading = ref(false)
const binding = ref(false)
const error = ref('')
// Modrinth only finalizes a project's `project_type` once its first version is
// uploaded (the type is inferred from that version's loaders). Until then, a
// fresh draft reports the generic type `project`, which is still bindable —
// publishing the first version through XMCL will establish it as a modpack.
// A project that already has an established, different type (mod,
// resourcepack, shader, plugin, datapack) can never become a modpack because
// Modrinth does not allow changing `project_type` after creation.
function isBindable(project: Project) {
  return project.project_type === 'modpack' || project.project_type === 'project'
}
const hasNonModpackProjects = computed(() => allProjects.value.some((project) => !isBindable(project)))
const selectedProject = computed(() => allProjects.value.find((project) => project.id === projectId.value && isBindable(project)))

watch(isShown, async (shown) => {
  if (!shown) return
  projectId.value = ''
  error.value = ''
  await loadProjects()
})

async function loadProjects() {
  loading.value = true
  try {
    const user = await clientModrinthV2.getAuthenticatedUser()
    allProjects.value = await clientModrinthV2.getUserProjects(user.id)
  } catch (caught) {
    error.value = getErrorMessage(caught)
  } finally {
    loading.value = false
  }
}

async function bind() {
  if (!parameter.value || !selectedProject.value) return
  binding.value = true
  error.value = ''
  try {
    const project = await bindModrinthProject(parameter.value.instancePath, projectId.value)
    notifyModrinthProjectBound(project)
    hide()
  } catch (caught) {
    error.value = getErrorMessage(caught)
  } finally {
    binding.value = false
  }
}
</script>