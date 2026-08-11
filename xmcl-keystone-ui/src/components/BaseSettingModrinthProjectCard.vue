<template>
  <v-divider class="my-2" />
  <div data-testid="modrinth-project-card" class="modrinth-project-section">
    <div class="section-title text-body-2 font-weight-medium opacity-80">
      <v-icon start size="small" color="green">xmcl:modrinth</v-icon>{{ t('modpack.modrinthProject') }}
    </div>
    <div v-if="!effectiveProjectId" class="empty-project">
      <div class="empty-copy"><v-icon size="38" color="green">cloud_upload</v-icon><div><div class="text-subtitle-1 font-weight-medium">{{ t('modpack.projectNotBound') }}</div><div class="text-body-2 opacity-60">{{ t('modpack.projectNotBoundHint') }}</div></div></div>
      <div class="project-actions">
        <v-btn data-testid="modrinth-project-bind" variant="outlined" prepend-icon="link" :loading="bindLoading" :disabled="createLoading" @click="$emit('bind')">{{ t('modpack.bindProject') }}</v-btn>
        <v-btn data-testid="modrinth-project-create" color="primary" variant="flat" prepend-icon="add" :loading="createLoading" :disabled="bindLoading" @click="$emit('create')">{{ t('modpack.publishCreateProject') }}</v-btn>
      </div>
    </div>
    <div v-else-if="loading" class="pa-4"><v-skeleton-loader type="list-item-avatar-two-line, actions" /></div>
    <div v-else-if="project" class="bound-project">
      <div class="project-summary">
        <v-avatar size="58" rounded="sm" color="surface-variant"><v-img v-if="project.icon_url" :src="project.icon_url" cover /><v-icon v-else size="28">folder_zip</v-icon></v-avatar>
        <div class="min-w-0 flex-1"><div class="flex items-center gap-2"><span class="truncate text-subtitle-1 font-weight-medium">{{ project.title }}</span><v-chip size="x-small" :color="project.status === 'approved' ? 'success' : 'warning'" variant="tonal">{{ project.status }}</v-chip></div><div class="truncate text-body-2 opacity-70">{{ project.description }}</div><div class="project-version-meta mt-1 text-caption"><span class="opacity-50">{{ project.slug }} · {{ knownVersionCount }} {{ t('modpack.projectVersions') }}</span><v-chip v-if="localDraftVersionId" size="x-small" color="warning" variant="tonal" prepend-icon="draft" :href="localDraftUrl" target="browser">{{ t('modpack.projectLatestDraft') }} {{ localDraftVersionId }}</v-chip></div></div>
      </div>
      <v-alert v-if="error" type="error" variant="tonal" density="compact">{{ error }}</v-alert>
      <div class="project-actions">
        <v-btn data-testid="modrinth-project-unbind" variant="text" color="red" prepend-icon="link_off" :disabled="unbinding" @click="unbindDialog.show(true)">{{ t('modpack.unbindProject') }}</v-btn>
        <v-spacer />
        <v-btn data-testid="modrinth-project-edit" variant="outlined" prepend-icon="edit" @click="edit">{{ t('modpack.editProject') }}</v-btn>
        <v-btn data-testid="modrinth-version-publish" color="primary" variant="flat" prepend-icon="cloud_upload" @click="$emit('publish', project)">{{ t('modpack.publishVersion') }}</v-btn>
      </div>
    </div>
    <div v-else class="pa-4">
      <v-alert type="error" variant="tonal" density="compact">{{ error || t('modpack.projectLoadFailed') }}</v-alert>
      <div class="project-actions mt-4">
        <v-btn data-testid="modrinth-project-unbind" variant="text" color="red" prepend-icon="link_off" :disabled="unbinding" @click="unbindDialog.show(true)">{{ t('modpack.unbindProject') }}</v-btn>
      </div>
    </div>
  </div>

  <v-dialog v-model="unbindDialog.model.value" max-width="440">
    <v-card>
      <v-card-item>
        <template #prepend><v-avatar color="red" variant="tonal"><v-icon>warning</v-icon></v-avatar></template>
        <v-card-title class="text-base font-medium">{{ t('modpack.unbindProjectConfirmTitle') }}</v-card-title>
      </v-card-item>
      <v-card-text class="pt-0 text-sm opacity-80">{{ t('modpack.unbindProjectConfirmMessage') }}</v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-btn variant="text" @click="unbindDialog.cancel">{{ t('shared.cancel') }}</v-btn>
        <v-spacer />
        <v-btn color="red" variant="flat" :loading="unbinding" @click="unbindDialog.confirm">{{ t('modpack.unbindProject') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useSimpleDialog } from '@/composables/dialog'
import { getCachedModrinthProject, notifyModrinthProjectBound, useModrinthProjectBindingBus } from '@/composables/modrinthProjectBinding'
import { clientModrinthV2 } from '@/util/clients'
import type { Project } from '@xmcl/modrinth'

const props = defineProps<{ projectId: string; lastVersionId?: string; bindLoading?: boolean; createLoading?: boolean; unbinding?: boolean }>()
const emit = defineEmits<{ bind: []; create: []; publish: [project: Project]; unbind: [] }>()
const { t } = useI18n()
const router = useRouter()
const project = shallowRef<Project>()
const effectiveProjectId = computed(() => props.projectId || project.value?.id || '')
const localDraftVersionId = computed(() => props.lastVersionId && !project.value?.versions.includes(props.lastVersionId) ? props.lastVersionId : '')
const knownVersionCount = computed(() => (project.value?.versions.length || 0) + (localDraftVersionId.value ? 1 : 0))
const localDraftUrl = computed(() => localDraftVersionId.value ? `https://modrinth.com/project/${effectiveProjectId.value}/version/${localDraftVersionId.value}` : '')
const loading = ref(false)
const error = ref('')
let requestVersion = 0
const unbindDialog = useSimpleDialog<boolean>(() => emit('unbind'))

async function load(id: string) {
  const version = ++requestVersion
  if (!id) { project.value = undefined; return }
  const cached = getCachedModrinthProject(id)
  if (cached) project.value = cached
  loading.value = !cached; error.value = ''
  try { const value = await clientModrinthV2.getProject(id); if (version === requestVersion) { project.value = value; notifyModrinthProjectBound(value) } } catch (caught) { if (version === requestVersion && !cached) error.value = caught instanceof Error ? caught.message : String(caught) } finally { if (version === requestVersion) loading.value = false }
}
watch(() => props.projectId, load, { immediate: true })
const stop = useModrinthProjectBindingBus().on((value) => { requestVersion += 1; project.value = value; loading.value = false; error.value = '' })
onUnmounted(stop)
function edit() { router.push({ path: '/base-setting', query: { target: 'modrinth-project' } }) }
</script>

<style scoped>
.modrinth-project-section { display:flex; flex-direction:column; gap:12px; padding-top: 12px; }
.section-title { display:flex; align-items:center; }
.empty-project,.bound-project { display:flex; flex-direction:column; gap:16px; }
.empty-copy,.project-summary { display:flex; align-items:center; gap:14px; }
.project-version-meta { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.project-actions { display:flex; justify-content:flex-end; gap:8px; }
@media(max-width:620px){.empty-copy,.project-summary{align-items:flex-start}.project-actions{flex-direction:column}.project-actions :deep(.v-btn){width:100%}}
</style>