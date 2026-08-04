<template>
  <v-dialog v-model="isShown" max-width="680" scrollable persistent>
    <v-card data-testid="modrinth-version-publish-dialog">
      <v-card-title class="flex items-center gap-3 px-6 pt-5">
        <v-icon color="green">cloud_upload</v-icon>
        {{ t('modpack.publishVersion') }}
      </v-card-title>
      <v-card-text class="version-form">
        <v-alert v-if="parameter" type="info" variant="tonal" density="compact">
          {{ parameter.projectSlug }} · {{ parameter.files.length }} {{ t('modpack.publishFiles') }}
        </v-alert>
        <v-skeleton-loader v-if="linkagePreviewLoading" type="text" />
        <v-alert v-else-if="linkagePreview" type="info" variant="tonal" density="compact">
          <div>{{ t('modpack.publishLinkageSummary', { linked: linkagePreview.linked, total: linkagePreview.total }) }}</div>
          <div v-if="linkagePreview.embedded > 0" class="mt-1">{{ t('modpack.publishLinkageEmbeddedSummary', { count: linkagePreview.embedded }) }}</div>
          <v-expansion-panels v-if="linkagePreview.embedded > 0" class="mt-2" variant="accordion" density="compact">
            <v-expansion-panel :title="t('modpack.publishLinkageShowFiles')">
              <template #text>
                <div v-for="entry in linkagePreview.embeddedFiles" :key="entry.path" class="linkage-entry">
                  <span class="font-mono">{{ entry.path }}</span>
                  <span class="opacity-70">{{ t(`modpack.publishLinkageReason.${entry.reason}`) }}</span>
                </div>
              </template>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-alert>
        <v-btn-toggle v-model="bump" mandatory density="compact" variant="outlined" divided>
          <v-btn value="patch">Patch</v-btn><v-btn value="minor">Minor</v-btn><v-btn value="major">Major</v-btn><v-btn value="custom">{{ t('modpack.publishCustomVersion') }}</v-btn>
        </v-btn-toggle>
        <div class="version-grid">
          <v-text-field v-model="versionNumber" data-testid="modrinth-version-number" :label="t('modpack.modpackVersion')" variant="outlined" density="compact" hide-details />
          <v-select v-model="versionType" :items="releaseOptions" :label="t('modpack.publishChannel')" variant="outlined" density="compact" hide-details />
        </div>
        <v-text-field v-model="title" :label="t('modpack.publishVersionTitle')" variant="outlined" density="compact" hide-details />
        <v-select v-model="profile" :items="profileOptions" :label="t('modpack.publishProfile')" variant="outlined" density="compact" hide-details />
        <div class="flex items-center justify-between">
          <span class="text-body-2 opacity-70">{{ t('modpack.publishChangelog') }}</span>
          <v-btn data-testid="modrinth-version-changelog-generate" size="small" variant="text" prepend-icon="smart_toy" :loading="generatingChangelog" @click="generateChangelog">{{ t('modpack.publishChangelogGenerate') }}</v-btn>
        </div>
        <v-textarea v-model="changelog" data-testid="modrinth-version-changelog" variant="outlined" rows="6" hide-details />
        <v-alert v-if="changelogError" type="error" variant="tonal" density="compact">{{ changelogError }}</v-alert>
        <v-alert v-if="error" type="error" variant="tonal" density="compact">{{ error }}</v-alert>
        <v-alert v-if="result" type="success" variant="tonal" density="compact">
          {{ t(submitted ? 'modpack.publishSubmitted' : 'modpack.publishDraftCreated') }}
          <a target="browser" :href="versionUrl">{{ result.versionId }}</a>
        </v-alert>
      </v-card-text>
      <v-divider />
      <v-card-actions class="px-6 py-4">
        <v-btn v-if="result" variant="text" prepend-icon="open_in_new" :href="versionUrl" target="browser">{{ t('modpack.publishOpenVersion') }}</v-btn>
        <v-spacer />
        <v-btn data-testid="modrinth-version-publish-cancel" variant="text" :disabled="publishing || submitting" @click="hide">{{ t('shared.cancel') }}</v-btn>
        <v-btn v-if="result" data-testid="modrinth-version-submit" variant="outlined" prepend-icon="publish" :loading="submitting" :disabled="submitted" @click="submit">{{ t('modpack.publishSubmit') }}</v-btn>
        <v-btn v-else data-testid="modrinth-version-publish-confirm" color="primary" variant="flat" prepend-icon="cloud_upload" :loading="publishing" :disabled="!valid" @click="publish">{{ t('modpack.publishCreateDraft') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { useModpackChangelogAgent } from '@/composables/agent/modpackChangelogAgent'
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'
import { ModrinthVersionPublishDialogKey } from '@/composables/modrinthProjectBinding'
import { injection } from '@/util/inject'
import type { ModrinthLinkagePreview } from '@xmcl/runtime-api'
import { getErrorMessage } from '@/util/error'
import { ModpackServiceKey } from '@xmcl/runtime-api'
import { inc, valid as validSemver } from 'semver'

const { t } = useI18n()
const { isShown, parameter, hide } = useDialog(ModrinthVersionPublishDialogKey)
const { publishModrinth, submitModrinthVersion, previewModrinthLinkage, previewModrinthChangelogContext } = useService(ModpackServiceKey)
const { interact, userData } = injection(kModrinthAuthenticatedAPI)
const changelogAgent = useModpackChangelogAgent()
const bump = ref<'patch' | 'minor' | 'major' | 'custom'>('patch')
const versionNumber = ref('')
const title = ref('')
const changelog = ref('')
const versionType = ref<'release' | 'beta' | 'alpha'>('release')
const profile = ref<'universal' | 'client' | 'server' | 'split'>('client')
const publishing = ref(false)
const submitting = ref(false)
const submitted = ref(false)
const generatingChangelog = ref(false)
const error = ref('')
const changelogError = ref('')
const result = shallowRef<{ projectId: string; versionId: string }>()
const releaseOptions = ['release', 'beta', 'alpha']
const linkagePreview = shallowRef<ModrinthLinkagePreview>()
const linkagePreviewLoading = ref(false)
const profileOptions = computed(() => [
  { title: t('modpack.publishProfileUniversal'), value: 'universal' }, { title: t('modpack.publishProfileClient'), value: 'client' },
  { title: t('modpack.publishProfileServer'), value: 'server' }, { title: t('modpack.publishProfileSplit'), value: 'split' },
])
const valid = computed(() => !!validSemver(versionNumber.value) && !!title.value.trim() && !!changelog.value.trim() && !!parameter.value?.files.length)
const versionUrl = computed(() => result.value ? `https://modrinth.com/project/${result.value.projectId}/version/${result.value.versionId}` : '')

watch(parameter, (options) => {
  if (!options) return
  bump.value = 'patch'
  versionNumber.value = inc(options.currentVersion, 'patch') || options.currentVersion
  title.value = versionNumber.value
  changelog.value = ''
  versionType.value = options.versionType
  profile.value = options.profile
  result.value = undefined
  submitted.value = false
  error.value = ''
  linkagePreview.value = undefined
  loadLinkagePreview(options)
}, { immediate: true })

let linkagePreviewRequest = 0
async function loadLinkagePreview(options: NonNullable<typeof parameter.value>) {
  const requestId = ++linkagePreviewRequest
  linkagePreviewLoading.value = true
  try {
    const preview = await previewModrinthLinkage(options.instancePath, options.files, options.strictMode)
    if (requestId === linkagePreviewRequest) linkagePreview.value = preview
  } catch {
    // Best-effort preview; publishing itself will still surface real errors.
  } finally {
    if (requestId === linkagePreviewRequest) linkagePreviewLoading.value = false
  }
}

watch(bump, (value) => {
  if (!parameter.value || value === 'custom') return
  versionNumber.value = inc(parameter.value.currentVersion, value) || parameter.value.currentVersion
  title.value = versionNumber.value
})

function formatChangelogDiff(diff: Awaited<ReturnType<typeof previewModrinthChangelogContext>>): string {
  if (!diff.hasPreviousVersion) return 'No previous published version was found to diff against.'
  const lines: string[] = []
  if (diff.added.length) lines.push(`Added: ${diff.added.join(', ')}`)
  if (diff.removed.length) lines.push(`Removed: ${diff.removed.join(', ')}`)
  if (diff.updated.length) lines.push(`Updated: ${diff.updated.map((entry) => `${entry.from} -> ${entry.to}`).join(', ')}`)
  return lines.length ? lines.join('\n') : 'No mod/file changes detected since the last publish.'
}

async function generateChangelog() {
  const options = parameter.value
  if (!options) return
  generatingChangelog.value = true
  changelogError.value = ''
  try {
    const diff = await previewModrinthChangelogContext(options.instancePath, options.files)
    const context = [
      `Modpack: ${options.name}, Minecraft ${options.gameVersion}, loaders: ${options.loaders.join(', ') || '(none)'}.`,
      `Current version: ${options.currentVersion}. Release channel: ${versionType.value}.`,
      `Mod/file changes since the last published version:\n${formatChangelogDiff(diff)}`,
      changelog.value.trim() ? `Existing draft notes from the user (incorporate the useful parts, don't just repeat them verbatim):\n${changelog.value.trim()}` : '',
    ].filter(Boolean).join('\n\n')
    const proposal = await changelogAgent.generate(options.instancePath, context, 'Propose the version number and changelog for this modpack release by calling the tool.')
    changelog.value = proposal.changelog
    if (proposal.version && validSemver(proposal.version)) {
      bump.value = 'custom'
      versionNumber.value = proposal.version
      title.value = proposal.version
    }
  } catch (caught) {
    changelogError.value = getErrorMessage(caught)
  } finally {
    generatingChangelog.value = false
  }
}

async function publish() {
  const options = parameter.value
  if (!options || !valid.value) return
  publishing.value = true
  error.value = ''
  try {
    if (!userData.value) { await interact(); if (!userData.value) return }
    result.value = await publishModrinth({
      instancePath: options.instancePath, gameVersion: options.gameVersion, name: options.projectSlug || options.name,
      files: options.files, author: options.author, version: versionNumber.value,
      destinationDirectory: options.destinationDirectory, strictModeInModrinth: options.strictMode,
      profile: profile.value, project: { id: options.projectId },
      release: { name: title.value.trim(), version_number: versionNumber.value, changelog: changelog.value.trim(), game_versions: [options.gameVersion], loaders: options.loaders, version_type: versionType.value, status: 'draft' },
    })
    try { await options.onPublished?.() } catch (caught) { console.error(caught) }
  } catch (caught) { error.value = getErrorMessage(caught) } finally { publishing.value = false }
}

async function submit() {
  if (!result.value || !parameter.value) return
  submitting.value = true
  error.value = ''
  try {
    await submitModrinthVersion({ instancePath: parameter.value.instancePath, projectId: result.value.projectId, versionId: result.value.versionId })
    submitted.value = true
  } catch (caught) { error.value = getErrorMessage(caught) } finally { submitting.value = false }
}
</script>

<style scoped>
.version-form { display: flex; flex-direction: column; gap: 14px; padding: 20px 24px; }
.version-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.linkage-entry { display: flex; justify-content: space-between; gap: 12px; padding: 2px 0; font-size: 12px; }
@media (max-width: 640px) { .version-grid { grid-template-columns: minmax(0, 1fr); } }
</style>