<template>
  <StoreProject
    :project="project"
    :featured-versions="versions"
    :error="error"
    :refreshing="isValidating"
    :members="members"
    :loading-members="false"
    :team-error="undefined"
  />
</template>
<script lang="ts"  setup>
import { getCurseforgeProjectDescriptionModel, getCurseforgeProjectModel } from '@/composables/curseforge'
import { useDateString } from '@/composables/date'
import { useSWRVModel } from '@/composables/swrv'
import StoreProject, { StoreProject as IStoreProject } from './StoreProject.vue'
import { StoreProjectVersion } from './StoreProjectInstallFeaturedVersionDialog.vue'
import { TeamMember } from './StoreProjectMembers.vue'

const props = defineProps<{ id: number }>()

const { t, te } = useI18n()
const projectId = computed(() => props.id)

const { data: proj, isValidating, mutate, error } = useSWRVModel(getCurseforgeProjectModel(projectId))
const { getDateString } = useDateString()
const tCategory = (k: string) => te(`curseforgeCategory.${k}`) ? t(`curseforgeCategory.${k}`) : k
const description = useSWRVModel(getCurseforgeProjectDescriptionModel(projectId))
const project = computed(() => {
  const p = proj.value
  if (!p) return undefined
  const links = [] as IStoreProject['links']
  if (p.links.issuesUrl) {
    links.push({
      url: p.links.issuesUrl,
      name: 'Issue',
    })
  }
  if (p.links.sourceUrl) {
    links.push({
      url: p.links.sourceUrl,
      name: 'Source',
    })
  }
  if (p.links.wikiUrl) {
    links.push({
      url: p.links.wikiUrl,
      name: 'Wiki',
    })
  }
  const info = [] as IStoreProject['info']
  if (p?.dateCreated) {
    info.push({
      name: t('curseforge.createdDate'),
      icon: 'event_available',
      value: getDateString(p.dateCreated),
    })
  }
  if (p?.dateModified) {
    info.push({
      name: t('curseforge.lastUpdate'),
      icon: 'edit_calendar',
      value: getDateString(p.dateModified),
    })
  }
  if (p?.dateReleased) {
    info.push({
      name: t('curseforge.releasedDate'),
      icon: 'calendar_month',
      value: getDateString(p.dateReleased),
    })
  }
  if (p?.slug) {
    info.push({
      name: 'Slug',
      icon: 'link',
      value: p.slug,
    })
  }
  const categories: IStoreProject['categories'] = p?.categories.map(c => reactive({
    id: c.id.toString(),
    name: computed(() => tCategory(c.name)),
    icon: c.iconUrl,
  })) || []

  const result: IStoreProject = reactive({
    id: p.id.toString(),
    title: p.name,
    iconUrl: p.logo.url,
    url: p.links.websiteUrl,
    description: p.summary,
    categories,
    downloads: p.downloadCount,
    follows: p.thumbsUpCount,
    createDate: p.dateCreated,
    updateDate: p.dateModified,
    links,
    info,
    htmlDescription: computed(() => description.data.value || ''),
    gallery: p.screenshots.map(g => ({
      url: g.url,
      description: g.description,
    })),
  })
  return result
})

const versions = computed(() => {
  if (!proj.value) return []
  const result: StoreProjectVersion[] = []
  for (const v of proj.value.latestFiles) {
    const x: StoreProjectVersion = {
      id: v.id.toString(),
      name: v.displayName,
      version_type: v.releaseType === 1 ? 'release' : v.releaseType === 2 ? 'beta' : 'alpha',
      game_versions: v.gameVersions,
      loaders: v.gameVersions,
    }
    result.push(x)
  }
  return result
})

const members = computed(() => {
  if (!proj.value) return []
  const result: TeamMember[] = []
  for (const m of proj.value.authors) {
    result.push({
      id: m.id.toString(),
      name: m.name,
      avatar: '',
      role: '',
    })
  }
  return result
})

</script>
