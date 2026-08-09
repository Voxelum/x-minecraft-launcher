<template>
  <v-dialog v-model="isShown" max-width="560" persistent>
    <v-card data-testid="modrinth-project-create-dialog">
      <v-card-title class="flex items-center gap-3 px-6 pt-5">
        <v-icon color="green">xmcl:modrinth</v-icon>
        {{ t('modpack.publishNewProject') }}
      </v-card-title>
      <v-card-text class="project-form">
        <v-text-field v-model="form.title" data-testid="modrinth-project-create-name" :label="t('modpack.publishProjectName')" variant="outlined" density="compact" hide-details />
        <v-text-field v-model="form.url" data-testid="modrinth-project-create-url" :label="t('modpack.publishProjectUrl')" :placeholder="inferredSlug" :hint="t('modpack.publishProjectUrlHint', { slug: inferredSlug })" prefix="modrinth.com/modpack/" persistent-hint variant="outlined" density="compact" />
        <v-select v-model="form.visibility" data-testid="modrinth-project-create-visibility" :items="visibilityOptions" :label="t('modpack.publishVisibility')" variant="outlined" density="compact" hide-details />
        <v-text-field v-model="form.summary" data-testid="modrinth-project-create-summary" :label="t('modpack.publishSummary')" :rules="summaryRules" variant="outlined" density="compact" />
        <v-alert v-if="error" type="error" variant="tonal" density="compact">{{ error }}</v-alert>
      </v-card-text>
      <v-divider />
      <v-card-actions class="px-6 py-4">
        <v-spacer />
        <v-btn data-testid="modrinth-project-create-cancel" variant="text" :disabled="creating" @click="hide">{{ t('shared.cancel') }}</v-btn>
        <v-btn
          data-testid="modrinth-project-create-confirm"
          color="primary"
          variant="flat"
          prepend-icon="add"
          :loading="creating"
          :disabled="!valid"
          @click="create"
        >
          {{ t('modpack.publishCreateProject') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { ModrinthProjectCreateDialogKey, notifyModrinthProjectBound } from '@/composables/modrinthProjectBinding'
import { ModpackServiceKey } from '@xmcl/runtime-api'
import { MODRINTH_DEFAULT_LICENSE_ID } from '@xmcl/modrinth'
import { getErrorMessage } from '@/util/error'

const { t } = useI18n()
const { isShown, parameter, hide } = useDialog(ModrinthProjectCreateDialogKey)
const { createAndBindModrinthProject } = useService(ModpackServiceKey)
const creating = ref(false)
const error = ref('')
const form = reactive({
  title: '',
  url: '',
  visibility: 'private' as 'public' | 'unlisted' | 'private',
  summary: '',
})
const inferredSlug = computed(() => slugify(form.title))
const projectSlug = computed(() => inferSlug(form.url) || inferredSlug.value)
const summaryWordCount = computed(() => form.summary.trim().length)
const valid = computed(() => !!form.title.trim() && projectSlug.value.length >= 3 && summaryWordCount.value >= 3)
const summaryRules = computed(() => [() => summaryWordCount.value >= 3 || t('modpack.publishSummaryMinWords')])
const visibilityOptions = computed(() => [
  { title: t('modpack.visibilityPublic'), value: 'public' },
  { title: t('modpack.visibilityUnlisted'), value: 'unlisted' },
  { title: t('modpack.visibilityPrivate'), value: 'private' },
])

watch(parameter, (value) => {
  if (!value) return
  form.title = value.name
  form.url = ''
  form.visibility = 'private'
  form.summary = value.summary
  error.value = ''
}, { immediate: true })

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function inferSlug(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    const segments = url.pathname.split('/').filter(Boolean)
    return slugify(segments.at(-1) || url.hostname.split('.')[0])
  } catch {
    return slugify(trimmed.replace(/^modrinth\.com\/(?:modpack\/)?/i, ''))
  }
}

async function create() {
  if (!parameter.value || !valid.value) return
  error.value = ''
  creating.value = true
  try {
    const project = await createAndBindModrinthProject({
      instancePath: parameter.value.instancePath,
      requestedStatus: form.visibility === 'public' ? 'approved' : form.visibility,
      project: {
        slug: projectSlug.value,
        title: form.title.trim(),
        description: form.summary.trim(),
        body: form.summary.trim(),
        client_side: 'required',
        server_side: parameter.value.hasServer ? 'required' : 'optional',
        project_type: 'modpack',
        initial_versions: [],
        categories: [],
        license_id: MODRINTH_DEFAULT_LICENSE_ID,
        status: 'draft',
      },
    })
    notifyModrinthProjectBound(project)
    hide()
  } catch (caught) {
    error.value = getErrorMessage(caught)
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.project-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 24px;
}

</style>