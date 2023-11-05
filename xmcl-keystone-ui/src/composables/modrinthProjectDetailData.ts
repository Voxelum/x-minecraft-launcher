import { useMarkdown } from '@/composables/markdown'
import { useModrinthTags } from '@/composables/modrinth'
import { ModFile } from '@/util/mod'
import { Category, Project, ProjectVersion, SearchResultHit } from '@xmcl/modrinth'
import { Ref } from 'vue'
import type { ExternalResource, Info, ProjectDetail, ModGallery } from '@/components/MarketProjectDetail.vue'
import type { ProjectVersion as ModVersion } from '@/components/MarketProjectDetailVersion.vue'

export function useModrinthProjectDetailData(projectId: Ref<string>, project: Ref<Project | undefined>, search: Ref<SearchResultHit | undefined>) {
  const { render } = useMarkdown()
  const { categories } = useModrinthTags()
  const { t } = useI18n()
  const getEnv = (v: string) => {
    if (v === 'required') return t('modrinth.environments.required')
    if (v === 'optional') return t('modrinth.environments.optional')
    if (v === 'unsupported') return t('modrinth.environments.unsupported')
    return v
  }
  const data = computed(() => {
    const externals: ExternalResource[] = []
    if (project.value?.discord_url) {
      externals.push({
        icon: 'open_in_new',
        name: 'Discord',
        url: project.value.discord_url,
      })
    }
    if (project.value?.issues_url) {
      externals.push({
        icon: 'open_in_new',
        name: t('modrinth.issueUrl'),
        url: project.value.issues_url,
      })
    }
    if (project.value?.source_url) {
      externals.push({
        icon: 'open_in_new',
        name: t('modrinth.sourceUrl'),
        url: project.value.source_url,
      })
    }
    if (project.value?.wiki_url) {
      externals.push({
        icon: 'open_in_new',
        name: t('modrinth.wikiUrl'),
        url: project.value.wiki_url,
      })
    }
    const info: Info[] = []
    if (project.value?.client_side) {
      info.push({
        icon: 'desktop_windows',
        name: t('modrinth.clientSide'),
        value: getEnv(project.value.client_side),
      })
    }
    if (project.value?.server_side) {
      info.push({
        icon: 'storage',
        name: t('modrinth.serverSide'),
        value: getEnv(project.value.server_side),
      })
    }
    if (project.value?.license) {
      info.push({
        icon: 'description',
        name: t('modrinth.license'),
        value: project.value.license.name,
        url: project.value.license.url,
      })
    }
    if (project.value?.id) {
      info.push({
        icon: 'code',
        name: t('modrinth.projectId'),
        value: project.value.id,
      })
    }
    const galleries: ModGallery[] = []
    if (project.value?.gallery) {
      for (const g of project.value.gallery) {
        galleries.push({
          title: g.title,
          description: g.description,
          date: g.created,
          url: g.url,
        })
      }
    }
    const getCategories = (cats: string[]) => cats.map(id => categories.value.find(c => c.name === id))
      .filter((v): v is Category => !!v).map(v => ({ id: v.name, name: t(`modrinth.categories.${v.name}`) as string, iconHTML: v.icon }))
    const detail: ProjectDetail = {
      icon: project.value?.icon_url ?? search.value?.icon_url ?? '',
      id: projectId.value,
      title: project.value?.title ?? search.value?.title ?? '',
      description: project.value?.description ?? search.value?.description ?? '',
      author: search.value?.author ?? '',
      downloadCount: project.value?.downloads ?? search.value?.downloads ?? 0,
      follows: project.value?.followers ?? search.value?.follows ?? 0,
      url: `https://modrinth.com/${project.value?.project_type ?? search.value?.project_type}/${project.value?.slug ?? search.value?.slug}`,
      categories: getCategories(project.value?.categories ?? search.value?.categories ?? []),
      htmlContent: project.value?.body ? render(project.value.body) : '',
      externals,
      galleries,
      info,
    }
    return detail
  })

  return data
}

export function useModrinthProjectDetailVersions(versions: Ref<ProjectVersion[]>, installed: Ref<Pick<ModFile, 'modrinth'>[]>) {
  const { render } = useMarkdown()
  const modVersions = computed(() => {
    const all: ModVersion[] = []
    for (const v of (versions.value || [])) {
      all.push(reactive({
        id: v.id,
        name: v.name,
        version: v.version_number,
        disabled: false,
        type: v.version_type as any,
        downloadCount: v.downloads,
        loaders: v.loaders,
        installed: computed(() => installed.value.some(f => f.modrinth?.versionId === v.id)),
        minecraftVersion: v.game_versions.join(', '),
        createdDate: v.date_published,
        changelog: v.changelog ? render(v.changelog) : undefined,
      }))
    }
    return all
  })

  return modVersions
}
