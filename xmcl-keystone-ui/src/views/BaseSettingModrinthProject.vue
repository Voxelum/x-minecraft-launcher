<template>
  <div data-testid="modrinth-project-page" class="project-page">
    <v-skeleton-loader v-if="loading" type="article, article, actions" />
    <v-alert v-else-if="!projectId" type="warning" variant="tonal">{{ t('modpack.projectNotBound') }}</v-alert>
    <template v-else-if="project">
      <section class="project-overview surface-card-subsection">
        <div class="project-overview__identity">
          <v-avatar size="64" rounded="lg" color="surface-variant">
            <v-img v-if="project.icon_url" :src="project.icon_url" cover />
            <v-icon v-else size="30">xmcl:modrinth</v-icon>
          </v-avatar>
          <div class="min-w-0">
            <div class="project-overview__title-row">
              <h2>{{ project.title }}</h2>
              <v-chip
                size="small"
                :color="project.status === 'approved' ? 'success' : 'warning'"
                variant="tonal"
              >
                {{ project.status }}
              </v-chip>
            </div>
            <div class="project-overview__meta">
              <span><v-icon size="15">link</v-icon>{{ project.slug }}</span>
              <span><v-icon size="15">fingerprint</v-icon>{{ projectId }}</span>
            </div>
          </div>
        </div>
        <v-btn
          prepend-icon="open_in_new"
          variant="tonal"
          :href="`https://modrinth.com/project/${projectId}`"
          target="browser"
        >
          {{ t('modpack.publishOpenProject') }}
        </v-btn>
      </section>

      <v-alert v-if="error" type="error" variant="tonal" closable @click:close="error = ''">{{ error }}</v-alert>
      <v-alert v-if="saved" type="success" variant="tonal">{{ t('modpack.publishProjectSaved') }}</v-alert>

      <section class="project-section project-section--wide surface-card-subsection">
        <div class="project-section__header">
          <div class="project-section__icon"><v-icon size="20">badge</v-icon></div>
          <h2>{{ t('modpack.projectIdentity') }}</h2>
        </div>
        <div class="identity-layout">
          <div class="icon-editor">
            <v-avatar size="104" rounded="lg" color="surface-variant">
              <v-img v-if="form.iconPath || project.icon_url" :src="form.iconPath ? `image://${form.iconPath}` : project.icon_url" cover />
              <v-icon v-else size="40">image</v-icon>
            </v-avatar>
            <div class="icon-editor__copy">
              <strong>{{ t('modpack.publishIcon') }}</strong>
              <span>{{ form.iconPath || t('modpack.publishIconKeep') }}</span>
            </div>
            <div class="icon-editor__actions">
              <v-btn block size="small" prepend-icon="account_box" variant="tonal" :disabled="!instanceIconPath" @click="useInstanceIcon">
                {{ t('modpack.publishIconUseInstance') }}
              </v-btn>
              <v-btn block size="small" prepend-icon="image" variant="outlined" @click="selectIcon">
                {{ t('shared.browse') }}
              </v-btn>
            </div>
          </div>
          <div class="identity-fields">
            <div class="project-grid">
              <v-text-field v-model="form.title" data-testid="modrinth-project-page-name" :label="t('modpack.publishProjectName')" variant="outlined" density="compact" hide-details />
              <v-text-field v-model="form.slug" :label="t('modpack.publishProjectSlug')" variant="outlined" density="compact" hide-details />
            </div>
            <v-text-field v-model="form.summary" :label="t('modpack.publishSummary')" variant="outlined" density="compact" hide-details counter="256" />
            <v-textarea v-model="form.description" :label="t('modpack.publishDescription')" variant="outlined" density="compact" rows="6" hide-details />
          </div>
        </div>
      </section>

      <section class="project-section surface-card-subsection">
        <div class="project-section__header">
          <div class="project-section__icon"><v-icon size="20">travel_explore</v-icon></div>
          <h2>{{ t('modpack.projectDiscovery') }}</h2>
        </div>
        <div class="project-grid">
          <v-combobox v-model="form.license" :items="licenses" item-title="name" item-value="short" :return-object="false" :label="t('modpack.publishLicense')" variant="outlined" density="compact" hide-details />
          <v-autocomplete v-model="form.categories" :items="modpackCategories" item-title="name" item-value="name" :label="t('modpack.publishCategories')" multiple chips closable-chips variant="outlined" density="compact" hide-details />
        </div>
        <div class="project-grid">
          <v-select v-model="form.clientSide" :items="sideOptions" prepend-inner-icon="desktop_windows" :label="t('shared.client')" variant="outlined" density="compact" hide-details />
          <v-select v-model="form.serverSide" :items="sideOptions" prepend-inner-icon="dns" :label="t('shared.server')" variant="outlined" density="compact" hide-details />
        </div>
      </section>

      <section class="project-section surface-card-subsection">
        <div class="project-section__header">
          <div class="project-section__icon"><v-icon size="20">link</v-icon></div>
          <h2>{{ t('modpack.projectLinks') }}</h2>
        </div>
        <div class="project-grid">
          <v-text-field v-model="form.sourceUrl" prepend-inner-icon="code" :label="t('modpack.publishSourceUrl')" variant="outlined" density="compact" hide-details />
          <v-text-field v-model="form.issuesUrl" prepend-inner-icon="bug_report" :label="t('modpack.publishIssuesUrl')" variant="outlined" density="compact" hide-details />
          <v-text-field v-model="form.wikiUrl" prepend-inner-icon="menu_book" :label="t('modpack.publishWikiUrl')" variant="outlined" density="compact" hide-details />
          <v-text-field v-model="form.discordUrl" prepend-inner-icon="forum" :label="t('modpack.publishDiscordUrl')" variant="outlined" density="compact" hide-details />
        </div>
      </section>

      <section class="project-section project-section--wide surface-card-subsection">
        <div class="section-heading">
          <div class="project-section__header">
            <div class="project-section__icon"><v-icon size="20">photo_library</v-icon></div>
            <div><h2>{{ t('modpack.projectGallery') }}</h2><p>{{ t('modpack.projectGalleryHint') }}</p></div>
          </div>
          <div class="gallery-actions">
            <v-btn prepend-icon="photo_camera" variant="tonal" :loading="screenshotsRefreshing" :disabled="instanceScreenshots.length === 0" @click="showScreenshotPicker = true">
              {{ t('modpack.projectGalleryFromScreenshots') }}
            </v-btn>
            <v-btn prepend-icon="add_photo_alternate" variant="outlined" :loading="galleryBusy" @click="addGalleryImage">{{ t('modpack.projectGalleryAdd') }}</v-btn>
          </div>
        </div>
        <div v-if="project.gallery.length" class="gallery-grid">
          <div v-for="image in project.gallery" :key="image.url" class="gallery-item">
            <v-img :src="image.url" aspect-ratio="1.6" cover />
            <div class="gallery-fields">
              <v-text-field v-model="image.title" :label="t('shared.name')" density="compact" variant="outlined" hide-details />
              <v-textarea v-model="image.description" :label="t('shared.description')" density="compact" variant="outlined" rows="2" hide-details />
              <div class="flex items-center gap-2"><v-checkbox v-model="image.featured" :label="t('modpack.projectGalleryFeatured')" density="compact" hide-details /><v-spacer /><v-btn icon="save" variant="text" :title="t('modified.save')" @click="saveGalleryImage(image)" /><v-btn icon="delete" color="error" variant="text" :title="t('delete.name')" @click="deleteGalleryImage(image.url)" /></div>
            </div>
          </div>
        </div>
        <div v-else class="gallery-empty">
          <v-icon size="30">add_photo_alternate</v-icon>
          <span>{{ t('modpack.projectGalleryEmpty') }}</span>
        </div>
      </section>

    </template>

    <v-dialog v-model="showConfirmation" max-width="620">
      <v-card data-testid="modrinth-project-page-confirm">
        <v-card-title>{{ t('modpack.publishConfirmProjectChanges') }}</v-card-title>
        <v-card-text>
          <div v-for="change in changes" :key="change.label" class="change-row"><strong>{{ change.label }}</strong><div>{{ change.before || '-' }} → {{ change.after || '-' }}</div></div>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="showConfirmation = false">{{ t('shared.cancel') }}</v-btn><v-btn color="primary" variant="flat" :loading="saving" @click="save">{{ t('modified.save') }}</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showScreenshotPicker" max-width="820" scrollable>
      <v-card>
        <v-card-item>
          <v-card-title>{{ t('modpack.projectGallerySelectScreenshot') }}</v-card-title>
          <template #append>
            <v-btn icon="close" variant="text" :aria-label="t('shared.close')" @click="showScreenshotPicker = false" />
          </template>
        </v-card-item>
        <v-card-text>
          <div v-if="instanceScreenshots.length" class="screenshot-picker">
            <button
              v-for="screenshot in instanceScreenshots"
              :key="screenshot"
              class="screenshot-picker__item"
              type="button"
              :title="screenshotName(screenshot)"
              :disabled="galleryBusy"
              @click="addGalleryImageFromScreenshot(screenshot)"
            >
              <v-img :src="screenshot" aspect-ratio="1.6" cover />
              <span>{{ screenshotName(screenshot) }}</span>
            </button>
          </div>
          <v-alert v-else type="info" variant="tonal">{{ t('screenshots.empty') }}</v-alert>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { useInstanceModpackMetadata } from '@/composables/instanceModpackMetadata'
import { getCachedModrinthProject, notifyModrinthProjectBound, useLatestBoundModrinthProject } from '@/composables/modrinthProjectBinding'
import { useModrinthProjectEditorAction } from '@/composables/modrinthProjectEditor'
import { useInstanceScreenshots } from '@/composables/screenshot'
import { clientModrinthV2 } from '@/util/clients'
import { basename } from '@/util/basename'
import { getErrorMessage } from '@/util/error'
import { injection } from '@/util/inject'
import type { Project, ProjectGallery } from '@xmcl/modrinth'
import { ModpackServiceKey } from '@xmcl/runtime-api'

const { t } = useI18n()
const { instance } = injection(kInstance)
const { modpackMetadata } = inject('modpackMetadata', useInstanceModpackMetadata, true)
const { updateBoundModrinthProject, addModrinthGalleryImage, updateModrinthGalleryImage, deleteModrinthGalleryImage } = useService(ModpackServiceKey)
const latestBoundProject = useLatestBoundModrinthProject()
const projectId = computed(() => modpackMetadata.modrinth.projectId || latestBoundProject.value?.id || '')
const { urls: instanceScreenshots, refreshing: screenshotsRefreshing } = useInstanceScreenshots(computed(() => instance.value.path))
const project = shallowRef<Project>()
const loading = ref(true)
const saving = ref(false)
const galleryBusy = ref(false)
const error = ref('')
const saved = ref(false)
const showConfirmation = ref(false)
const showScreenshotPicker = ref(false)
const licenses = shallowRef<Array<{ short: string; name: string }>>([])
const categories = shallowRef<Array<{ name: string; project_type: string }>>([])
const modpackCategories = computed(() => categories.value.filter((category) => category.project_type === 'modpack' || category.project_type === 'all'))
const sideOptions = ['required', 'optional', 'unsupported', 'unknown']
const form = reactive({ title: '', slug: '', summary: '', description: '', license: '', categories: [] as string[], clientSide: 'required', serverSide: 'optional', sourceUrl: '', issuesUrl: '', wikiUrl: '', discordUrl: '', iconPath: '' })
const instanceIconPath = computed(() => getLocalMediaPath(instance.value.icon))

function applyProject(value: Project) {
  project.value = value
  Object.assign(form, { title: value.title, slug: value.slug, summary: value.description, description: value.body, license: value.license.id, categories: [...value.categories], clientSide: value.client_side, serverSide: value.server_side, sourceUrl: value.source_url || '', issuesUrl: value.issues_url || '', wikiUrl: value.wiki_url || '', discordUrl: value.discord_url || '', iconPath: '' })
}

watch(projectId, async (id) => {
  if (!id) { loading.value = false; return }
  const cached = getCachedModrinthProject(id)
  if (cached) applyProject(cached)
  loading.value = !cached
  try {
    const [value, licenseTags, categoryTags] = await Promise.all([clientModrinthV2.getProject(id), clientModrinthV2.getLicenseTags(), clientModrinthV2.getCategoryTags()])
    applyProject(value)
    notifyModrinthProjectBound(value)
    licenses.value = licenseTags.map((tag) => {
      const value = tag as unknown as { short?: string; id?: string; name: string }
      return { short: value.short || value.id || '', name: value.name }
    })
    if (value.license.id && !licenses.value.some(tag => tag.short === value.license.id)) {
      licenses.value.push({ short: value.license.id, name: value.license.name || value.license.id })
    }
    categories.value = categoryTags
  } catch (caught) { if (!cached) error.value = getErrorMessage(caught) } finally { loading.value = false }
}, { immediate: true })

const changes = computed(() => {
  const value = project.value
  if (!value) return []
  return [
    [t('modpack.publishProjectName'), value.title, form.title], [t('modpack.publishProjectSlug'), value.slug, form.slug], [t('modpack.publishSummary'), value.description, form.summary], [t('modpack.publishDescription'), value.body, form.description], [t('modpack.publishLicense'), value.license.id, form.license], [t('modpack.publishCategories'), value.categories.join(', '), form.categories.join(', ')], [t('shared.client'), value.client_side, form.clientSide], [t('shared.server'), value.server_side, form.serverSide], [t('modpack.publishSourceUrl'), value.source_url || '', form.sourceUrl], [t('modpack.publishIssuesUrl'), value.issues_url || '', form.issuesUrl], [t('modpack.publishWikiUrl'), value.wiki_url || '', form.wikiUrl], [t('modpack.publishDiscordUrl'), value.discord_url || '', form.discordUrl],
  ].filter(([, before, after]) => before !== after).map(([label, before, after]) => ({ label, before, after })).concat(form.iconPath ? [{ label: t('modpack.publishIcon'), before: value.icon_url || '', after: form.iconPath }] : [])
})

const projectEditorAction = useModrinthProjectEditorAction()
watchEffect(() => projectEditorAction.setState({
  available: !!project.value,
  dirty: changes.value.length > 0,
  saving: saving.value,
}))
const stopSaveRequest = projectEditorAction.onSaveRequested(() => {
  if (project.value && changes.value.length > 0 && !saving.value) {
    showConfirmation.value = true
  }
})
onUnmounted(() => {
  stopSaveRequest()
  projectEditorAction.setState({ available: false, dirty: false, saving: false })
})

function selectIcon() { windowController.showOpenDialog({ title: t('modpack.publishIcon'), properties: ['openFile'], filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] }).then(({ filePaths, canceled }) => { if (!canceled && filePaths[0]) form.iconPath = filePaths[0] }) }
function useInstanceIcon() { if (instanceIconPath.value) form.iconPath = instanceIconPath.value }
function getLocalMediaPath(url: string) { try { const parsed = new URL(url); return parsed.hostname === 'launcher' && parsed.pathname === '/media' ? parsed.searchParams.get('path') || '' : '' } catch { return '' } }
function screenshotName(url: string) { return basename(getLocalMediaPath(url)) || url }

async function save() {
  if (!project.value) return
  saving.value = true; error.value = ''; saved.value = false
  try {
    const value = await updateBoundModrinthProject({ instancePath: instance.value.path, projectId: project.value.id, iconPath: form.iconPath || undefined, project: { title: form.title, slug: form.slug, description: form.summary, body: form.description, license_id: form.license, categories: form.categories, client_side: form.clientSide as any, server_side: form.serverSide as any, source_url: form.sourceUrl || null, issues_url: form.issuesUrl || null, wiki_url: form.wikiUrl || null, discord_url: form.discordUrl || null } })
    applyProject(value); notifyModrinthProjectBound(value); saved.value = true; showConfirmation.value = false
  } catch (caught) { error.value = getErrorMessage(caught) } finally { saving.value = false }
}

async function addGalleryImage() {
  if (!project.value) return
  const { filePaths, canceled } = await windowController.showOpenDialog({ title: t('modpack.projectGalleryAdd'), properties: ['openFile'], filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] })
  if (canceled || !filePaths[0]) return
  await uploadGalleryImage(filePaths[0])
}
async function addGalleryImageFromScreenshot(screenshot: string) {
  const imagePath = getLocalMediaPath(screenshot)
  if (!imagePath) return
  showScreenshotPicker.value = false
  await uploadGalleryImage(imagePath)
}
async function uploadGalleryImage(imagePath: string) {
  if (!project.value) return
  galleryBusy.value = true
  try { applyProject(await addModrinthGalleryImage({ instancePath: instance.value.path, projectId: project.value.id, imagePath, featured: project.value.gallery.length === 0, ordering: project.value.gallery.length })) } catch (caught) { error.value = getErrorMessage(caught) } finally { galleryBusy.value = false }
}
async function saveGalleryImage(image: ProjectGallery) { if (!project.value) return; galleryBusy.value = true; try { applyProject(await updateModrinthGalleryImage(instance.value.path, project.value.id, image.url, { title: image.title, description: image.description, featured: image.featured })) } catch (caught) { error.value = getErrorMessage(caught) } finally { galleryBusy.value = false } }
async function deleteGalleryImage(url: string) { if (!project.value) return; galleryBusy.value = true; try { applyProject(await deleteModrinthGalleryImage(instance.value.path, project.value.id, url)) } catch (caught) { error.value = getErrorMessage(caught) } finally { galleryBusy.value = false } }
</script>

<style scoped>
.project-page { width: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 520px), 1fr)); align-items: start; gap: 14px; padding-bottom: 12px; }
.project-overview { display: flex; grid-column: 1 / -1; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 18px; }
.project-overview__identity { display: flex; align-items: center; min-width: 0; gap: 14px; }
.project-overview__title-row { display: flex; align-items: center; min-width: 0; gap: 10px; }
.project-overview h2 { overflow: hidden; margin: 0; font-size: 1.15rem; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.project-overview__meta { display: flex; flex-wrap: wrap; gap: 5px 16px; margin-top: 4px; color: rgba(var(--v-theme-on-surface), .58); font-size: .78rem; }
.project-overview__meta span { display: inline-flex; align-items: center; gap: 5px; }
.project-section { display: flex; flex-direction: column; gap: 18px; padding: 18px; }
.project-section--wide { grid-column: 1 / -1; }
.project-section__header { display: flex; align-items: center; gap: 11px; }
.project-section__header h2 { margin: 0; font-size: 1rem; font-weight: 650; }
.project-section__icon { display: grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; border-radius: 8px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .1); }
.identity-layout { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 22px; }
.icon-editor { display: flex; align-items: center; flex-direction: column; gap: 11px; padding: 14px; border: 1px solid rgba(var(--v-theme-on-surface), .09); border-radius: 8px; background: rgba(var(--v-theme-on-surface), .025); }
.icon-editor__copy { display: flex; width: 100%; min-width: 0; flex-direction: column; text-align: center; }
.icon-editor__copy strong { font-size: .875rem; font-weight: 600; }
.icon-editor__copy span { overflow: hidden; color: rgba(var(--v-theme-on-surface), .55); font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }
.icon-editor__actions { display: flex; width: 100%; flex-direction: column; gap: 8px; }
.identity-fields { display: flex; min-width: 0; flex-direction: column; gap: 12px; }
.project-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 12px; }
.section-heading { display: flex; align-items: center; gap: 12px; }
.section-heading { justify-content: space-between; }.section-heading p { margin: 2px 0 0; color: rgba(var(--v-theme-on-surface), .58); font-size: .78rem; }
.gallery-actions { display: flex; flex-shrink: 0; gap: 8px; }
.gallery-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
.gallery-item { overflow: hidden; border: 1px solid rgba(var(--v-theme-on-surface),.12); border-radius: 8px; }
.gallery-fields { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
.gallery-empty { display: flex; min-height: 104px; align-items: center; justify-content: center; flex-direction: column; gap: 8px; border: 1px dashed rgba(var(--v-theme-on-surface), .18); border-radius: 8px; color: rgba(var(--v-theme-on-surface), .5); font-size: .82rem; }
.screenshot-picker { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.screenshot-picker__item { overflow: hidden; padding: 0; border: 1px solid rgba(var(--v-theme-on-surface), .12); border-radius: 8px; color: inherit; background: rgba(var(--v-theme-on-surface), .03); text-align: left; transition: border-color .15s ease, background-color .15s ease; }
.screenshot-picker__item:hover { border-color: rgba(var(--v-theme-primary), .6); background: rgba(var(--v-theme-primary), .08); }
.screenshot-picker__item span { display: block; overflow: hidden; padding: 8px 10px; font-size: .75rem; text-overflow: ellipsis; white-space: nowrap; }
.change-row { padding: 10px 0; border-bottom: 1px solid rgba(128,128,128,.2); overflow-wrap:anywhere; }
@media(max-width:760px){.project-overview{align-items:flex-start;flex-direction:column}.project-overview>.v-btn{width:100%}.identity-layout,.project-grid,.gallery-grid{grid-template-columns:minmax(0,1fr)}.identity-layout{gap:14px}.section-heading{align-items:flex-start;flex-direction:column}.gallery-actions,.section-heading>.v-btn{width:100%}.gallery-actions{flex-direction:column}.screenshot-picker{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>